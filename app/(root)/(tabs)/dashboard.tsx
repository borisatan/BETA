import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  Modal,
} from "react-native";
import { LineChart, BarChart, PieChart } from "react-native-chart-kit";
import { useTheme } from "../context/ThemeContext";
import { auth } from "../firebase/firebaseConfig";
import { TransactionService } from "../services/transactionService";
import { AccountService } from "../services/accountService";
import { CategoryService } from "../services/categoryService";
import { BudgetService } from "../services/budgetService";
import Toast from "react-native-toast-message";
import { Transaction } from "../firebase/types";
import { Timestamp } from "firebase/firestore";
import { MaterialIcons } from "@expo/vector-icons";
import SpentThisMonthWidget from "./SpentThisMonthWidget";

interface ChartData {
  labels: string[];
  datasets: {
    data: number[];
    color?: (opacity: number) => string;
    strokeWidth?: number;
    withDots?: boolean;
  }[];
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

const ChartCard: React.FC<ChartCardProps> = ({ title, children, onPress }) => {
  const { isDarkMode } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      className={`p-4 rounded-xl mb-4 w-full ${
        isDarkMode ? "bg-gray-800 shadow-lg" : "bg-white shadow-md"
      }`}
    >
      <Text
        className={`text-lg font-bold mb-4 text-center ${
          isDarkMode ? "text-gray-200" : "text-gray-900"
        }`}
      >
        {title}
      </Text>
      {children}
    </TouchableOpacity>
  );
};

const Dashboard = () => {
  const { isDarkMode } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsData, setDetailsData] = useState<any>(null);
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

  // Chart data states
  const [pieData, setPieData] = useState<PieChartData[]>([]);

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
  const getGroupKey = (date: Date, timeFrame: string): string => {
    switch (timeFrame) {
      case "week":
        return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
      case "month":
        return `Week ${Math.ceil(date.getDate() / 7)}`;
      case "6months":
        return date.toLocaleString("default", { month: "short" });
      case "year":
        return `Q${Math.floor(date.getMonth() / 3) + 1}`;
      default:
        return "";
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

  // Helper function to calculate historical average
  const calculateHistoricalAverage = (
    transactions: Transaction[],
    timeFrame: "week" | "month" | "6months" | "year"
  ): number[] => {
    const labels = getTimeFrameLabels(timeFrame);
    // Calculate simple average for demonstration
    const total = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const average = total / transactions.length || 0;
    return labels.map(() => average);
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

  // Helper function to prepare category data
  const prepareCategoryData = async (
    transactions: Transaction[],
    userId: string
  ): Promise<PieChartData[]> => {
    const categories = await CategoryService.getUserCategories(userId);

    // Group transactions by category
    const categoryTotals = transactions.reduce(
      (acc: { [key: string]: number }, transaction) => {
        acc[transaction.categoryId] =
          (acc[transaction.categoryId] || 0) + Math.abs(transaction.amount);
        return acc;
      },
      {}
    );

    // Prepare pie chart data
    return categories
      .map((category, index) => ({
        name: category.name,
        amount: categoryTotals[category.id] || 0,
        color: getColorForIndex(index),
        legendFontColor: "#FFFFFF",
        legendFontSize: 12,
      }))
      .filter((category) => category.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  };

  const getTimeFrameLabels = (
    period: "week" | "month" | "6months" | "year"
  ) => {
    switch (period) {
      case "week":
        return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      case "month":
        return ["Week 1", "Week 2", "Week 3", "Week 4"];
      case "6months":
        return Array.from({ length: 6 }, (_, i) => {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          return d.toLocaleString("default", { month: "short" });
        }).reverse();
      case "year":
        return ["Q1", "Q2", "Q3", "Q4"];
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "You must be logged in to view the dashboard",
        });
        return;
      }

      setIsLoading(true);

      // Get date ranges based on timeFrame
      const { currentStart, currentEnd, previousStart, previousEnd } =
        getDateRanges(timeFrame);

      // Fetch transactions for both periods
      const transactions = await TransactionService.getUserTransactions(userId);
      const currentPeriodTransactions = transactions.filter((t) =>
        isWithinRange((t.date as Timestamp).toDate(), currentStart, currentEnd)
      );
      const previousPeriodTransactions = transactions.filter((t) =>
        isWithinRange(
          (t.date as Timestamp).toDate(),
          previousStart,
          previousEnd
        )
      );

      // Prepare spending over time data
      const labels = getTimeFrameLabels(timeFrame);
      const currentData = aggregateTransactionsByPeriod(
        currentPeriodTransactions,
        timeFrame
      );
      const previousData = aggregateTransactionsByPeriod(
        previousPeriodTransactions,
        timeFrame
      );

      setSpendingOverTime({
        labels,
        current: currentData,
        previous: previousData,
      });

      // Prepare average spending data
      const averageData = {
        labels: labels,
        datasets: [
          {
            data: currentData,
            color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
          },
          {
            data: calculateHistoricalAverage(transactions, timeFrame),
            color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
          },
        ],
      };
      setAverageSpending(averageData);

      // Prepare category breakdown
      const categoryData = await prepareCategoryData(
        currentPeriodTransactions,
        userId
      );
      setPieData(categoryData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to fetch dashboard data",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData();
  };

  const handleChartPress = (chartType: string, data: any) => {
    setSelectedChart(chartType);
    setDetailsData(data);
    setShowDetailsModal(true);
  };

  if (isLoading) {
    return (
      <View
        className={`flex-1 justify-center items-center ${
          isDarkMode ? "bg-[#0A0F1F]" : "bg-white"
        }`}
      >
        <ActivityIndicator
          size="large"
          color={isDarkMode ? "#3B82F6" : "#1D4ED8"}
        />
      </View>
    );
  }

  return (
    <ScrollView
      className={isDarkMode ? "bg-[#0A0F1F]" : "bg-white"}
      contentContainerStyle={{
        paddingVertical: 20,
        paddingHorizontal: 16,
        alignItems: "center",
      }}
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
        <SpentThisMonthWidget />
      </View>

      {/* Time Frame Selector - centered */}
      <View className="w-full flex-row justify-center space-x-2 mb-6">
        {["week", "month", "6months", "year"].map((period) => (
          <TouchableOpacity
            key={period}
            onPress={() => setTimeFrame(period as any)}
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

      {/* Charts Container - centered */}
      <View className="w-full items-center space-y-4">
        {/* Spending Over Time */}
        <ChartCard title="Spending Over Time">
          <LineChart
            data={{
              labels: spendingOverTime.labels,
              datasets: [
                {
                  data:
                    spendingOverTime.current.length > 0
                      ? spendingOverTime.current
                      : [1],
                  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                  strokeWidth: 2,
                },
              ],
            }}
            width={screenWidth - 48}
            height={220}
            chartConfig={{
              ...chartConfig,
              decimalPlaces: 0,
              formatYLabel: (value) => Math.round(Number(value)).toString(),
            }}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16,
              alignSelf: "center",
            }}
          />
        </ChartCard>

        {/* Average Spending */}
        <ChartCard title="Average Spending Comparison">
          <BarChart
            data={{
              labels: averageSpending.labels,
              datasets: [
                {
                  data:
                    averageSpending.datasets[0].data.length > 0
                      ? averageSpending.datasets[0].data
                      : [1],
                },
              ],
            }}
            width={screenWidth - 48}
            height={220}
            yAxisLabel="$"
            yAxisSuffix=""
            chartConfig={{
              ...chartConfig,
              decimalPlaces: 0,
              formatYLabel: (value) => Math.round(Number(value)).toString(),
            }}
            style={{
              marginVertical: 8,
              borderRadius: 16,
              alignSelf: "center",
            }}
          />
        </ChartCard>

        {/* Category Breakdown */}
        <ChartCard title="Category Breakdown">
          <PieChart
            data={
              pieData.length > 0
                ? pieData
                : [
                    {
                      name: "No Data",
                      amount: 1,
                      color: "#cccccc",
                      legendFontColor: isDarkMode ? "#FFFFFF" : "#000000",
                      legendFontSize: 12,
                    },
                  ]
            }
            width={screenWidth - 48}
            height={220}
            chartConfig={{
              ...chartConfig,
              decimalPlaces: 0,
              formatYLabel: (value) => Math.round(Number(value)).toString(),
            }}
            accessor="amount"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
            style={{
              marginVertical: 8,
              borderRadius: 16,
              alignSelf: "center",
            }}
          />
        </ChartCard>
      </View>

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
