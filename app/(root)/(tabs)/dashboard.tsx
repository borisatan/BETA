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
} from "react-native";
import { LineChart, BarChart, PieChart } from "react-native-chart-kit";
import { Rect, Text as TextSVG, Svg, Line, Circle, G, Polygon } from "react-native-svg";
import { useTheme } from "../context/ThemeContext";
import { auth } from "../firebase/firebaseConfig";
import { TransactionService } from "../services/transactionService";
import { AccountService } from "../services/accountService";
import { CategoryService } from "../services/categoryService";
import { BudgetService } from "../services/budgetService";
import Toast from "react-native-toast-message";
import { Transaction, DailyAggregation } from "../firebase/types";
import { Timestamp } from "firebase/firestore";
import { MaterialIcons } from "@expo/vector-icons";
import SpentThisMonthWidget from "./spent-this-month-widget";
import SpendingOverTimeChart from "../charts/SpendingOverTimeChart";
import AverageSpendingChart from "../charts/AverageSpendingChart";
import CategoryBreakdownChart from "../charts/CategoryBreakdownChart";
import { DailyAggregationService } from '../services/dailyAggregationService';

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

type GraphType = 'spending' | 'average' | 'category';

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

const Dashboard = () => {
  const { isDarkMode } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsData, setDetailsData] = useState<any>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [selectedGraph, setSelectedGraph] = useState<GraphType>('spending');
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
  const getGroupKey = (date: Date, timeFrame: "week" | "month" | "6months" | "year"): string => {
    switch (timeFrame) {
      case "week":
        return date.toLocaleDateString('en-US', { weekday: 'short' });
      case "month":
        return `Week ${Math.ceil(date.getDate() / 7)}`;
      case "6months":
        return date.toLocaleDateString('en-US', { month: 'short' });
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
  const getTimeFrameLabels = (timeFrame: "week" | "month" | "6months" | "year"): string[] => {
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
  const getWindowSize = (timeFrame: "week" | "month" | "6months" | "year"): number => {
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
  const calculateHistoricalAverage = (data: number[], timeFrame: "week" | "month" | "6months" | "year"): number[] => {
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
  const aggregateByTimeFrame = (aggregations: DailyAggregation[], timeFrame: "week" | "month" | "6months" | "year"): number[] => {
    const labels = getTimeFrameLabels(timeFrame);
    const grouped = aggregations.reduce((acc: { [key: string]: number }, agg) => {
      const date = agg.date.toDate();
      const key = getGroupKey(date, timeFrame);
      acc[key] = (acc[key] || 0) + agg.totalExpenses;
      return acc;
    }, {});

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

  // Helper function to prepare category data
  const prepareCategoryData = async (aggregations: DailyAggregation[]): Promise<PieChartData[]> => {
    const categoryTotals = aggregations.reduce((acc: { [key: string]: number }, agg) => {
      if (agg.categoryId) {
        acc[agg.categoryId] = (acc[agg.categoryId] || 0) + agg.totalExpenses;
      }
      return acc;
    }, {});

    const categories = await CategoryService.getUserCategories(auth.currentUser?.uid || '');
    
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

  // Helper function to round to nearest multiple of 50
  const roundToNearest50 = (value: number): number => {
    return Math.round(value / 50) * 50;
  };

  // Helper function to round array of values to nearest multiple of 50
  const roundArrayToNearest50 = (values: number[]): number[] => {
    return values.map(value => roundToNearest50(value));
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
    const yAxisWidth = 54;  // Width reserved for Y-axis labels
    const chartAreaWidth = chartWidth - yAxisWidth;
    
    // Adjust x to account for Y-axis
    const adjustedX = x - yAxisWidth;
    
    // If touch is outside actual chart area, return null
    if (adjustedX < 0 || adjustedX > chartAreaWidth) return null;
    
    const dataPoints = spendingOverTime.current.length;
    // Calculate segment width based on available space
    const segmentWidth = chartAreaWidth / (dataPoints);
    
    // Find the closest data point
    const index = Math.round(adjustedX / segmentWidth);
    if (index < 0 || index >= dataPoints) return null;
    
    // Calculate exact X position (from left edge of container)
    const exactX = yAxisWidth + (index * segmentWidth);
    
    // Calculate Y position
    const chartHeight = 220;
    const topPadding = 30;
    const bottomPadding = 40;
    const availableHeight = chartHeight - topPadding - bottomPadding;
    
    const maxValue = Math.max(...spendingOverTime.current, 1);
    const value = spendingOverTime.current[index];
    const percentOfMax = value / maxValue;
    
    // Y position calculation with proper scaling
    const exactY = topPadding + (availableHeight * (1 - percentOfMax));
    
    return {
      index,
      value: spendingOverTime.current[index],
      label: spendingOverTime.labels[index],
      exactX: exactX,
      exactY: exactY
    };
  };

  useEffect(() => {
    fetchDashboardData();
  }, [timeFrame]);

  const handleTimeFrameChange = (newTimeFrame: "week" | "month" | "6months" | "year") => {
    setIsDataLoading(true);
    newDataFadeAnim.setValue(0);
    setTimeFrame(newTimeFrame);
  };

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

      // Get date ranges based on timeFrame
      const { currentStart, currentEnd, previousStart, previousEnd } = getDateRanges(timeFrame);

      // Fetch daily aggregations for both periods
      const currentAggregations = await DailyAggregationService.getDailyAggregations(
        userId,
        currentStart,
        currentEnd
      );
      const previousAggregations = await DailyAggregationService.getDailyAggregations(
        userId,
        previousStart,
        previousEnd
      );

      // Prepare spending over time data
      const labels = getTimeFrameLabels(timeFrame);
      
      // Group aggregations by time frame
      const currentData = aggregateByTimeFrame(currentAggregations, timeFrame);
      const previousData = aggregateByTimeFrame(previousAggregations, timeFrame);

      // Round all data points to nearest 50
      const roundedCurrentData = roundArrayToNearest50(currentData);
      const roundedPreviousData = roundArrayToNearest50(previousData);

      // Calculate max value for y-axis scaling
      const maxValue = Math.max(...roundedCurrentData, ...roundedPreviousData);
      const yAxisInterval = calculateNiceInterval(maxValue);

      // Prepare average spending data
      const averageData = {
        labels: labels,
        datasets: [
          {
            data: roundedCurrentData,
            color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
          },
          {
            data: roundArrayToNearest50(calculateHistoricalAverage(roundedCurrentData, timeFrame)),
            color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
          },
        ],
      };

      // Prepare category breakdown
      const categoryData = await prepareCategoryData(currentAggregations);

      // Update state with new data
      setSpendingOverTime({
        labels,
        current: roundedCurrentData,
        previous: roundedPreviousData,
      });

      setAverageSpending(averageData);
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

  const renderGraphSelector = () => (
    <View className="w-full items-center mb-4">
      <TouchableOpacity
        onPress={() => {
          setSelectedGraph(prev => {
            switch (prev) {
              case 'spending': return 'average';
              case 'average': return 'category';
              case 'category': return 'spending';
              default: return 'spending';
            }
          });
        }}
        className={`px-6 py-3 rounded-full ${
          isDarkMode ? "bg-gray-800" : "bg-gray-100"
        }`}
      >
        <Text className={`${isDarkMode ? "text-white" : "text-gray-900"} font-medium`}>
          {selectedGraph === 'spending' && 'Spending Over Time'}
          {selectedGraph === 'average' && 'Average Spending'}
          {selectedGraph === 'category' && 'Category Breakdown'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderSelectedGraph = () => {
    switch (selectedGraph) {
      case 'spending':
        return (
          <Animated.View style={{ opacity: fadeAnim, width: '100%' }}>
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
      case 'average':
        return (
          <Animated.View style={{ opacity: fadeAnim, width: '100%' }}>
            <ChartCard title="Average Spending Comparison">
              <AverageSpendingChart data={averageSpending} />
            </ChartCard>
          </Animated.View>
        );
      case 'category':
        return (
          <Animated.View style={{ opacity: fadeAnim, width: '100%' }}>
            <ChartCard title="Category Breakdown">
              <CategoryBreakdownChart data={pieData} />
            </ChartCard>
          </Animated.View>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <Animated.View
        className={`flex-1 ${
          isDarkMode ? "bg-[#0A0F1F]" : "bg-white"
        }`}
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