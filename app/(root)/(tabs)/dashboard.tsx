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
import { CategoryService } from "../services/categoryService";
import { BudgetService } from "../services/budgetService";
import Toast from "react-native-toast-message";
import { Transaction, DailyAggregation, Category, MainCategory } from "../firebase/types";
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
  const [currentTransactions, setCurrentTransactions] = useState<Transaction[]>([]);
  const [previousTransactions, setPreviousTransactions] = useState<Transaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
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
  const [pieData, setPieData] = useState<PieChartData[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [categorySummaries, setCategorySummaries] = useState<CategorySummaryData[]>([]);
  const [isCategoryLoading, setIsCategoryLoading] = useState(true);
  const [categoryViewMode, setCategoryViewMode] = useState<"subcategories" | "main">("subcategories");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [hasPreloadedData, setHasPreloadedData] = useState(false);
  const [isCategoriesPreloaded, setIsCategoriesPreloaded] = useState(false);

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

  // Add new state for category view
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
        `[Dashboard] Preparing category data from ${aggregations?.length || 0} aggregations`
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

      console.log("[Dashboard] Category totals:", categoryTotals);

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

  // Update the prepareCategorySummaryFromTransactions function to handle the relationship between categories and main categories
  const prepareCategorySummaryFromTransactions = async (
    transactions: Transaction[],
    viewMode: "subcategories" | "main" = "subcategories"
  ): Promise<{
    categorySummaries: CategorySummaryData[];
    pieData: PieChartData[];
  }> => {
    try {
      console.log(`[Dashboard] Preparing category summary from ${transactions.length} transactions for ${viewMode} view`);
      
      // Fetch categories and main categories
      const [categories, mainCategories] = await Promise.all([
        PreloadService.getPreloadedCategories() || 
        CategoryService.getUserCategories(auth.currentUser?.uid || ""),
        
        PreloadService.getPreloadedMainCategories() ||
        CategoryService.getUserMainCategories(auth.currentUser?.uid || "")
      ]);

      if (!categories || !mainCategories || categories.length === 0) {
        console.error("[Dashboard] No categories available for processing");
        return { categorySummaries: [], pieData: [] };
      }
      
      // Log the categories and main categories for debugging
      console.log("[Dashboard] Categories and main categories loaded for summary:", {
        categoriesCount: categories.length,
        mainCategoriesCount: mainCategories.length,
        sampleCategories: categories.slice(0, 3).map(c => ({ id: c.id, name: c.name, mainCategory: c.mainCategory })),
        sampleMainCategories: mainCategories.slice(0, 3).map(mc => ({ id: mc.id, name: mc.name }))
      });

      // Create lookup maps
      const categoryMap = new Map(categories.map(cat => [cat.id, cat]));
      const mainCategoryMapById = new Map(mainCategories.map(mc => [mc.id, mc]));
      const mainCategoryMapByName = new Map(mainCategories.map(mc => [mc.name, mc]));
      
      // Create map from category to main category ID
      const categoryToMainCategoryId = new Map();
      
      // Log category mapping for debugging
      let mappedCount = 0;
      let unmappedCount = 0;
      
      categories.forEach(cat => {
        if (cat.mainCategory) {
          // mainCategory field contains the name of the main category
          const mainCat = mainCategoryMapByName.get(cat.mainCategory);
          if (mainCat) {
            categoryToMainCategoryId.set(cat.id, mainCat.id);
            mappedCount++;
          } else {
            unmappedCount++;
          }
        } else {
          unmappedCount++;
        }
      });
      
      console.log(`[Dashboard] Category to main category mapping: ${mappedCount} mapped, ${unmappedCount} unmapped`);

      // Initialize totals
      const categoryTotals: Record<string, number> = {};
      const categoryTransactionCounts: Record<string, number> = {};
      const mainCategoryTotals: Record<string, number> = {};
      const mainCategoryTransactionCounts: Record<string, number> = {};
      
      // Tracking for debugging
      let categorizedCount = 0;
      let uncategorizedCount = 0;

      // Process transactions
      for (const transaction of transactions) {
        // Skip non-expense transactions or those without categoryId
        if (transaction.transactionType !== "expense" || !transaction.categoryId) {
          uncategorizedCount++;
          continue;
        }
        
        const amount = Math.abs(transaction.amount);
        const categoryId = transaction.categoryId;

        if (viewMode === "subcategories") {
          // Process subcategories (regular categories)
          if (categoryMap.has(categoryId)) {
            categoryTotals[categoryId] = (categoryTotals[categoryId] || 0) + amount;
            categoryTransactionCounts[categoryId] = (categoryTransactionCounts[categoryId] || 0) + 1;
            categorizedCount++;
          } else {
            uncategorizedCount++;
          }
        } else {
          // Process main categories
          const mainCategoryId = categoryToMainCategoryId.get(categoryId);
          
          if (mainCategoryId) {
            // We found a mapped main category
            mainCategoryTotals[mainCategoryId] = (mainCategoryTotals[mainCategoryId] || 0) + amount;
            mainCategoryTransactionCounts[mainCategoryId] = (mainCategoryTransactionCounts[mainCategoryId] || 0) + 1;
            categorizedCount++;
          } else if (mainCategoryMapById.has(categoryId)) {
            // The category ID is already a main category ID
            mainCategoryTotals[categoryId] = (mainCategoryTotals[categoryId] || 0) + amount;
            mainCategoryTransactionCounts[categoryId] = (mainCategoryTransactionCounts[categoryId] || 0) + 1;
            categorizedCount++;
          } else {
            uncategorizedCount++;
          }
        }
      }
      
      console.log(`[Dashboard] Transaction categorization: ${categorizedCount} categorized, ${uncategorizedCount} uncategorized`);

      // Generate data based on view mode
      if (viewMode === "subcategories") {
        // Calculate total spending for percentages
        const totalSpending = Object.values(categoryTotals).reduce((sum, amount) => sum + amount, 0);
        
        console.log(`[Dashboard] Category totals:`, {
          categories: Object.keys(categoryTotals).length,
          totalSpending
        });
        
        // Generate summaries for subcategories
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
              percentage: totalSpending > 0 ? Math.round((amount / totalSpending) * 100) : 0,
              color: getColorForIndex(index),
            };
          })
          .sort((a, b) => b.amount - a.amount);

        // Generate pie chart data
        const pieData = summaries.map(item => ({
          name: item.name,
          amount: item.amount,
          color: item.color,
          legendFontColor: "#FFFFFF",
          legendFontSize: 12,
        }));
        
        console.log(`[Dashboard] Generated ${summaries.length} category summaries with ${summaries.filter(s => s.name === "Unknown").length} unknown categories`);

        return { categorySummaries: summaries, pieData };
      } else {
        // Calculate total spending for main categories
        const totalSpending = Object.values(mainCategoryTotals).reduce((sum, amount) => sum + amount, 0);
        
        console.log(`[Dashboard] Main category totals:`, {
          categories: Object.keys(mainCategoryTotals).length,
          totalSpending
        });
        
        // Generate summaries for main categories
        const summaries = Object.entries(mainCategoryTotals)
          .filter(([_, amount]) => amount > 0)
          .map(([mainCategoryId, amount], index) => {
            const mainCategory = mainCategoryMapById.get(mainCategoryId);
            return {
              id: mainCategoryId,
              name: mainCategory?.name || "Unknown Main Category",
              logo: mainCategory?.icon || "priority-high",
              transactionCount: mainCategoryTransactionCounts[mainCategoryId] || 0,
              amount,
              percentage: totalSpending > 0 ? Math.round((amount / totalSpending) * 100) : 0,
              color: getColorForIndex(index),
            };
          })
          .sort((a, b) => b.amount - a.amount);

        // Generate pie chart data
        const pieData = summaries.map(item => ({
          name: item.name,
          amount: item.amount,
          color: item.color,
          legendFontColor: "#FFFFFF",
          legendFontSize: 12,
        }));
        
        console.log(`[Dashboard] Generated ${summaries.length} main category summaries`);

        return { categorySummaries: summaries, pieData };
      }
    } catch (error) {
      console.error("[Dashboard] Error preparing category summary from transactions:", error);
      return { categorySummaries: [], pieData: [] };
    }
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
    const chartAreaWidth = screenWidth - yAxisWidth;

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
    console.log("[Dashboard] App entering background, clearing transaction cache but preserving categories");
    
    // Clear only transaction cache, not categories
    Object.keys(transactionCache).forEach((key) => {
      delete transactionCache[key];
    });
    
    // Use the preload service to clear time-specific data but keep categories
    const timeFrames: ("week" | "month" | "6months" | "year")[] = ["week", "month", "6months", "year"];
    timeFrames.forEach(frame => {
      PreloadService.clearPreloadedData(frame);
    });
  };

  const handleTimeFrameChange = (newTimeFrame: 'week' | 'month' | '6months' | 'year') => {
    console.log("Setting new time frame:", newTimeFrame);
    setTimeFrame(newTimeFrame);
    setIsLoading(true);
    setHasPreloadedData(false);
    setIsCategoriesPreloaded(false);
    fetchDashboardData();
  };

  // Modify the useEffect that watches timeFrame to handle both category view modes
  useEffect(() => {
    console.log(
      `[Dashboard] Timeframe changed to ${timeFrame}, category view mode: ${categoryViewMode}`
    );

    // Always reset loading states when timeFrame changes
    setIsLoading(true);
    setIsCategoryLoading(true);

    // Check if we have preloaded data first
    const preloadedTimeframe = PreloadService.getLastTimeframe();
    console.log("[Dashboard] Preloaded timeframe:", preloadedTimeframe);

    if (timeFrame === preloadedTimeframe) {
      const preloadedData = PreloadService.getPreloadedAggregations(timeFrame);
      const preloadedTransactions = PreloadService.getPreloadedTransactions(timeFrame);

      console.log("[Dashboard] Preloaded data check:", {
        hasAggregations: !!preloadedData?.current,
        hasTransactions: !!preloadedTransactions,
        aggregationsCount: preloadedData?.current?.length || 0,
        transactionsCount: preloadedTransactions?.length || 0
      });

      if (preloadedTransactions && preloadedTransactions.length > 0) {
        console.log("[Dashboard] Using preloaded dashboard data");
        setHasPreloadedData(true);
        setCurrentTransactions(preloadedTransactions);

        // For subcategories, we need aggregations
        if (categoryViewMode === "subcategories" && preloadedData?.current) {
          console.log("[Dashboard] Processing subcategories from preloaded data");
          processAggregations(preloadedData.current);
        } else if (categoryViewMode === "main") {
          // For main categories, process directly from transactions
          console.log("[Dashboard] Processing main categories from preloaded data");
          processMainCategoryData(preloadedTransactions);
        } else {
          // Fallback for subcategories if no aggregations but we have transactions
          console.log("[Dashboard] No preloaded aggregations available, generating from transactions");
          prepareCategorySummaryFromTransactions(preloadedTransactions, categoryViewMode)
            .then(({ categorySummaries, pieData }) => {
              setCategorySummaries(categorySummaries);
              setPieData(pieData);
              
              // Group transactions by time frame for chart
              const current = aggregateTransactionsByPeriod(
                preloadedTransactions.filter(t => t.transactionType === "expense"),
            timeFrame
              );
              
              // Update spending over time data
              setSpendingOverTime({
                current,
                previous: [],
                labels: getTimeFrameLabels(timeFrame),
              });
              
        setIsCategoryLoading(false);
            })
            .catch(error => {
              console.error("[Dashboard] Error processing category data from transactions:", error);
              setIsCategoryLoading(false);
            });
        }
        
        prepareRecentTransactions(preloadedTransactions);
        setIsLoading(false);
        return;
      }
    }

    // If no preloaded data or different timeframe, fetch fresh data
    console.log("[Dashboard] Fetching fresh data for timeframe:", timeFrame);
    fetchDashboardData();
  }, [timeFrame]);

  // Add a new useEffect to handle category view mode changes
  useEffect(() => {
    console.log("[Dashboard] Category view mode changed to:", categoryViewMode);
    
    // Set loading state for category data
    setIsCategoryLoading(true);
    
    // If we have current transactions, reprocess them for the new view mode
    if (currentTransactions.length > 0) {
      console.log("[Dashboard] Reprocessing existing transactions for new view mode");
      if (categoryViewMode === "main") {
        // For main categories, process directly from transactions
        processMainCategoryData(currentTransactions)
          .then(() => setIsCategoryLoading(false));
            } else {
        // For subcategories, we either need aggregations or process from transactions
        const preloadedAggregations = PreloadService.getPreloadedAggregations(timeFrame);
        if (preloadedAggregations?.current) {
          processAggregations(preloadedAggregations.current)
            .then(() => setIsCategoryLoading(false));
        } else {
          // If no aggregations, process from transactions
          console.log("[Dashboard] No aggregations available for subcategory view, processing from transactions");
          prepareCategorySummaryFromTransactions(currentTransactions, "subcategories")
            .then(({ categorySummaries, pieData }) => {
              setCategorySummaries(categorySummaries);
              setPieData(pieData);
              setIsCategoryLoading(false);
            })
            .catch(error => {
              console.error("[Dashboard] Error processing subcategories from transactions:", error);
              setPieData([]);
              setCategorySummaries([]);
              setIsCategoryLoading(false);
            });
        }
      }
    } else {
      setIsCategoryLoading(false);
    }
  }, [categoryViewMode]);

  const fetchDashboardData = async (isRefreshing = false): Promise<void> => {
    console.log(
      `[Dashboard] Fetching dashboard data for timeframe: ${timeFrame}, category mode: ${categoryViewMode}`
    );
    setIsLoading(true);
    setIsCategoryLoading(true);

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.error("[Dashboard] No user ID found for dashboard data fetch");
        setIsLoading(false);
        setIsCategoryLoading(false);
        return;
      }

      // First ensure categories are preloaded
      if (!isCategoriesPreloaded) {
        try {
          console.log("[Dashboard] Preloading categories...");
          
          // Directly fetch categories and main categories
          const [categories, mainCategories] = await Promise.all([
            CategoryService.getUserCategories(auth.currentUser?.uid || ""),
            CategoryService.getUserMainCategories(auth.currentUser?.uid || "")
          ]);
          
          // Check if we successfully got the categories
          if (categories && categories.length > 0 && 
              mainCategories && mainCategories.length > 0) {
            setIsCategoriesPreloaded(true);
          } else {
            console.warn("[Dashboard] Failed to fetch categories or main categories");
          }
        } catch (error) {
          console.error("[Dashboard] Error fetching categories:", error);
        }
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
          `[Dashboard] Using ${preloadedTransactions.length} preloaded transactions with category mode: ${categoryViewMode}`
        );

        // Store transactions for recent transactions display
        setCurrentTransactions(preloadedTransactions);

        // Process based on current category view mode
        if (categoryViewMode === "subcategories") {
          const preloadedAggregations =
            PreloadService.getPreloadedAggregations(timeFrame);

          if (preloadedAggregations?.current) {
            console.log(
              `[Dashboard] Using preloaded aggregations for ${timeFrame}`
            );

            // Process aggregations for charts and category data
            await processAggregations(preloadedAggregations.current);
            prepareRecentTransactions(preloadedTransactions);

            setIsLoading(false);
            return;
          } else {
            console.log("[Dashboard] No preloaded aggregations, generating from transactions");
            
            // If we have transactions but no aggregations, try to process them directly
            try {
              const { categorySummaries, pieData } = await prepareCategorySummaryFromTransactions(
                preloadedTransactions,
                categoryViewMode
              );
              
              setCategorySummaries(categorySummaries);
              setPieData(pieData);
              prepareRecentTransactions(preloadedTransactions);
              
              console.log(`[Dashboard] Generated ${categorySummaries.length} category summaries directly from transactions`);
              
              setIsCategoryLoading(false);
              setIsLoading(false);
              return;
            } catch (error) {
              console.error("[Dashboard] Error processing preloaded transactions:", error);
            }
          }
        } else {
          // For main category view, use the transactions directly
          console.log("[Dashboard] Processing main category data from preloaded transactions");
          await processMainCategoryData(preloadedTransactions);
          prepareRecentTransactions(preloadedTransactions);

          setIsLoading(false);
          return;
        }
      }

      // If we get here, we need to fetch fresh data
      console.log(`[Dashboard] Fetching fresh data for ${timeFrame} with category mode: ${categoryViewMode}`);
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

        // Store the latest transaction for this timeframe
        if (currentTransactionsData.length > 0) {
          const latestTransaction = currentTransactionsData.reduce((latest, current) => {
            return current.date.toDate().getTime() > latest.date.toDate().getTime() ? current : latest;
          }, currentTransactionsData[0]);
          
          PreloadService.setLastFetchedTransaction(timeFrame, latestTransaction);
        }

        setCurrentTransactions(currentTransactionsData);
        setPreviousTransactions(previousTransactionsData);
        prepareRecentTransactions(currentTransactionsData);
        
        // Process based on current category view mode
        if (categoryViewMode === "subcategories") {
          try {
            // Fetch daily aggregations
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

            if (currentAggregations.length > 0) {
              // Process aggregations if we have them
              await processAggregations(currentAggregations);

            // Cache the data for future use
              if (currentTransactionsData.length > 0) {
              PreloadService.preloadDashboardData(timeFrame);
              }
            } else {
              // If no aggregations were found, try to generate category data directly from transactions
              console.log("[Dashboard] No aggregations found, processing transactions directly");
              
              const { categorySummaries, pieData } = await prepareCategorySummaryFromTransactions(
                currentTransactionsData,
                categoryViewMode
              );
              
              setCategorySummaries(categorySummaries);
              setPieData(pieData);
              
              // Group transactions by date for spending over time
              const groupedByDate = currentTransactionsData.reduce((acc, transaction) => {
                if (transaction.transactionType !== "expense") return acc;
                
                const dateStr = transaction.date.toDate().toISOString().split('T')[0];
                if (!acc[dateStr]) {
                  acc[dateStr] = 0;
                }
                acc[dateStr] += transaction.amount;
                return acc;
              }, {} as Record<string, number>);
              
              // Convert to format for spending chart
              const spendingData = Object.entries(groupedByDate).map(([date, amount]) => ({
                date,
                amount: Math.abs(amount),
              }));
              
              // Update spending data
              setSpendingData({
                currentPeriod: spendingData,
                previousPeriod: [],
                averageSpending: spendingData.length > 0 
                  ? spendingData.reduce((sum, day) => sum + day.amount, 0) / spendingData.length 
                  : 0,
                percentageChange: 0,
                maxValue: spendingData.length > 0 
                  ? Math.max(...spendingData.map(d => d.amount), 1) 
                  : 1,
              });
              
              // Group transactions by time frame for chart
              const current = aggregateTransactionsByPeriod(
                currentTransactionsData.filter(t => t.transactionType === "expense"),
                timeFrame
              );
              
              // Update spending over time data
              setSpendingOverTime({
                current,
                previous: [],
                labels: getTimeFrameLabels(timeFrame),
              });
            }
          } catch (error) {
            console.error("[Dashboard] Error fetching aggregations:", error);
            
            // If aggregation fetch fails, try to generate data directly from transactions
            const { categorySummaries, pieData } = await prepareCategorySummaryFromTransactions(
              currentTransactionsData,
              categoryViewMode
            );
            
            setCategorySummaries(categorySummaries);
            setPieData(pieData);
            
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
          console.log("[Dashboard] Processing main category data from fresh transactions");
          await processMainCategoryData(currentTransactionsData);
          
          // Group transactions by time frame for chart
          const current = aggregateTransactionsByPeriod(
            currentTransactionsData.filter(t => t.transactionType === "expense"),
            timeFrame
          );
          
          // Update spending over time data
          setSpendingOverTime({
            current,
            previous: [],
            labels: getTimeFrameLabels(timeFrame),
          });
          
          // Calculate spending data
          const groupedByDate = currentTransactionsData
            .filter(t => t.transactionType === "expense")
            .reduce((acc, transaction) => {
              const dateStr = transaction.date.toDate().toISOString().split('T')[0];
              if (!acc[dateStr]) {
                acc[dateStr] = 0;
              }
              acc[dateStr] += Math.abs(transaction.amount);
              return acc;
            }, {} as Record<string, number>);
          
          const spendingData = Object.entries(groupedByDate).map(([date, amount]) => ({
            date,
            amount,
          }));
          
          setSpendingData({
            currentPeriod: spendingData,
            previousPeriod: [],
            averageSpending: spendingData.length > 0 
              ? spendingData.reduce((sum, day) => sum + day.amount, 0) / spendingData.length 
              : 0,
            percentageChange: 0,
            maxValue: spendingData.length > 0 
              ? Math.max(...spendingData.map(d => d.amount), 1) 
              : 1,
          });
          
          // Cache the data for future use
          if (currentTransactionsData.length > 0) {
            PreloadService.preloadDashboardData(timeFrame);
          }
        }
      } catch (error) {
        console.error("[Dashboard] Error fetching transactions:", error);
        setCurrentTransactions([]);
        setPreviousTransactions([]);
        setRecentTransactions([]);
        setPieData([]);
        setCategorySummaries([]);
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
      setSpendingOverTime({
        current: [],
        previous: [],
        labels: [],
      });
    } finally {
      setIsLoading(false);
      setIsCategoryLoading(false);
    }
  };

  // Fix the processAggregations function
  const processAggregations = async (aggregations: DailyAggregation[]) => {
    console.log("Processing aggregations:", aggregations);
    setIsCategoryLoading(true);
    
      if (!aggregations || aggregations.length === 0) {
      console.log("No aggregations to process");
        setSpendingData({
          currentPeriod: [],
          previousPeriod: [],
          averageSpending: 0,
          percentageChange: 0,
          maxValue: 0,
        });
      setPieData([]);
      setCategorySummaries([]);
      setIsCategoryLoading(false);
      setIsLoading(false);
      return;
    }

    try {
      // Sort aggregations by date
      const sortedAggregations = [...aggregations].sort((a, b) => 
        a.date.toMillis() - b.date.toMillis()
      );
      console.log("Sorted aggregations:", sortedAggregations);

      // Group transactions by date for current period
      const groupedByDate = sortedAggregations.reduce((acc, agg) => {
        const dateStr = agg.date.toDate().toISOString().split('T')[0];
        if (!acc[dateStr]) {
          acc[dateStr] = 0;
        }
        acc[dateStr] += agg.totalExpenses || 0;
        return acc;
      }, {} as Record<string, number>);

      // Convert grouped data to array format
      const currentPeriodData = Object.entries(groupedByDate).map(([date, amount]) => ({
        date,
        amount
      }));

      console.log("Current period data:", currentPeriodData);

      // Calculate average spending
      const totalSpending = currentPeriodData.reduce((sum, day) => sum + day.amount, 0);
      const averageSpending = currentPeriodData.length > 0 ? totalSpending / currentPeriodData.length : 0;
      console.log("Average spending:", averageSpending);

      // For now, we'll use the same data for previous period since we don't have historical data
      const previousPeriodData = [...currentPeriodData];
      console.log("Previous period data:", previousPeriodData);

      // Calculate percentage change (0 for now since we're using same data)
      const percentageChange = 0;
      console.log("Percentage change:", percentageChange);

      // Find max value for chart scaling
      const maxValue = Math.max(
        ...currentPeriodData.map(d => d.amount),
        ...previousPeriodData.map(d => d.amount),
        1 // Minimum of 1 to prevent division by zero
      );
      console.log("Max value:", maxValue);

      // Update spending data
      setSpendingData({
        currentPeriod: currentPeriodData,
        previousPeriod: previousPeriodData,
        averageSpending,
        percentageChange,
        maxValue,
      });

      // Update spending over time chart data based on time frame
      setSpendingOverTime({
        current: aggregateByTimeFrame(sortedAggregations, timeFrame),
        previous: [], // We'll leave previous period empty for now
        labels: getTimeFrameLabels(timeFrame),
      });

      // Process category data
      await processCategoryData(aggregations);
    } catch (error) {
      console.error("Error processing aggregations:", error);
      setSpendingData({
        currentPeriod: [],
        previousPeriod: [],
        averageSpending: 0,
        percentageChange: 0,
        maxValue: 0,
      });
      setPieData([]);
      setCategorySummaries([]);
    } finally {
      setIsCategoryLoading(false);
      setIsLoading(false);
    }
  };

  // Update the processCategoryData function
  const processCategoryData = async (aggregations: DailyAggregation[]): Promise<void> => {
    try {
      // Calculate totals for each category
      const categoryTotals: Record<string, number> = {};
      const categoryTransactionCounts: Record<string, number> = {};

      aggregations.forEach((agg) => {
        if (agg.categoryId) {
          categoryTotals[agg.categoryId] = (categoryTotals[agg.categoryId] || 0) + (agg.totalExpenses || 0);
          categoryTransactionCounts[agg.categoryId] = (categoryTransactionCounts[agg.categoryId] || 0) + (agg.transactionCount || 0);
        }
      });

      console.log("[Dashboard] Category totals from aggregations:", categoryTotals);

      // Get categories from preloaded data or load directly if needed
      const categories = await PreloadService.getPreloadedCategories() || 
                         await CategoryService.getUserCategories(auth.currentUser?.uid || "");
      
      if (!categories || categories.length === 0) {
        console.error("[Dashboard] No categories available for processing");
          setPieData([]);
          setCategorySummaries([]);
        setIsCategoryLoading(false);
        return;
      }
      
      // Log the categories for debugging
      console.log("[Dashboard] Categories loaded:", {
        categoriesCount: categories.length,
        sampleCategories: categories.slice(0, 3).map(c => ({ id: c.id, name: c.name })),
        categoryIdsInTotals: Object.keys(categoryTotals).slice(0, 3)
      });

      setIsCategoriesPreloaded(true);

      // Create lookup maps - both by ID and by name
      const categoryMapById = new Map(categories.map(cat => [cat.id, cat]));
      const categoryMapByName = new Map(categories.map(cat => [cat.name.toLowerCase(), cat]));
      
      // Create a map to store the actual category IDs for each display name
      const displayNameToCategoryId = new Map();
      
      // Check how many category IDs in totals match with our category maps
      const matchedById = Object.keys(categoryTotals).filter(id => categoryMapById.has(id)).length;
      const matchedByName = Object.keys(categoryTotals).filter(id => categoryMapByName.has(id.toLowerCase())).length;
      
      console.log(`[Dashboard] Category matching: ${matchedById} matched by ID, ${matchedByName} matched by name`);

      // Generate pie chart data with deduplication
      const pieDataMap = new Map(); // Use a Map to deduplicate by category name
      
      Object.entries(categoryTotals)
        .filter(([_, amount]) => amount > 0)
        .forEach(([categoryId, amount], index) => {
          // First try to find by ID
          let category = categoryMapById.get(categoryId);
          
          // If not found by ID, try to find by name
          if (!category) {
            category = categoryMapByName.get(categoryId.toLowerCase());
          }
          
          // Store the actual category ID for this display name
          const displayName = category?.name || categoryId;
          displayNameToCategoryId.set(displayName, category?.id || categoryId);
          
          // Only add to pieDataMap if we haven't seen this category name before
          if (!pieDataMap.has(displayName)) {
            pieDataMap.set(displayName, {
              name: displayName,
              amount,
              color: getColorForIndex(index),
              legendFontColor: "#FFFFFF",
              legendFontSize: 12,
            });
          } else {
            // If we've seen this category before, add the amounts
            const existing = pieDataMap.get(displayName);
            existing.amount += amount;
          }
        });

      // Convert Map to array and sort by amount
      const pieData = Array.from(pieDataMap.values())
        .sort((a, b) => b.amount - a.amount);

      // Calculate total spending for percentages
      const totalSpending = pieData.reduce((sum, item) => sum + item.amount, 0);

      // Generate category summaries with deduplication
      const summariesMap = new Map(); // Use a Map to deduplicate by category name
      
      Object.entries(categoryTotals)
        .filter(([_, amount]) => amount > 0)
        .forEach(([categoryId, amount], index) => {
          // First try to find by ID
          let category = categoryMapById.get(categoryId);
          
          // If not found by ID, try to find by name
          if (!category) {
            category = categoryMapByName.get(categoryId.toLowerCase());
          }
          
          // Store the actual category ID for this display name
          const displayName = category?.name || categoryId;
          const actualCategoryId = category?.id || categoryId;
          displayNameToCategoryId.set(displayName, actualCategoryId);
          
          // Only add to summariesMap if we haven't seen this category name before
          if (!summariesMap.has(displayName)) {
            summariesMap.set(displayName, {
              id: actualCategoryId,
              name: displayName,
              logo: category?.icon || "question-mark",
              transactionCount: categoryTransactionCounts[categoryId] || 0,
              amount,
              percentage: totalSpending > 0 ? Math.round((amount / totalSpending) * 100) : 0,
              color: getColorForIndex(index),
            });
          } else {
            // If we've seen this category before, combine the data
            const existing = summariesMap.get(displayName);
            existing.amount += amount;
            existing.transactionCount += (categoryTransactionCounts[categoryId] || 0);
            existing.percentage = totalSpending > 0 ? Math.round((existing.amount / totalSpending) * 100) : 0;
          }
        });

      // Convert Map to array and sort by amount
      const summaries = Array.from(summariesMap.values())
        .sort((a, b) => b.amount - a.amount);

      console.log(`[Dashboard] Generated ${pieData.length} pie chart items`);

      // Update state with new data
      setPieData(pieData);
      setCategorySummaries(summaries);
      setIsCategoryLoading(false);
    } catch (error) {
      console.error("[Dashboard] Error processing category data:", error);
      setPieData([]);
      setCategorySummaries([]);
      setIsCategoryLoading(false);
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
        setIsCategoryLoading(false);
        return;
      }

      console.log(`[Dashboard] Processing ${transactions.length} transactions for main categories`);
      setIsCategoryLoading(true);

      // Get categories and main categories
      const [categories, mainCategories] = await Promise.all([
        PreloadService.getPreloadedCategories() || CategoryService.getUserCategories(auth.currentUser?.uid || ""),
        PreloadService.getPreloadedMainCategories() || CategoryService.getUserMainCategories(auth.currentUser?.uid || "")
      ]);

      if (!categories || !mainCategories || categories.length === 0 || mainCategories.length === 0) {
        console.error("[Dashboard] No categories or main categories available");
        setPieData([]);
        setCategorySummaries([]);
        setIsCategoryLoading(false);
        return;
      }

      // Log the categories and main categories for debugging
      console.log("[Dashboard] Categories and main categories loaded:", {
        categoriesCount: categories.length,
        mainCategoriesCount: mainCategories.length,
        sampleCategories: categories.slice(0, 3).map(c => ({ id: c.id, name: c.name, mainCategory: c.mainCategory })),
        sampleMainCategories: mainCategories.slice(0, 3).map(mc => ({ id: mc.id, name: mc.name }))
      });

      setIsCategoriesPreloaded(true);

      // Create lookup maps - both by ID and by name to handle different lookup scenarios
      const categoryMap = new Map(categories.map((cat) => [cat.id, cat]));
      
      // Map main categories by both id and name for flexible lookups
      const mainCategoryMapById = new Map(mainCategories.map(mc => [mc.id, mc]));
      const mainCategoryMapByName = new Map(mainCategories.map(mc => [mc.name, mc]));

      // Create mapping from category to main category
      const categoryToMainCategory = new Map();
      
      // Log category mapping for debugging
      let mappedCount = 0;
      let unmappedCount = 0;
      
      categories.forEach((cat) => {
        if (cat.mainCategory) {
          // mainCategory field contains the name of the main category
          const mainCat = mainCategoryMapByName.get(cat.mainCategory);
          if (mainCat) {
            categoryToMainCategory.set(cat.id, mainCat.id); // Map category ID to main category ID
            mappedCount++;
          } else {
            unmappedCount++;
          }
        } else {
          unmappedCount++;
        }
      });
      
      console.log(`[Dashboard] Category mapping: ${mappedCount} categories mapped to main categories, ${unmappedCount} unmapped`);

      // Filter expense transactions
      const expenseTransactions = transactions.filter(
        (t) => t.transactionType === "expense" && t.amount > 0
      );

      // Group by main category and sum expenses
      const mainCategoryTotals: Record<string, number> = {};
      const mainCategoryTransactionCounts: Record<string, number> = {};
      let categorizedTransactions = 0;
      let uncategorizedTransactions = 0;

      for (const transaction of expenseTransactions) {
        const categoryId = transaction.categoryId;
        if (!categoryId) {
          uncategorizedTransactions++;
          continue;
        }
        
        // Get the main category ID for this category
        const mainCategoryId = categoryToMainCategory.get(categoryId);
        if (!mainCategoryId) {
          // If no mapping found, try checking if the category ID is already a main category ID
          if (mainCategoryMapById.has(categoryId)) {
            // This is already a main category ID
            if (!mainCategoryTotals[categoryId]) {
              mainCategoryTotals[categoryId] = 0;
              mainCategoryTransactionCounts[categoryId] = 0;
            }
            mainCategoryTotals[categoryId] += transaction.amount;
            mainCategoryTransactionCounts[categoryId]++;
            categorizedTransactions++;
          } else {
            uncategorizedTransactions++;
          }
          continue;
        }
        
        // Add to main category totals
          if (!mainCategoryTotals[mainCategoryId]) {
            mainCategoryTotals[mainCategoryId] = 0;
            mainCategoryTransactionCounts[mainCategoryId] = 0;
          }

          mainCategoryTotals[mainCategoryId] += transaction.amount;
          mainCategoryTransactionCounts[mainCategoryId]++;
        categorizedTransactions++;
      }

      console.log(`[Dashboard] Transaction categorization: ${categorizedTransactions} categorized, ${uncategorizedTransactions} uncategorized`);
      console.log("[Dashboard] Main category totals:", mainCategoryTotals);

      // Generate pie chart data
      const pieData = Object.entries(mainCategoryTotals)
        .filter(([_, amount]) => amount > 0)
        .map(([mainCategoryId, amount], index) => {
          const mainCategory = mainCategoryMapById.get(mainCategoryId);
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
          const mainCategory = mainCategoryMapById.get(mainCategoryId);
          return {
            id: mainCategoryId,
            name: mainCategory?.name || "Unknown",
            logo: mainCategory?.icon || "question-mark",
            transactionCount: mainCategoryTransactionCounts[mainCategoryId] || 0,
            amount,
            percentage: totalSpending > 0
                ? Math.round((amount / totalSpending) * 100)
                : 0,
            color: getColorForIndex(index),
          };
        })
        .sort((a, b) => b.amount - a.amount);

      console.log(`[Dashboard] Generated ${pieData.length} pie chart items for main categories`);

      // Update state with new data
      setPieData(pieData);
      setCategorySummaries(summaries);
      setIsCategoryLoading(false);
    } catch (error) {
      console.error("[Dashboard] Error processing main category data:", error);
      setPieData([]);
      setCategorySummaries([]);
      setIsCategoryLoading(false);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    console.log("[Dashboard] Starting refresh...");

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.error("[Dashboard] No user ID found during refresh");
        setIsRefreshing(false);
        return;
      }

      // Get the current date range
      const { currentStart, currentEnd } = getDateRanges(timeFrame);

      // First check if there are any new transactions since our last fetch
      const latestTransaction = await TransactionService.getLatestTransaction(userId);
      const lastFetchedTransaction = PreloadService.getLastFetchedTransaction(timeFrame);

      // If we have a last fetched transaction and it matches the latest transaction,
      // and the date range hasn't changed, we can skip the refresh
      if (lastFetchedTransaction && 
          latestTransaction && 
          lastFetchedTransaction.id === latestTransaction.id &&
          lastFetchedTransaction.date.toDate().getTime() === latestTransaction.date.toDate().getTime()) {
        console.log("[Dashboard] No new transactions found, keeping existing data");
        setIsRefreshing(false);
        return;
      }

      console.log("[Dashboard] New transactions found, refreshing data...");

      // Only invalidate cache if we actually have new data
      invalidateTransactionCache(timeFrame);
      
      // Clear preloaded data for this timeframe, but keep categories
      PreloadService.clearPreloadedData(timeFrame);

      // Start a fresh preload in the background for next time
      PreloadService.preloadDashboardData(timeFrame, true).catch((error) => {
        console.error("[Dashboard] Error preloading data during refresh:", error);
      });

      // Fetch fresh data
      await fetchDashboardData(true);
    } catch (error) {
      console.error("[Dashboard] Error during refresh:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to refresh data",
      });
    } finally {
      setIsRefreshing(false);
    }
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

  // Memoize the CategorySummaryCard component
  const CategorySummaryCard = React.memo(() => {
    const { isDarkMode } = useTheme();
    const [showAllCategories, setShowAllCategories] = useState(false);

    console.log("CategorySummaryCard rendering with data:", {
      summariesLength: categorySummaries.length,
      summaryData: categorySummaries.slice(0, 3), // Just log first 3 for brevity
    });

    // Ensure categories are deduplicated by ID
    const uniqueCategories = React.useMemo(() => {
      // Use a Map to deduplicate by ID
      const categoryMap = new Map();
      categorySummaries.forEach(category => {
        // Only add if not already present
        if (!categoryMap.has(category.id)) {
          categoryMap.set(category.id, category);
        }
      });
      return Array.from(categoryMap.values());
    }, [categorySummaries]);

    // Limit to first 5 categories initially, then show all if requested
    const displayCategories = showAllCategories
      ? uniqueCategories
      : uniqueCategories.slice(0, 5);

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
          {isCategoryLoading || !isCategoriesPreloaded ? (
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
                {isCategoryLoading ? "Updating category data..." : "Loading categories..."}
              </Text>
            </View>
          ) : (
            <>
              {displayCategories.map((category, index) => (
                <TouchableOpacity
                  key={`category-${category.id}-${index}`}
                  onPress={() => handleCategoryClick(category)}
                  activeOpacity={0.7}
                >
                  <View
                    className={`flex-row justify-between items-center py-3 ${
                      index < displayCategories.length - 1
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

              {uniqueCategories.length > 5 && (
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
                      : `View All (${uniqueCategories.length})`}
                  </Text>
                </TouchableOpacity>
              )}

              {uniqueCategories.length === 0 && (
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
  });

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

  // Update the loadCategoryTransactions function
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

      // Get categories to check if categoryId is a name
      const categories = await PreloadService.getPreloadedCategories() || 
                        await CategoryService.getUserCategories(userId);
      
      // Create lookup maps
      const categoryMapById = new Map(categories.map(cat => [cat.id, cat]));
      const categoryMapByName = new Map(categories.map(cat => [cat.name.toLowerCase(), cat]));

      // First try to find the category by ID
      let category = categoryMapById.get(categoryId);
      
      // If not found by ID, try to find by name
      if (!category) {
        category = categoryMapByName.get(categoryId.toLowerCase());
      }

      // Log the parameters being used for the query
      console.log('Loading category transactions with params:', {
        userId,
        categoryId,
        categoryName,
        actualCategoryId: category?.id || categoryId,
        timeFrame,
        startDate: currentStart.toISOString(),
        endDate: currentEnd.toISOString()
      });

      // Use the actual category ID if found, otherwise use the provided categoryId
      const actualCategoryId = category?.id || categoryId;

      // Fetch all transactions in the date range
      const allTransactions = await TransactionService.getTransactionsByDateRange(
        userId,
        currentStart,
        currentEnd
      );

      // Filter transactions by category name or ID
      const filteredTransactions = allTransactions.filter(transaction => {
        // Check if transaction has categoryId
        if (transaction.categoryId) {
          // If the transaction's categoryId matches either the actual ID or the category name
          return transaction.categoryId === actualCategoryId || 
                 transaction.categoryId.toLowerCase() === categoryName.toLowerCase();
        }
        return false;
      });

      // Sort transactions by date (newest first)
      const sortedTransactions = filteredTransactions.sort(
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
    const Widget = <SpentThisMonthWidget timeFrame={timeFrame} />;
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
              {Widget}
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

  const MainWidget = <SpentThisMonthWidget timeFrame={timeFrame} />;

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
        {MainWidget}
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
