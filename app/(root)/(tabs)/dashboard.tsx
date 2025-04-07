import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  Modal,
  Animated,
  Pressable,
  Image,
  AppState,
  AppStateStatus,
} from "react-native";
import { LineChart, BarChart, PieChart } from "react-native-chart-kit";
import {
  Rect,
  Text as TextSVG,
  Svg,
  Line,
  Circle,
  G,
  Polygon,
} from "react-native-svg";
import { useTheme } from "../context/ThemeContext";
import { auth } from "../firebase/firebaseConfig";
import { TransactionService } from "../services/transactionService";
import { AccountService } from "../services/accountService";
import {
  CategoryService,
  Category,
  MainCategory,
} from "../services/categoryService";
import { BudgetService } from "../services/budgetService";
import Toast from "react-native-toast-message";
import { Transaction, DailyAggregation } from "../firebase/types";
import { Timestamp } from "firebase/firestore";
import { MaterialIcons } from "@expo/vector-icons";
import SpentThisMonthWidget from "./spent-this-month-widget";
import SpendingOverTimeChart from "../charts/SpendingOverTimeChart";
import AverageSpendingChart from "../charts/AverageSpendingChart";
import CategoryBreakdownChart from "../charts/CategoryBreakdownChart";
import { DailyAggregationService } from "../services/dailyAggregationService";
import { PreloadService } from "../services/preloadService";

interface ChartData {
  labels: string[];
  datasets: {
    data: number[];
    color?: (opacity: number) => string;
    strokeWidth?: number;
    withDots?: boolean;
  }[];
}

interface DataPointClickEvent {
  index?: number;
  value?: number;
  x: number;
  y: number;
}

interface DailySpending {
  date: string;
  amount: number;
  transactions: Transaction[];
}

interface PieChartData {
  name: string;
  amount: number;
  color: string;
  legendFontColor: string;
  legendFontSize: number;
  budget?: number;
}

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  onPress?: () => void;
}

interface TimeFrameData {
  current: number[];
  previous: number[];
  labels: string[];
}

type GraphType = "spending" | "average" | "category";

interface CategorySummaryData {
  id: string;
  name: string;
  logo: string;
  transactionCount: number;
  amount: number;
  percentage: number;
  color: string;
}

// Transaction cache interface
interface TransactionCache {
  [timeframe: string]: {
    transactions: Transaction[];
    lastUpdated: number;
    startDate: Date;
    endDate: Date;
    lastAccessed: number; // For LRU tracking
  };
}

// Cache configuration
interface CacheConfig {
  maxEntries: number; // Maximum number of different timeframes to cache
  expiryTime: number; // Cache expiry time in milliseconds
  maxTransactions: number; // Maximum number of transactions to cache per timeframe
}

// Create a global cache object
const transactionCache: TransactionCache = {};

// Cache configuration
const CACHE_CONFIG: CacheConfig = {
  maxEntries: 3, // Store only 3 different timeframes at most
  expiryTime: 5 * 60 * 1000, // 5 minutes expiry
  maxTransactions: 1000, // Maximum 1000 transactions per timeframe
};

// Function to manage cache size - implements LRU eviction policy
const enforceCacheLimits = () => {
  const cacheKeys = Object.keys(transactionCache);

  // If we're under the limit, no need to evict
  if (cacheKeys.length <= CACHE_CONFIG.maxEntries) {
    return;
  }

  // Sort cache entries by last accessed time (oldest first)
  const sortedKeys = cacheKeys.sort(
    (a, b) =>
      transactionCache[a].lastAccessed - transactionCache[b].lastAccessed
  );

  // Remove oldest entries until we're under the limit
  while (sortedKeys.length > CACHE_CONFIG.maxEntries) {
    const oldestKey = sortedKeys.shift();
    if (oldestKey) {
      console.log(
        `Evicting cache entry for ${oldestKey} due to cache size limits`
      );
      delete transactionCache[oldestKey];
    }
  }
};

// Function to clean up expired cache entries
const cleanupExpiredCache = () => {
  const now = Date.now();
  Object.keys(transactionCache).forEach((key) => {
    if (now - transactionCache[key].lastUpdated > CACHE_CONFIG.expiryTime) {
      console.log(`Removing expired cache entry for ${key}`);
      delete transactionCache[key];
    }
  });
};

// Function to trim transaction arrays that are too large
const trimTransactionCache = (transactions: Transaction[]): Transaction[] => {
  if (transactions.length <= CACHE_CONFIG.maxTransactions) {
    return transactions;
  }

  console.log(
    `Trimming transaction cache from ${transactions.length} to ${CACHE_CONFIG.maxTransactions} items`
  );

  // Sort by date descending (newest first) before trimming
  const sorted = [...transactions].sort(
    (a, b) => b.date.toMillis() - a.date.toMillis()
  );

  // Return only the most recent transactions
  return sorted.slice(0, CACHE_CONFIG.maxTransactions);
};

const ChartCard: React.FC<ChartCardProps> = ({ title, children, onPress }) => {
  const { isDarkMode } = useTheme();

  return (
    <View
      className={`p-2 rounded-xl mb-4 w-full ${
        isDarkMode ? "bg-gray-800 shadow-lg" : "bg-white shadow-md"
      }`}
    >
      <Text
        className={`text-lg font-bold mb-2 text-center ${
          isDarkMode ? "text-gray-200" : "text-gray-900"
        }`}
      >
        {title}
      </Text>
      {children}
    </View>
  );
};

// Add this interface for grouped transactions
interface GroupedTransactions {
  date: Date;
  formattedDate: string;
  totalAmount: number;
  transactions: Transaction[];
}

const Dashboard = () => {
  const { isDarkMode } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsData, setDetailsData] = useState<any>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [selectedGraph, setSelectedGraph] = useState<GraphType>("spending");
  const screenWidth = Dimensions.get("window").width;
  const [timeFrame, setTimeFrame] = useState<
    "week" | "month" | "6months" | "year"
  >("month");
  const [spendingOverTime, setSpendingOverTime] = useState<TimeFrameData>({
    current: [],
    previous: [],
    labels: [],
  });
  const [averageSpending, setAverageSpending] = useState<ChartData>({
    labels: [],
    datasets: [{ data: [0] }, { data: [0] }],
  });

  // Add missing state variables for transaction management
  const [currentTransactions, setCurrentTransactions] = useState<Transaction[]>(
    []
  );
  const [previousTransactions, setPreviousTransactions] = useState<
    Transaction[]
  >([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    []
  );

  // Add state for spending data
  const [spendingData, setSpendingData] = useState<{
    currentPeriod: { date: string; amount: number }[];
    previousPeriod: { date: string; amount: number }[];
    averageSpending: number;
    percentageChange: number;
    maxValue: number;
  }>({
    currentPeriod: [],
    previousPeriod: [],
    averageSpending: 0,
    percentageChange: 0,
    maxValue: 0,
  });

  // Chart data states
  const [pieData, setPieData] = useState<PieChartData[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const chartWidth = screenWidth; // Width of the chart area

  const chartConfig = {
    backgroundColor: "transparent",
    backgroundGradientFrom: isDarkMode ? "#1F2937" : "#FFFFFF",
    backgroundGradientTo: isDarkMode ? "#1F2937" : "#FFFFFF",
    decimalPlaces: 0,
    color: (opacity = 1) =>
      isDarkMode
        ? `rgba(255, 255, 255, ${opacity})`
        : `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) =>
      isDarkMode
        ? `rgba(255, 255, 255, ${opacity})`
        : `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: "4",
      strokeWidth: "1",
      stroke: isDarkMode ? "#3B82F6" : "#1D4ED8",
    },
    formatYLabel: (value: number) => Math.round(value).toString(),
    propsForBackgroundLines: {
      strokeDasharray: "", // solid background lines
      stroke: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
      strokeWidth: 1,
    },
  };

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const newDataFadeAnim = useRef(new Animated.Value(0)).current;
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [categorySummaries, setCategorySummaries] = useState<
    CategorySummaryData[]
  >([]);

  // Add new state for category view
  const [categoryViewMode, setCategoryViewMode] = useState<
    "subcategories" | "main"
  >("subcategories");

  // Add state for category loading
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);

  // Add state for category dropdown
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Add a hasPreloadedData state
  const [hasPreloadedData, setHasPreloadedData] = useState(false);

  // Add missing state for the daily aggregations
  const [dailyAggregations, setDailyAggregations] = useState<
    DailyAggregation[]
  >([]);

  // Add new state variables for category transactions display
  const [selectedCategory, setSelectedCategory] =
    useState<CategorySummaryData | null>(null);
  const [categoryTransactions, setCategoryTransactions] = useState<
    Transaction[]
  >([]);
  const [showCategoryTransactionsModal, setShowCategoryTransactionsModal] =
    useState(false);
  const [isCategoryTransactionsLoading, setIsCategoryTransactionsLoading] =
    useState(false);

  // Add state for grouped transactions
  const [groupedCategoryTransactions, setGroupedCategoryTransactions] =
    useState<GroupedTransactions[]>([]);

  // Add missing utility function for rounding numbers
  const roundToTwoDecimals = (value: number): number => {
    return Math.round(value * 100) / 100;
  };

  // Helper function to check if a date is within a range
  const isWithinRange = (date: Date, start: Date, end: Date) => {
    return date >= start && date <= end;
  };

  // Helper function to get date ranges based on timeFrame
  const getDateRanges = (timeFrame: "week" | "month" | "6months" | "year") => {
    const now = new Date();
    let currentStart: Date,
      currentEnd: Date,
      previousStart: Date,
      previousEnd: Date;

    switch (timeFrame) {
      case "week":
        currentStart = new Date(now.setDate(now.getDate() - now.getDay()));
        currentEnd = new Date(now.setDate(now.getDate() + 6));
        previousStart = new Date(
          new Date(currentStart).setDate(currentStart.getDate() - 7)
        );
        previousEnd = new Date(
          new Date(currentEnd).setDate(currentEnd.getDate() - 7)
        );
        break;
      case "month":
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "6months":
        currentStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 12, 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth() - 6, 0);
        break;
      case "year":
        currentStart = new Date(now.getFullYear(), 0, 1);
        currentEnd = new Date(now.getFullYear(), 11, 31);
        previousStart = new Date(now.getFullYear() - 1, 0, 1);
        previousEnd = new Date(now.getFullYear() - 1, 11, 31);
        break;
    }

    return { currentStart, currentEnd, previousStart, previousEnd };
  };

  // Helper function to get group key for transactions
  const getGroupKey = (
    date: Date,
    timeFrame: "week" | "month" | "6months" | "year"
  ): string => {
    switch (timeFrame) {
      case "week":
        return date.toLocaleDateString("en-US", { weekday: "short" });
      case "month":
        return `Week ${Math.ceil(date.getDate() / 7)}`;
      case "6months":
        return date.toLocaleDateString("en-US", { month: "short" });
      case "year":
        return `Q${Math.floor(date.getMonth() / 3) + 1}`;
      default:
        return date.toLocaleDateString();
    }
  };

  // Helper function to aggregate transactions by period
  const aggregateTransactionsByPeriod = (
    transactions: Transaction[],
    timeFrame: "week" | "month" | "6months" | "year"
  ): number[] => {
    const labels = getTimeFrameLabels(timeFrame);
    const grouped = transactions.reduce(
      (acc: { [key: string]: number }, transaction) => {
        const date = (transaction.date as Timestamp).toDate();
        const key = getGroupKey(date, timeFrame);
        acc[key] = (acc[key] || 0) + Math.abs(transaction.amount);
        return acc;
      },
      {}
    );

    return labels.map((label) => grouped[label] || 0);
  };

  // Helper function to get time frame labels
  const getTimeFrameLabels = (
    timeFrame: "week" | "month" | "6months" | "year"
  ): string[] => {
    switch (timeFrame) {
      case "week":
        return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      case "month":
        return ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"];
      case "6months":
        return ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
      case "year":
        return ["Q1", "Q2", "Q3", "Q4"];
      default:
        return [];
    }
  };

  // Helper function to get window size based on time frame
  const getWindowSize = (
    timeFrame: "week" | "month" | "6months" | "year"
  ): number => {
    switch (timeFrame) {
      case "week":
        return 3; // 3-day moving average
      case "month":
        return 2; // 2-week moving average
      case "6months":
        return 3; // 3-month moving average
      case "year":
        return 2; // 2-quarter moving average
      default:
        return 3;
    }
  };

  // Helper function to calculate historical average
  const calculateHistoricalAverage = (
    data: number[],
    timeFrame: "week" | "month" | "6months" | "year"
  ): number[] => {
    const windowSize = getWindowSize(timeFrame);
    const averages: number[] = [];

    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = data.slice(start, i + 1);
      const average = window.reduce((sum, val) => sum + val, 0) / window.length;
      averages.push(average);
    }

    return averages;
  };

  // Helper function to aggregate data by time frame
  const aggregateByTimeFrame = (
    aggregations: DailyAggregation[],
    timeFrame: "week" | "month" | "6months" | "year"
  ): number[] => {
    const labels = getTimeFrameLabels(timeFrame);
    const grouped = aggregations.reduce(
      (acc: { [key: string]: number }, agg) => {
        const date = agg.date.toDate();
        const key = getGroupKey(date, timeFrame);
        acc[key] = (acc[key] || 0) + agg.totalExpenses;
        return acc;
      },
      {}
    );

    return labels.map((label: string) => grouped[label] || 0);
  };

  // Helper function to get color for pie chart
  const getColorForIndex = (index: number): string => {
    const colors = [
      "#FF6384",
      "#36A2EB",
      "#FFCE56",
      "#4BC0C0",
      "#9966FF",
      "#FF9F40",
      "#FF6384",
    ];
    return colors[index % colors.length];
  };

  // Fix the prepareCategoryData function to use categoryId instead of categories
  const prepareCategoryData = (
    aggregations: DailyAggregation[] | null,
    isLoading: boolean,
    isRefreshing: boolean
  ): void => {
    try {
      console.log(
        `Preparing category data from ${aggregations?.length || 0} aggregations`
      );

      // Calculate category totals and transaction counts from aggregations
      const categoryTotals: Record<string, number> = {};
      const categoryTransactionCounts: Record<string, number> = {};

      if (aggregations && aggregations.length > 0) {
        for (const agg of aggregations) {
          // Use categoryId property instead of categories
          if (agg.categoryId) {
            // Map the categoryId to a total amount
            if (!categoryTotals[agg.categoryId])
              categoryTotals[agg.categoryId] = 0;
            // Add totalExpenses to the category total
            categoryTotals[agg.categoryId] += agg.totalExpenses || 0;

            if (!categoryTransactionCounts[agg.categoryId])
              categoryTransactionCounts[agg.categoryId] = 0;
            categoryTransactionCounts[agg.categoryId] +=
              agg.transactionCount || 0;
          }
        }
      }

      // Get user categories to map IDs to names and logos
      CategoryService.getUserCategories(auth.currentUser?.uid || "")
        .then((categories) => {
          const categoryMap = new Map(categories.map((cat) => [cat.id, cat]));

          let pieChartData = Object.entries(categoryTotals)
            // Filter out categories with zero amount
            .filter(([_, amount]) => amount > 0)
            // Map to required format for pie chart with name, logo, etc.
            .map(([categoryId, amount]) => {
              const category = categoryMap.get(categoryId);
              return {
                id: categoryId,
                name: category?.name || "Unknown",
                logo: category?.icon || "❓", // Using icon instead of logo
                value: amount,
                transactionCount: categoryTransactionCounts[categoryId] || 0,
              };
            })
            .sort((a, b) => b.value - a.value);

          // Calculate total spending for percentages
          const totalSpending = pieChartData.reduce(
            (sum, item) => sum + item.value,
            0
          );

          // Prepare the summary data
          const summaries: CategorySummaryData[] = pieChartData.map((item) => ({
            id: item.id,
            name: item.name,
            logo: item.logo,
            transactionCount: item.transactionCount,
            amount: item.value,
            percentage:
              totalSpending > 0
                ? Math.round((item.value / totalSpending) * 100)
                : 0,
            color: getColorForIndex(pieChartData.indexOf(item)),
          }));

          console.log(`Generated ${summaries.length} category summaries`);

          // Only set the pie data and summaries if we have valid data
          if (summaries.length > 0) {
            setPieData(
              pieChartData.map((item) => ({
                name: item.name,
                amount: item.value,
                color: getColorForIndex(pieChartData.indexOf(item)),
                legendFontColor: "#FFFFFF",
                legendFontSize: 12,
              }))
            );
            setCategorySummaries(summaries);
          } else if (!isLoading && !isRefreshing) {
            // If we have no data and we're not in a loading state, use empty arrays
            console.log("No category data available, using empty arrays");
            setPieData([]);
            setCategorySummaries([]);
          }
        })
        .catch((error) => {
          console.error("Error fetching categories for pie chart:", error);
          // If there's an error, use empty arrays
          setPieData([]);
          setCategorySummaries([]);
        });
    } catch (error) {
      console.error("Error preparing category data:", error);
      // If there's an error, use empty arrays
      setPieData([]);
      setCategorySummaries([]);
    }
  };

  // New helper function to prepare category data directly from transactions
  const prepareCategorySummaryFromTransactions = async (
    transactions: Transaction[],
    viewMode: "subcategories" | "main" = "subcategories"
  ): Promise<{
    categorySummaries: CategorySummaryData[];
    pieData: PieChartData[];
  }> => {
    // Get all user categories
    const categories = await CategoryService.getUserCategories(
      auth.currentUser?.uid || ""
    );

    // If we're in main categories mode, fetch main categories as well
    let mainCategories: MainCategory[] = [];
    if (viewMode === "main") {
      mainCategories = await CategoryService.getUserMainCategories(
        auth.currentUser?.uid || ""
      );
      console.log("Main categories fetched:", mainCategories.length);
    }

    console.log("Categories fetched:", categories.length);
    console.log("Total transactions:", transactions.length);
    console.log("Current view mode:", viewMode);

    // Create maps for category lookups
    const categoryByName: Record<string, any> = {};
    const categoryById: Record<string, any> = {};
    const categoryToMainCategory: Record<string, string> = {};
    const mainCategoryById: Record<string, MainCategory> = {};
    const mainCategoryByName: Record<string, MainCategory> = {};

    // Build lookup maps for regular categories
    categories.forEach((category) => {
      categoryById[category.id] = category;
      categoryByName[category.name.toLowerCase()] = category;

      // Map this category to its main category
      if (category.mainCategory) {
        categoryToMainCategory[category.id] = category.mainCategory;
      }
    });

    // Build lookup maps for main categories
    mainCategories.forEach((mainCategory) => {
      mainCategoryById[mainCategory.id] = mainCategory;
      mainCategoryByName[mainCategory.name.toLowerCase()] = mainCategory;
    });

    console.log(
      "Category lookup maps created - Categories:",
      Object.keys(categoryById).length,
      "Main categories:",
      Object.keys(mainCategoryById).length
    );

    // Check for the actual structure of a transaction to help with debugging
    if (transactions.length > 0) {
      console.log(
        "First transaction object structure:",
        JSON.stringify(transactions[0])
      );
    }

    // More robust filtering for expense transactions
    const expenseTransactions = transactions.filter((t) => {
      // Check various ways a transaction might be marked as an expense
      const isNegativeAmount = t.amount < 0;
      const hasExpenseType =
        t.transactionType === "expense" || (t as any).type === "expense";
      return isNegativeAmount || hasExpenseType;
    });

    console.log("Expense transactions:", expenseTransactions.length);

    // Initialize totals structures
    const categoryTotals: { [key: string]: number } = {};
    const categoryTransactionCounts: { [key: string]: number } = {};
    const mainCategoryTotals: { [key: string]: number } = {};
    const mainCategoryTransactionCounts: { [key: string]: number } = {};
    let uncategorizedTotal = 0;
    let uncategorizedCount = 0;

    // Process transactions with robust category handling
    expenseTransactions.forEach((transaction) => {
      // Get the absolute amount (ensure it's positive for expenses)
      const amount = Math.abs(transaction.amount);

      // Check for categoryId in different possible formats
      const categoryIdOrName =
        transaction.categoryId ||
        (transaction as any).category_id ||
        (transaction as any).categoryID;

      if (categoryIdOrName) {
        // Try to find the category by ID first, then by name
        let categoryId = categoryIdOrName;
        let categoryFound = false;
        let mainCategoryName = "";

        // If the categoryId is actually a name, find the real category ID
        if (
          !categoryById[categoryIdOrName] &&
          categoryByName[categoryIdOrName.toLowerCase()]
        ) {
          // Found category by name
          const category = categoryByName[categoryIdOrName.toLowerCase()];
          categoryId = category.id;
          mainCategoryName = category.mainCategory;
          categoryFound = true;
        } else if (categoryById[categoryIdOrName]) {
          // Found category by ID
          const category = categoryById[categoryIdOrName];
          mainCategoryName = category.mainCategory;
          categoryFound = true;
        }

        if (viewMode === "subcategories") {
          // If we found a valid category (by id or name), add to that category
          if (categoryFound) {
            categoryTotals[categoryId] =
              (categoryTotals[categoryId] || 0) + amount;
            categoryTransactionCounts[categoryId] =
              (categoryTransactionCounts[categoryId] || 0) + 1;
          } else {
            // If the categoryId doesn't match any known category, treat as a new category
            categoryTotals[categoryIdOrName] =
              (categoryTotals[categoryIdOrName] || 0) + amount;
            categoryTransactionCounts[categoryIdOrName] =
              (categoryTransactionCounts[categoryIdOrName] || 0) + 1;
          }
        } else {
          // We're in main categories mode, aggregate by main category
          if (categoryFound && mainCategoryName) {
            // We know which main category this belongs to
            mainCategoryTotals[mainCategoryName] =
              (mainCategoryTotals[mainCategoryName] || 0) + amount;
            mainCategoryTransactionCounts[mainCategoryName] =
              (mainCategoryTransactionCounts[mainCategoryName] || 0) + 1;
          } else {
            // Check if the categoryIdOrName is actually a main category name
            const lowerCaseName = categoryIdOrName.toLowerCase();
            if (mainCategoryByName[lowerCaseName]) {
              mainCategoryTotals[mainCategoryByName[lowerCaseName].name] =
                (mainCategoryTotals[mainCategoryByName[lowerCaseName].name] ||
                  0) + amount;
              mainCategoryTransactionCounts[
                mainCategoryByName[lowerCaseName].name
              ] =
                (mainCategoryTransactionCounts[
                  mainCategoryByName[lowerCaseName].name
                ] || 0) + 1;
            } else {
              // Unknown category, add to uncategorized
              uncategorizedTotal += amount;
              uncategorizedCount += 1;
            }
          }
        }
      } else {
        // Add to uncategorized totals
        uncategorizedTotal += amount;
        uncategorizedCount += 1;
      }
    });

    if (viewMode === "subcategories") {
      console.log("Category totals:", categoryTotals);
    } else {
      console.log("Main category totals:", mainCategoryTotals);
    }
    console.log(
      "Uncategorized total:",
      uncategorizedTotal,
      "count:",
      uncategorizedCount
    );

    // Calculate total spending
    let categorizedSpending = 0;
    if (viewMode === "subcategories") {
      categorizedSpending = Object.values(categoryTotals).reduce(
        (sum, amount) => sum + amount,
        0
      );
    } else {
      categorizedSpending = Object.values(mainCategoryTotals).reduce(
        (sum, amount) => sum + amount,
        0
      );
    }
    const totalSpending = categorizedSpending + uncategorizedTotal;

    console.log(
      "Total spending calculated:",
      totalSpending,
      "(Categorized:",
      categorizedSpending,
      "Uncategorized:",
      uncategorizedTotal,
      ")"
    );

    // Prepare category summaries first
    let summaries: CategorySummaryData[] = [];

    if (viewMode === "subcategories") {
      // Add categories found in transactions
      Object.keys(categoryTotals).forEach((categoryId, index) => {
        const amount = categoryTotals[categoryId];
        // Try to find matching category from our categories list
        const matchedCategory =
          categoryById[categoryId] ||
          categories.find(
            (c) => c.name.toLowerCase() === categoryId.toLowerCase()
          );

        const name = matchedCategory ? matchedCategory.name : categoryId;
        const icon = matchedCategory?.icon || "shopping-bag"; // Default icon

        summaries.push({
          id: categoryId,
          name: name,
          logo: icon,
          transactionCount: categoryTransactionCounts[categoryId] || 0,
          amount: amount,
          percentage: totalSpending > 0 ? (amount / totalSpending) * 100 : 0,
          color: getColorForIndex(index),
        });
      });
    } else {
      // We're in main categories mode, create summaries for main categories
      Object.keys(mainCategoryTotals).forEach((mainCategoryName, index) => {
        const amount = mainCategoryTotals[mainCategoryName];
        // Find the main category
        const matchedMainCategory = mainCategories.find(
          (mc) => mc.name.toLowerCase() === mainCategoryName.toLowerCase()
        );

        if (matchedMainCategory) {
          summaries.push({
            id: matchedMainCategory.id,
            name: matchedMainCategory.name,
            logo: matchedMainCategory.icon || "category",
            transactionCount:
              mainCategoryTransactionCounts[mainCategoryName] || 0,
            amount: amount,
            percentage: totalSpending > 0 ? (amount / totalSpending) * 100 : 0,
            color: getColorForIndex(index),
          });
        } else {
          // This shouldn't happen often, but handle the case where the main category isn't found
          summaries.push({
            id: `main-${mainCategoryName}`,
            name: mainCategoryName,
            logo: "category",
            transactionCount:
              mainCategoryTransactionCounts[mainCategoryName] || 0,
            amount: amount,
            percentage: totalSpending > 0 ? (amount / totalSpending) * 100 : 0,
            color: getColorForIndex(index),
          });
        }
      });
    }

    // Add uncategorized if needed
    if (uncategorizedCount > 0) {
      summaries.push({
        id: "uncategorized",
        name: "Uncategorized",
        logo: "help-outline",
        transactionCount: uncategorizedCount,
        amount: uncategorizedTotal,
        percentage:
          totalSpending > 0 ? (uncategorizedTotal / totalSpending) * 100 : 0,
        color: "#888888",
      });
    }

    // Sort summaries by amount
    summaries = summaries.sort((a, b) => b.amount - a.amount);

    console.log("Final summary items:", summaries.length);

    // Now prepare pie chart data from the summaries
    const pieData = summaries.map((item) => ({
      name: item.name,
      amount: item.amount,
      color: item.color,
      legendFontColor: "#FFFFFF",
      legendFontSize: 12,
    }));

    console.log("Pie data items:", pieData.length);

    return { categorySummaries: summaries, pieData };
  };

  // Helper function to round to nearest multiple of 50
  const roundToNearest50 = (value: number): number => {
    return Math.round(value / 50) * 50;
  };

  // Helper function to round array of values to nearest multiple of 50
  const roundArrayToNearest50 = (values: number[]): number[] => {
    return values.map((value) => roundToNearest50(value));
  };

  // Helper function to calculate nice y-axis interval
  const calculateNiceInterval = (maxValue: number): number => {
    const roundedMax = roundToNearest50(maxValue);
    const magnitude = Math.pow(10, Math.floor(Math.log10(roundedMax)));
    const ratio = roundedMax / magnitude;

    let interval;
    if (ratio < 1.5) interval = magnitude / 5;
    else if (ratio < 3) interval = magnitude / 2;
    else if (ratio < 7) interval = magnitude;
    else interval = magnitude * 2;

    return roundToNearest50(interval);
  };

  // Helper function to find the closest data point for a given x coordinate
  const findClosestDataPoint = (x: number) => {
    if (!spendingOverTime.current.length) return null;

    // Chart layout constants based on react-native-chart-kit's internal layout
    const yAxisWidth = 54; // Width reserved for Y-axis labels
    const chartAreaWidth = chartWidth - yAxisWidth;

    // Adjust x to account for Y-axis
    const adjustedX = x - yAxisWidth;

    // If touch is outside actual chart area, return null
    if (adjustedX < 0 || adjustedX > chartAreaWidth) return null;

    const dataPoints = spendingOverTime.current.length;
    // Calculate segment width based on available space
    const segmentWidth = chartAreaWidth / dataPoints;

    // Find the closest data point
    const index = Math.round(adjustedX / segmentWidth);
    if (index < 0 || index >= dataPoints) return null;

    // Calculate exact X position (from left edge of container)
    const exactX = yAxisWidth + index * segmentWidth;

    // Calculate Y position
    const chartHeight = 220;
    const topPadding = 30;
    const bottomPadding = 40;
    const availableHeight = chartHeight - topPadding - bottomPadding;

    const maxValue = Math.max(...spendingOverTime.current, 1);
    const value = spendingOverTime.current[index];
    const percentOfMax = value / maxValue;

    // Y position calculation with proper scaling
    const exactY = topPadding + availableHeight * (1 - percentOfMax);

    return {
      index,
      value: spendingOverTime.current[index],
      label: spendingOverTime.labels[index],
      exactX: exactX,
      exactY: exactY,
    };
  };

  // Function to fetch transactions with caching
  const fetchTransactionsWithCache = async (
    timeFrame: "week" | "month" | "6months" | "year"
  ): Promise<Transaction[]> => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      throw new Error("User not logged in");
    }

    // Get date range for the timeframe
    const { currentStart, currentEnd } = getDateRanges(timeFrame);

    // Clean up expired caches first
    cleanupExpiredCache();

    // Check if we have a valid cache
    const cacheKey = `${timeFrame}-${userId}`;
    const cache = transactionCache[cacheKey];
    const now = Date.now();

    // If cache exists, is not expired, and date range matches
    if (
      cache &&
      now - cache.lastUpdated < CACHE_CONFIG.expiryTime &&
      cache.startDate.getTime() === currentStart.getTime() &&
      cache.endDate.getTime() === currentEnd.getTime()
    ) {
      console.log(`Using cached transactions for ${timeFrame}:`, {
        count: cache.transactions.length,
        dateRange: {
          start: cache.startDate.toISOString(),
          end: cache.endDate.toISOString(),
        },
        lastUpdated: new Date(cache.lastUpdated).toISOString(),
      });

      // Update last accessed time for LRU tracking
      transactionCache[cacheKey].lastAccessed = now;

      return cache.transactions;
    }

    // If no valid cache, fetch new data
    console.log(`Fetching fresh transactions for ${timeFrame}`);
    try {
      // Use the new method to fetch transactions with server-side filtering
      const filteredTransactions =
        await TransactionService.getTransactionsByDateRange(
          userId,
          currentStart,
          currentEnd
        );

      console.log(
        `Retrieved ${filteredTransactions.length} transactions for ${timeFrame}`
      );

      // Trim the transactions if there are too many
      const trimmedTransactions = trimTransactionCache(filteredTransactions);

      // Update the cache
      transactionCache[cacheKey] = {
        transactions: trimmedTransactions,
        lastUpdated: now,
        lastAccessed: now,
        startDate: currentStart,
        endDate: currentEnd,
      };

      // Enforce cache limits
      enforceCacheLimits();

      return trimmedTransactions;
    } catch (error) {
      console.error("Error fetching transactions:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to fetch transactions",
      });
      return [];
    }
  };

  // Function to invalidate cache
  const invalidateTransactionCache = (
    timeFrame?: "week" | "month" | "6months" | "year"
  ) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    if (timeFrame) {
      // Invalidate specific timeframe cache
      const cacheKey = `${timeFrame}-${userId}`;
      delete transactionCache[cacheKey];
    } else {
      // Invalidate all caches for this user
      for (const key in transactionCache) {
        if (key.includes(userId)) {
          delete transactionCache[key];
        }
      }
    }
  };

  // Function to clear cache when app goes to background
  const clearCacheOnBackground = () => {
    console.log("App entering background, clearing transaction cache");
    Object.keys(transactionCache).forEach((key) => {
      delete transactionCache[key];
    });
  };

  const handleTimeFrameChange = (
    newTimeFrame: "week" | "month" | "6months" | "year"
  ) => {
    console.log(`[Dashboard] Time frame changed to ${newTimeFrame}`);
    setIsLoading(true);
    setTimeFrame(newTimeFrame);
    // fetchDashboardData will be triggered by the useEffect that watches timeFrame
  };

  useEffect(() => {
    console.log(
      `Timeframe changed to ${timeFrame}, fetching dashboard data...`
    );

    // Check if we have preloaded data first
    const preloadedTimeframe = PreloadService.getLastTimeframe();
    if (timeFrame === preloadedTimeframe) {
      const preloadedData = PreloadService.getPreloadedAggregations(timeFrame);
      const preloadedTransactions =
        PreloadService.getPreloadedTransactions(timeFrame);

      if (preloadedData && preloadedTransactions) {
        console.log("Using preloaded dashboard data!");
        setHasPreloadedData(true);
      }
    }

    fetchDashboardData();
  }, [timeFrame]);

  // Add effect to recalculate category data when view mode changes
  useEffect(() => {
    console.log(
      `Category view mode changed to ${categoryViewMode}, refreshing category data...`
    );
    // Only update if we already have transactions cached
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    // Mark the category data as loading during update
    setIsCategoryLoading(true);

    const cacheKey = `${timeFrame}-${userId}`;
    const cache = transactionCache[cacheKey];

    (async () => {
      try {
        // Check for preloaded transactions first
        let transactions: Transaction[] = [];

        if (PreloadService.getPreloadedTransactions(timeFrame)) {
          transactions = PreloadService.getPreloadedTransactions(
            timeFrame
          ) as Transaction[];
          console.log(
            `Using ${transactions.length} preloaded transactions for category view update`
          );
        } else if (cache && cache.transactions.length > 0) {
          transactions = cache.transactions;
          console.log(
            `Using ${transactions.length} cached transactions for category view update`
          );
        } else {
          // Fallback to fetching if needed
          transactions = await fetchTransactionsWithCache(timeFrame);
          console.log(
            `Fetched ${transactions.length} transactions for category view update`
          );
        }

        if (transactions.length > 0) {
          const { categorySummaries: summaries, pieData: categoryData } =
            await prepareCategorySummaryFromTransactions(
              transactions,
              categoryViewMode
            );

          console.log(
            `Updated category summaries for ${categoryViewMode} view with ${summaries.length} items`
          );
          console.log(`Updated pie data with ${categoryData.length} items`);

          setCategorySummaries(summaries.length > 0 ? summaries : []);
          setPieData(categoryData);
        }
      } catch (error) {
        console.error("Error refreshing category data:", error);

        // Use empty arrays if there was an error
        setCategorySummaries([]);
        setPieData([]);
      } finally {
        setIsCategoryLoading(false);
      }
    })();
  }, [categoryViewMode, timeFrame]);

  // Add a new useEffect for AppState monitoring
  useEffect(() => {
    // Set up AppState listener for background state
    const appStateListener = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (nextAppState === "background") {
          console.log("App going to background, clearing transaction cache");
          clearCacheOnBackground();
        }
      }
    );

    // Clear any expired cache entries on component mount
    cleanupExpiredCache();

    // Cleanup function
    return () => {
      appStateListener.remove();
    };
  }, []);

  const fetchDashboardData = async (isRefreshing = false): Promise<void> => {
    console.log(
      `[Dashboard] Fetching dashboard data for timeframe: ${timeFrame}`
    );
    setIsLoading(true);

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.error("[Dashboard] No user ID found for dashboard data fetch");
        setIsLoading(false);
        return;
      }

      const { currentStart, currentEnd, previousStart, previousEnd } =
        getDateRanges(timeFrame);

      // Check if we have preloaded transactions and use them if available
      const preloadedTransactions =
        PreloadService.getPreloadedTransactions(timeFrame);
      if (
        preloadedTransactions &&
        preloadedTransactions.length > 0 &&
        !isRefreshing
      ) {
        console.log(
          `[Dashboard] Using ${preloadedTransactions.length} preloaded transactions`
        );

        // Store transactions for recent transactions display
        setCurrentTransactions(preloadedTransactions);

        // For subcategory view, get aggregations
        if (categoryViewMode === "subcategories") {
          const preloadedAggregations =
            PreloadService.getPreloadedAggregations(timeFrame);

          if (preloadedAggregations) {
            console.log(
              `[Dashboard] Using preloaded aggregations for ${timeFrame}`
            );

            // Process aggregations for charts and category data
            processAggregations(preloadedAggregations.current);
            prepareRecentTransactions(preloadedTransactions);

            setIsLoading(false);
            return;
          }
        } else {
          // For main category view, use the transactions directly
          processMainCategoryData(preloadedTransactions);
          prepareRecentTransactions(preloadedTransactions);

          setIsLoading(false);
          return;
        }
      }

      // If we get here, we need to fetch fresh data
      console.log(`[Dashboard] Fetching fresh data for ${timeFrame}`);
      let currentTransactionsData: Transaction[] = [];
      let previousTransactionsData: Transaction[] = [];

      try {
        // Fetch transactions for both periods
        [currentTransactionsData, previousTransactionsData] = await Promise.all(
          [
            TransactionService.getTransactionsByDateRange(
              userId,
              currentStart,
              currentEnd
            ),
            TransactionService.getTransactionsByDateRange(
              userId,
              previousStart,
              previousEnd
            ),
          ]
        );

        console.log(
          `[Dashboard] Fetched ${currentTransactionsData.length} current and ${previousTransactionsData.length} previous transactions`
        );

        setCurrentTransactions(currentTransactionsData);
        setPreviousTransactions(previousTransactionsData);
        prepareRecentTransactions(currentTransactionsData);
      } catch (error) {
        console.error("[Dashboard] Error fetching transactions:", error);
        setCurrentTransactions([]);
        setPreviousTransactions([]);
      }

      // For subcategory view, fetch and process daily aggregations
      if (categoryViewMode === "subcategories") {
        try {
          const [currentAggregations, previousAggregations] = await Promise.all(
            [
              DailyAggregationService.getDailyAggregations(
                userId,
                currentStart,
                currentEnd
              ),
              DailyAggregationService.getDailyAggregations(
                userId,
                previousStart,
                previousEnd
              ),
            ]
          );

          console.log(
            `[Dashboard] Fetched ${currentAggregations.length} current aggregations`
          );

          processAggregations(currentAggregations);

          // Cache the data for future use
          if (
            currentAggregations.length > 0 &&
            currentTransactionsData.length > 0
          ) {
            PreloadService.preloadDashboardData(timeFrame);
          }
        } catch (error) {
          console.error("[Dashboard] Error fetching aggregations:", error);
          setPieData([]);
          setCategorySummaries([]);
          setSpendingData({
            currentPeriod: [],
            previousPeriod: [],
            averageSpending: 0,
            percentageChange: 0,
            maxValue: 0,
          });
        }
      } else {
        // For main category view, process transactions directly
        processMainCategoryData(currentTransactionsData);
      }
    } catch (error) {
      console.error("[Dashboard] Error in fetchDashboardData:", error);
      // Reset all state with empty values
      setCurrentTransactions([]);
      setPreviousTransactions([]);
      setRecentTransactions([]);
      setPieData([]);
      setCategorySummaries([]);
      setSpendingData({
        currentPeriod: [],
        previousPeriod: [],
        averageSpending: 0,
        percentageChange: 0,
        maxValue: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fix the processAggregations function
  const processAggregations = (aggregations: DailyAggregation[]): void => {
    try {
      if (!aggregations || aggregations.length === 0) {
        console.log("[Dashboard] No aggregations to process");
        setPieData([]);
        setCategorySummaries([]);
        setSpendingData({
          currentPeriod: [],
          previousPeriod: [],
          averageSpending: 0,
          percentageChange: 0,
          maxValue: 0,
        });
        return;
      }

      console.log(`[Dashboard] Processing ${aggregations.length} aggregations`);

      // Process spending data for charts
      processSpendingData(aggregations);

      // Process category data
      processCategoryData(aggregations);
    } catch (error) {
      console.error("[Dashboard] Error processing aggregations:", error);
      setPieData([]);
      setCategorySummaries([]);
    }
  };

  // Fix the processSpendingData function to properly handle the DailyAggregation type
  const processSpendingData = (aggregations: DailyAggregation[]): void => {
    try {
      // Sort aggregations by date
      const sortedAggregations = [...aggregations].sort(
        (a, b) => a.date.toDate().getTime() - b.date.toDate().getTime()
      );

      // Map to data points for chart
      const dataPoints = sortedAggregations.map((agg) => ({
        date: agg.date.toDate().toISOString().split("T")[0],
        amount: roundToTwoDecimals(agg.totalExpenses || 0),
      }));

      // Calculate average spending
      const totalSpending = dataPoints.reduce(
        (sum, point) => sum + point.amount,
        0
      );
      const averageSpending =
        dataPoints.length > 0
          ? roundToTwoDecimals(totalSpending / dataPoints.length)
          : 0;

      // Find max value for y-axis scaling
      const maxValue = Math.max(
        ...dataPoints.map((point) => point.amount),
        1 // Minimum to avoid division by zero
      );

      setSpendingData({
        currentPeriod: dataPoints,
        previousPeriod: [], // We don't have comparable previous data in the right format
        averageSpending,
        percentageChange: 0, // Can't calculate without comparable previous data
        maxValue,
      });
    } catch (error) {
      console.error("[Dashboard] Error processing spending data:", error);
      setSpendingData({
        currentPeriod: [],
        previousPeriod: [],
        averageSpending: 0,
        percentageChange: 0,
        maxValue: 0,
      });
    }
  };

  // Process category data from aggregations
  const processCategoryData = (aggregations: DailyAggregation[]): void => {
    try {
      // Group by category ID and sum expenses
      const categoryTotals: Record<string, number> = {};
      const categoryTransactionCounts: Record<string, number> = {};

      for (const agg of aggregations) {
        if (agg.categoryId) {
          if (!categoryTotals[agg.categoryId]) {
            categoryTotals[agg.categoryId] = 0;
            categoryTransactionCounts[agg.categoryId] = 0;
          }

          categoryTotals[agg.categoryId] += agg.totalExpenses || 0;
          categoryTransactionCounts[agg.categoryId] +=
            agg.transactionCount || 0;
        }
      }

      // Get categories to map IDs to names
      CategoryService.getUserCategories(auth.currentUser?.uid || "")
        .then((categories) => {
          const categoryMap = new Map(categories.map((cat) => [cat.id, cat]));

          // Generate pie chart data
          const pieData = Object.entries(categoryTotals)
            .filter(([_, amount]) => amount > 0)
            .map(([categoryId, amount], index) => {
              const category = categoryMap.get(categoryId);
              return {
                name: category?.name || "Unknown",
                amount,
                color: getColorForIndex(index),
                legendFontColor: "#FFFFFF",
                legendFontSize: 12,
              };
            })
            .sort((a, b) => b.amount - a.amount);

          // Calculate total spending for percentages
          const totalSpending = pieData.reduce(
            (sum, item) => sum + item.amount,
            0
          );

          // Generate category summaries
          const summaries = Object.entries(categoryTotals)
            .filter(([_, amount]) => amount > 0)
            .map(([categoryId, amount], index) => {
              const category = categoryMap.get(categoryId);
              return {
                id: categoryId,
                name: category?.name || "Unknown",
                logo: category?.icon || "question-mark",
                transactionCount: categoryTransactionCounts[categoryId] || 0,
                amount,
                percentage:
                  totalSpending > 0
                    ? Math.round((amount / totalSpending) * 100)
                    : 0,
                color: getColorForIndex(index),
              };
            })
            .sort((a, b) => b.amount - a.amount);

          console.log(
            `[Dashboard] Generated ${pieData.length} pie chart items from aggregations`
          );

          // Update state with new data
          setPieData(pieData);
          setCategorySummaries(summaries);
        })
        .catch((error) => {
          console.error("[Dashboard] Error fetching categories:", error);
          setPieData([]);
          setCategorySummaries([]);
        });
    } catch (error) {
      console.error("[Dashboard] Error processing category data:", error);
      setPieData([]);
      setCategorySummaries([]);
    }
  };

  // Fix the processMainCategoryData function
  const processMainCategoryData = async (
    transactions: Transaction[]
  ): Promise<void> => {
    try {
      if (!transactions || transactions.length === 0) {
        console.log("[Dashboard] No transactions for main category processing");
        setPieData([]);
        setCategorySummaries([]);
        return;
      }

      console.log(
        `[Dashboard] Processing ${transactions.length} transactions for main categories`
      );

      // Get categories and main categories
      const [categories, mainCategories] = await Promise.all([
        CategoryService.getUserCategories(auth.currentUser?.uid || ""),
        CategoryService.getUserMainCategories(auth.currentUser?.uid || ""),
      ]);

      // Create lookup maps
      const categoryMap = new Map(categories.map((cat) => [cat.id, cat]));
      const mainCategoryMap = new Map(
        mainCategories.map((mainCat) => [mainCat.id, mainCat])
      );

      // Create category-to-main-category mapping
      const categoryToMainCategory = new Map();
      categories.forEach((cat) => {
        if (cat.mainCategory) {
          // Use mainCategory instead of mainCategoryId
          categoryToMainCategory.set(cat.id, cat.mainCategory);
        }
      });

      // Filter expense transactions
      const expenseTransactions = transactions.filter(
        (t) => t.transactionType === "expense" && t.amount > 0
      );

      // Group by main category and sum expenses
      const mainCategoryTotals: Record<string, number> = {};
      const mainCategoryTransactionCounts: Record<string, number> = {};

      for (const transaction of expenseTransactions) {
        const categoryId = transaction.categoryId;
        const mainCategoryId = categoryToMainCategory.get(categoryId);

        if (mainCategoryId) {
          if (!mainCategoryTotals[mainCategoryId]) {
            mainCategoryTotals[mainCategoryId] = 0;
            mainCategoryTransactionCounts[mainCategoryId] = 0;
          }

          mainCategoryTotals[mainCategoryId] += transaction.amount;
          mainCategoryTransactionCounts[mainCategoryId]++;
        }
      }

      // Generate pie chart data
      const pieData = Object.entries(mainCategoryTotals)
        .filter(([_, amount]) => amount > 0)
        .map(([mainCategoryId, amount], index) => {
          const mainCategory = mainCategoryMap.get(mainCategoryId);
          return {
            name: mainCategory?.name || "Unknown",
            amount,
            color: getColorForIndex(index),
            legendFontColor: "#FFFFFF",
            legendFontSize: 12,
          };
        })
        .sort((a, b) => b.amount - a.amount);

      // Calculate total spending for percentages
      const totalSpending = pieData.reduce((sum, item) => sum + item.amount, 0);

      // Generate category summaries
      const summaries = Object.entries(mainCategoryTotals)
        .filter(([_, amount]) => amount > 0)
        .map(([mainCategoryId, amount], index) => {
          const mainCategory = mainCategoryMap.get(mainCategoryId);
          return {
            id: mainCategoryId,
            name: mainCategory?.name || "Unknown",
            logo: mainCategory?.icon || "question-mark",
            transactionCount:
              mainCategoryTransactionCounts[mainCategoryId] || 0,
            amount,
            percentage:
              totalSpending > 0
                ? Math.round((amount / totalSpending) * 100)
                : 0,
            color: getColorForIndex(index),
          };
        })
        .sort((a, b) => b.amount - a.amount);

      console.log(
        `[Dashboard] Generated ${pieData.length} pie chart items for main categories`
      );

      // Update state with new data
      setPieData(pieData);
      setCategorySummaries(summaries);
    } catch (error) {
      console.error("[Dashboard] Error processing main category data:", error);
      setPieData([]);
      setCategorySummaries([]);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);

    // Invalidate cache on manual refresh
    invalidateTransactionCache(timeFrame);

    // Also clear preloaded data
    PreloadService.clearAllPreloadedData();

    // Start a fresh preload in the background for next time
    const userId = auth.currentUser?.uid;
    if (userId) {
      PreloadService.preloadDashboardData(timeFrame, true).catch((error) => {
        console.error("Error preloading data during refresh:", error);
      });
    }

    fetchDashboardData();
  };

  const handleChartPress = (chartType: string, data: any) => {
    setSelectedChart(chartType);
    setDetailsData(data);
    setShowDetailsModal(true);
  };

  const renderGraphSelector = () => (
    <View className="w-full items-center mb-4">
      <TouchableOpacity
        onPress={() => {
          setSelectedGraph((prev) => {
            switch (prev) {
              case "spending":
                return "average";
              case "average":
                return "category";
              case "category":
                return "spending";
              default:
                return "spending";
            }
          });
        }}
        className={`px-6 py-3 rounded-full ${
          isDarkMode ? "bg-gray-800" : "bg-gray-100"
        }`}
      >
        <Text
          className={`${
            isDarkMode ? "text-white" : "text-gray-900"
          } font-medium`}
        >
          {selectedGraph === "spending" && "Spending Over Time"}
          {selectedGraph === "average" && "Average Spending"}
          {selectedGraph === "category" && "Category Breakdown"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderSelectedGraph = () => {
    switch (selectedGraph) {
      case "spending":
        return (
          <Animated.View style={{ opacity: fadeAnim, width: "100%" }}>
            <ChartCard title="Spending Over Time">
              <SpendingOverTimeChart
                data={{
                  labels: spendingOverTime.labels,
                  current: spendingOverTime.current,
                }}
                timeFrame={timeFrame}
                onTooltipVisibilityChange={setIsTooltipVisible}
              />
            </ChartCard>
          </Animated.View>
        );
      case "average":
        return (
          <Animated.View style={{ opacity: fadeAnim, width: "100%" }}>
            <ChartCard title="Average Spending Comparison">
              <AverageSpendingChart data={averageSpending} />
            </ChartCard>
          </Animated.View>
        );
      case "category":
        return (
          <Animated.View style={{ opacity: fadeAnim, width: "100%" }}>
            <ChartCard title="Category Breakdown">
              <CategoryBreakdownChart data={pieData} />
            </ChartCard>
          </Animated.View>
        );
      default:
        return null;
    }
  };

  const CategorySummaryCard = () => {
    const { isDarkMode } = useTheme();
    const [showAllCategories, setShowAllCategories] = useState(false);

    console.log("CategorySummaryCard rendering with data:", {
      summariesLength: categorySummaries.length,
      summaryData: categorySummaries,
    });

    // Limit to first 5 categories initially, then show all if requested
    const displayCategories = showAllCategories
      ? categorySummaries
      : categorySummaries.slice(0, 5);

    // Format currency with comma separators, no decimal places
    const formatCurrency = (amount: number) => {
      return amount
        .toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
        .replace("$", "$ ");
    };

    // Handle category click
    const handleCategoryClick = (category: CategorySummaryData) => {
      setSelectedCategory(category);
      loadCategoryTransactions(category.id, category.name);
      setShowCategoryTransactionsModal(true);
    };

    return (
      <ChartCard
        title={`Top Categories - ${
          categoryViewMode === "subcategories"
            ? "Subcategories"
            : "Main Categories"
        }`}
      >
        <View className="w-full">
          {isCategoryLoading ? (
            <View className="py-8 items-center">
              <ActivityIndicator
                size="large"
                color={isDarkMode ? "#3B82F6" : "#1D4ED8"}
              />
              <Text
                className={`mt-2 ${
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                Updating category data...
              </Text>
            </View>
          ) : (
            <>
              {displayCategories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => handleCategoryClick(category)}
                  activeOpacity={0.7}
                >
                  <View
                    className={`flex-row justify-between items-center py-3 ${
                      category.id !==
                      displayCategories[displayCategories.length - 1].id
                        ? `border-b ${
                            isDarkMode ? "border-gray-700" : "border-gray-200"
                          }`
                        : ""
                    }`}
                  >
                    {/* Left side - Icon, Category Name and Transaction Count */}
                    <View className="flex-row items-center flex-1">
                      <View
                        className="w-10 h-10 rounded-full justify-center items-center mr-3"
                        style={{ backgroundColor: category.color }}
                      >
                        <MaterialIcons
                          name={category.logo as any}
                          size={20}
                          color="white"
                        />
                      </View>
                      <View>
                        <Text
                          className={`font-medium ${
                            isDarkMode ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {category.name}
                        </Text>
                        <Text
                          className={`text-xs ${
                            isDarkMode ? "text-gray-400" : "text-gray-500"
                          }`}
                        >
                          {category.transactionCount}{" "}
                          {category.transactionCount === 1
                            ? "Transaction"
                            : "Transactions"}
                        </Text>
                      </View>
                    </View>

                    {/* Right side - Amount and Percentage */}
                    <View className="items-end">
                      <Text
                        className={`font-medium ${
                          isDarkMode ? "text-white" : "text-gray-900"
                        }`}
                      >
                        {formatCurrency(category.amount)}
                      </Text>
                      <Text
                        className={`text-xs ${
                          isDarkMode ? "text-gray-400" : "text-gray-500"
                        }`}
                      >
                        {category.percentage < 1
                          ? category.percentage.toFixed(1)
                          : category.percentage.toFixed(0)}
                        %
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}

              {categorySummaries.length > 5 && (
                <TouchableOpacity
                  onPress={() => setShowAllCategories(!showAllCategories)}
                  className={`py-3 items-center mt-2 ${
                    isDarkMode ? "bg-gray-800" : "bg-gray-100"
                  } rounded-lg`}
                >
                  <Text
                    className={`font-medium ${
                      isDarkMode ? "text-blue-400" : "text-blue-600"
                    }`}
                  >
                    {showAllCategories
                      ? "Show Less"
                      : `View All (${categorySummaries.length})`}
                  </Text>
                </TouchableOpacity>
              )}

              {categorySummaries.length === 0 && (
                <View className="py-8 items-center">
                  <Text
                    className={`${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    No category spending data for this period
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </ChartCard>
    );
  };

  // Add the missing prepareRecentTransactions function if needed
  const prepareRecentTransactions = (transactions: Transaction[]): void => {
    try {
      if (!transactions || transactions.length === 0) {
        setRecentTransactions([]);
        return;
      }

      // Sort by date, newest first
      const sortedTransactions = [...transactions]
        .sort((a: Transaction, b: Transaction) => b.date.toDate().getTime() - a.date.toDate().getTime())
        .slice(0, 5); // Take only the 5 most recent

      setRecentTransactions(sortedTransactions);
    } catch (error) {
      console.error("[Dashboard] Error preparing recent transactions:", error);
      setRecentTransactions([]);
    }
  };

  // Add a helper function to calculate spending data safely
  const calculateSpendingForTimeframe = (
    transactions: Transaction[],
    startDate: Date,
    endDate: Date
  ) => {
    try {
      if (!transactions.length) return { total: 0, average: 0, dataPoints: [] };

      // Filter expense transactions
      const expenses = transactions.filter(
        (t) => t.transactionType === "expense"
      );

      // Calculate total spending
      const totalSpending = expenses.reduce((sum, t) => sum + t.amount, 0);

      // Count number of days in time period
      const days = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate average daily spending
      const averageSpending = days > 0 ? totalSpending / days : 0;

      return {
        total: Math.round(totalSpending * 100) / 100,
        average: Math.round(averageSpending * 100) / 100,
        dataPoints: [],
      };
    } catch (error) {
      console.error("[Dashboard] Error calculating spending:", error);
      return { total: 0, average: 0, dataPoints: [] };
    }
  };

  // Fix the function for updating transaction cache
  const updateTransactionCache = (
    timeFrame: "week" | "month" | "6months" | "year",
    transactions: Transaction[]
  ): void => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const now = Date.now();
    const { currentStart, currentEnd } = getDateRanges(timeFrame);
    const cacheKey = `${timeFrame}-${userId}`;

    // Update the cache
    transactionCache[cacheKey] = {
      transactions: trimTransactionCache(transactions),
      lastUpdated: now,
      lastAccessed: now,
      startDate: currentStart,
      endDate: currentEnd,
    };

    // Enforce cache limits
    enforceCacheLimits();
  };

  // Add function to load transactions for a specific category
  const loadCategoryTransactions = async (
    categoryId: string,
    categoryName: string
  ) => {
    setIsCategoryTransactionsLoading(true);

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error("User not logged in");
      }

      const { currentStart, currentEnd } = getDateRanges(timeFrame);

      // Directly fetch transactions filtered by both timeframe and category
      console.log(`Fetching transactions for category ${categoryName} in ${timeFrame} timeframe`);
      const transactions = await TransactionService.getTransactionsByCategoryAndDateRange(
        userId,
        categoryId,
        currentStart,
        currentEnd
      );

      // Sort transactions by date (newest first)
      const sortedTransactions = transactions.sort(
        (a: Transaction, b: Transaction) => b.date.toDate().getTime() - a.date.toDate().getTime()
      );

      console.log(
        `Found ${sortedTransactions.length} transactions for category ${categoryName}`
      );
      setCategoryTransactions(sortedTransactions);
    } catch (error) {
      console.error("Error loading category transactions:", error);
      setCategoryTransactions([]);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to load category transactions",
      });
    } finally {
      setIsCategoryTransactionsLoading(false);
    }
  };

  // Create component for transaction item in the modal
  const TransactionItem = ({ transaction }: { transaction: Transaction }) => {
    // Format date as MM/DD/YYYY
    const formatDate = (timestamp: Timestamp) => {
      const date = timestamp.toDate();
      return date.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });
    };

    // Format currency with comma separators
    const formatCurrency = (amount: number) => {
      return amount
        .toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })
        .replace("$", "$ ");
    };

    return (
      <View
        className={`flex-row justify-between items-center py-3 border-b ${
          isDarkMode ? "border-gray-700" : "border-gray-200"
        }`}
      >
        <View className="flex-1">
          <Text
            className={`font-medium ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            {transaction.description || "Unknown"}
          </Text>
          <Text
            className={`text-xs ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            {formatDate(transaction.date)}
          </Text>
        </View>
        <Text
          className={`font-medium ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          {formatCurrency(Math.abs(transaction.amount))}
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <Animated.View
        className={`flex-1 ${isDarkMode ? "bg-[#0A0F1F]" : "bg-white"}`}
        style={{
          opacity: fadeAnim,
        }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingVertical: 20,
            paddingHorizontal: 0,
            alignItems: "center",
          }}
        >
          {/* Spent This Month Widget - centered */}
          <Pressable>
            <View className="w-full items-center mb-4">
              <SpentThisMonthWidget timeFrame={timeFrame} />
            </View>
          </Pressable>

          {/* Time Frame Selector - centered */}
          <View className="w-full flex-row justify-center space-x-2 mb-6">
            {["week", "month", "6months", "year"].map((period) => (
              <TouchableOpacity
                key={period}
                onPress={() => handleTimeFrameChange(period as any)}
                className={`px-4 py-2 rounded-full ${
                  timeFrame === period
                    ? isDarkMode
                      ? "bg-blue-600"
                      : "bg-blue-500"
                    : isDarkMode
                    ? "bg-gray-700"
                    : "bg-gray-200"
                }`}
              >
                <Text
                  className={`${
                    isDarkMode ? "text-white" : "text-gray-900"
                  } text-center`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Graph Selector */}
          {renderGraphSelector()}

          {/* Selected Graph */}
          {renderSelectedGraph()}
        </ScrollView>
      </Animated.View>
    );
  }

  return (
    <ScrollView
      className={isDarkMode ? "bg-[#0A0F1F]" : "bg-white"}
      contentContainerStyle={{
        paddingVertical: 20,
        paddingHorizontal: 0,
        alignItems: "center",
      }}
      scrollEnabled={!isTooltipVisible}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={isDarkMode ? "#3B82F6" : "#1D4ED8"}
        />
      }
    >
      {/* Spent This Month Widget - centered */}
      <View className="w-full items-center mb-4">
        <SpentThisMonthWidget timeFrame={timeFrame} />
      </View>

      {/* Time Frame Selector - centered */}
      <View className="w-full flex-row justify-center space-x-2 mb-6">
        {["week", "month", "6months", "year"].map((period) => (
          <TouchableOpacity
            key={period}
            onPress={() => handleTimeFrameChange(period as any)}
            className={`px-4 py-2 rounded-full ${
              timeFrame === period
                ? isDarkMode
                  ? "bg-blue-600"
                  : "bg-blue-500"
                : isDarkMode
                ? "bg-gray-700"
                : "bg-gray-200"
            }`}
          >
            <Text
              className={`${
                isDarkMode ? "text-white" : "text-gray-900"
              } text-center`}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Graph Selector */}
      {renderGraphSelector()}

      {/* Selected Graph */}
      {renderSelectedGraph()}

      {/* Category View Mode Selector */}
      <View className="w-full px-4 mt-4 mb-2">
        <View className="flex-row justify-between items-center">
          <Text
            className={`text-base font-medium ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}
          >
            Categories View
          </Text>

          {/* Enhanced Dropdown Menu */}
          <View className="relative">
            <TouchableOpacity
              className={`py-2 px-4 rounded-lg flex-row items-center ${
                isDarkMode ? "bg-gray-800" : "bg-gray-100"
              }`}
              onPress={() => {
                // Instead of immediately changing the mode, show dropdown options
                setShowCategoryDropdown((prev) => !prev);
              }}
            >
              <Text
                className={`mr-2 ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}
              >
                {categoryViewMode === "subcategories"
                  ? "By Subcategories"
                  : "By Main Categories"}
              </Text>
              <MaterialIcons
                name={
                  showCategoryDropdown ? "arrow-drop-up" : "arrow-drop-down"
                }
                size={20}
                color={isDarkMode ? "#FFFFFF" : "#1F2937"}
              />
            </TouchableOpacity>

            {/* Dropdown Menu Options */}
            {showCategoryDropdown && (
              <View
                className={`absolute top-10 right-0 w-48 rounded-md shadow-lg z-10 ${
                  isDarkMode ? "bg-gray-700" : "bg-white"
                }`}
                style={{
                  elevation: 5,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 3.84,
                }}
              >
                <TouchableOpacity
                  className={`px-4 py-3 ${
                    categoryViewMode === "subcategories"
                      ? isDarkMode
                        ? "bg-gray-600"
                        : "bg-gray-100"
                      : ""
                  }`}
                  onPress={() => {
                    setCategoryViewMode("subcategories");
                    setShowCategoryDropdown(false);
                  }}
                >
                  <Text className={isDarkMode ? "text-white" : "text-gray-800"}>
                    By Subcategories
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`px-4 py-3 ${
                    categoryViewMode === "main"
                      ? isDarkMode
                        ? "bg-gray-600"
                        : "bg-gray-100"
                      : ""
                  }`}
                  onPress={() => {
                    setCategoryViewMode("main");
                    setShowCategoryDropdown(false);
                  }}
                >
                  <Text className={isDarkMode ? "text-white" : "text-gray-800"}>
                    By Main Categories
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Category Summary Card */}
      <View className="w-full items-center px-4">
        {/* Console log for debugging */}
        {(() => {
          console.log("Rendering CategorySummaryCard in the layout");
          return null;
        })()}
        <CategorySummaryCard />
      </View>

      {/* Category Transactions Modal */}
      <Modal
        visible={showCategoryTransactionsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryTransactionsModal(false)}
      >
        <View className="flex-1 justify-end">
          <View
            className={`rounded-t-3xl p-6 ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            }`}
            style={{ maxHeight: "80%" }}
          >
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row items-center">
                {selectedCategory && (
                  <>
                    <View
                      className="w-8 h-8 rounded-full justify-center items-center mr-2"
                      style={{ backgroundColor: selectedCategory.color }}
                    >
                      <MaterialIcons
                        name={selectedCategory.logo as any}
                        size={16}
                        color="white"
                      />
                    </View>
                    <Text
                      className={`text-xl font-bold ${
                        isDarkMode ? "text-gray-200" : "text-gray-900"
                      }`}
                    >
                      {selectedCategory.name}
                    </Text>
                  </>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setShowCategoryTransactionsModal(false)}
              >
                <MaterialIcons
                  name="close"
                  size={24}
                  color={isDarkMode ? "#E5E7EB" : "#1F2937"}
                />
              </TouchableOpacity>
            </View>

            {/* Category statistics summary */}
            {selectedCategory && (
              <View
                className={`mb-4 p-3 rounded-lg ${
                  isDarkMode ? "bg-gray-700" : "bg-gray-100"
                }`}
              >
                <View className="flex-row justify-between">
                  <Text
                    className={isDarkMode ? "text-gray-300" : "text-gray-600"}
                  >
                    Total Spent:
                  </Text>
                  <Text
                    className={`font-bold ${
                      isDarkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {selectedCategory.amount.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </View>
                <View className="flex-row justify-between mt-1">
                  <Text
                    className={isDarkMode ? "text-gray-300" : "text-gray-600"}
                  >
                    Transactions:
                  </Text>
                  <Text
                    className={`font-bold ${
                      isDarkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {selectedCategory.transactionCount}
                  </Text>
                </View>
              </View>
            )}

            <Text
              className={`text-lg font-semibold mb-2 ${
                isDarkMode ? "text-gray-300" : "text-gray-800"
              }`}
            >
              Transactions
            </Text>

            {isCategoryTransactionsLoading ? (
              <View className="py-8 items-center">
                <ActivityIndicator
                  size="large"
                  color={isDarkMode ? "#3B82F6" : "#1D4ED8"}
                />
                <Text
                  className={`mt-2 ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Loading transactions...
                </Text>
              </View>
            ) : (
              <ScrollView
                className="max-h-96"
                showsVerticalScrollIndicator={true}
              >
                {categoryTransactions.length > 0 ? (
                  categoryTransactions.map((transaction, index) => (
                    <TransactionItem
                      key={transaction.id || index}
                      transaction={transaction}
                    />
                  ))
                ) : (
                  <View className="py-8 items-center">
                    <Text
                      className={`${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      No transactions found for this category
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Details Modal */}
      <Modal
        visible={showDetailsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View className="flex-1 justify-end">
          <View
            className={`rounded-t-3xl p-6 ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text
                className={`text-xl font-bold ${
                  isDarkMode ? "text-gray-200" : "text-gray-900"
                }`}
              >
                {selectedChart === "spending" && "Spending Details"}
                {selectedChart === "category" && "Category Details"}
                {selectedChart === "distribution" && "Distribution Details"}
                {selectedChart === "accounts" && "Account Details"}
              </Text>
              <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                <MaterialIcons
                  name="close"
                  size={24}
                  color={isDarkMode ? "#E5E7EB" : "#1F2937"}
                />
              </TouchableOpacity>
            </View>

            {/* Render details based on selected chart */}
            {detailsData && (
              <View>
                {/* Add detailed information based on the chart type */}
                <Text
                  className={`text-base ${
                    isDarkMode ? "text-gray-200" : "text-gray-900"
                  }`}
                >
                  Detailed information will be displayed here based on the
                  selected chart.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

export default Dashboard;
