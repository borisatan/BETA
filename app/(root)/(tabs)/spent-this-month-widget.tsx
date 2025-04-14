import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { auth } from "../firebase/firebaseConfig";
import { TransactionService } from "../services/transactionService";
import { BudgetService } from "../services/budgetService";
import { CategoryService } from "../services/categoryService";
import { MaterialIcons } from "@expo/vector-icons";
import { Transaction } from "../firebase/types";
import { Timestamp } from "firebase/firestore";
import Toast from "react-native-toast-message";

interface CategorySpending {
  categoryId: string;
  name: string;
  amount: number;
  icon: string;
}

interface SpentThisMonthWidgetProps {
  timeFrame: "week" | "month" | "6months" | "year";
}

// Helper function to get category icon
const getCategoryIcon = (categoryName: string): string => {
  const categoryIcons: { [key: string]: string } = {
    Food: "restaurant",
    Transport: "directions-car",
    Shopping: "shopping-cart",
    Bills: "receipt",
    Entertainment: "movie",
    Health: "local-hospital",
    Travel: "flight",
    Education: "school",
    Housing: "home",
    Utilities: "power",
    Insurance: "security",
    Gifts: "card-giftcard",
    Other: "category",
  };

  return categoryIcons[categoryName] || "category";
};

const SpentThisMonthWidget: React.FC<SpentThisMonthWidgetProps> = ({ timeFrame }) => {
  const { isDarkMode } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);
  const [lastPeriodComparison, setLastPeriodComparison] = useState<number>(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const newDataFadeAnim = useRef(new Animated.Value(0)).current;
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Helper function to get date ranges based on timeFrame
  const getDateRanges = (timeFrame: "week" | "month" | "6months" | "year") => {
    const now = new Date();
    let currentStart: Date, currentEnd: Date, previousStart: Date, previousEnd: Date;

    switch (timeFrame) {
      case "week":
        currentStart = new Date(now.setDate(now.getDate() - now.getDay()));
        currentEnd = new Date(now.setDate(now.getDate() + 6));
        previousStart = new Date(new Date(currentStart).setDate(currentStart.getDate() - 7));
        previousEnd = new Date(new Date(currentEnd).setDate(currentEnd.getDate() - 7));
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

  useEffect(() => {
    if (isDataLoading) {
      // Fade in new data
      Animated.timing(newDataFadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        // Once new data is visible, update the main fade animation
        fadeAnim.setValue(1);
        setIsDataLoading(false);
      });
    }
  }, [isDataLoading]);

  useEffect(() => {
    fetchSpendingData();
  }, [timeFrame]);

  const fetchSpendingData = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "You must be logged in to view spending data",
        });
        return;
      }

      setIsDataLoading(true);
      newDataFadeAnim.setValue(0);

      // Get date ranges based on timeFrame
      const { currentStart, currentEnd, previousStart, previousEnd } = getDateRanges(timeFrame);

      // Fetch transactions
      const transactions = await TransactionService.getUserTransactions(userId);
      
      // Filter transactions for current and previous periods
      const currentPeriodTransactions = transactions.filter((t: Transaction) => {
        const transactionDate = (t.date as Timestamp).toDate();
        return transactionDate >= currentStart && transactionDate <= currentEnd;
      });

      const previousPeriodTransactions = transactions.filter((t: Transaction) => {
        const transactionDate = (t.date as Timestamp).toDate();
        return transactionDate >= previousStart && transactionDate <= previousEnd;
      });

      // Calculate totals
      const currentPeriodSpent = currentPeriodTransactions
        .filter((t: Transaction) => t.amount < 0)
        .reduce((sum: number, t: Transaction) => sum + Math.abs(t.amount), 0);

      const previousPeriodSpent = previousPeriodTransactions
        .filter((t: Transaction) => t.amount < 0)
        .reduce((sum: number, t: Transaction) => sum + Math.abs(t.amount), 0);

      // Calculate percentage change
      const percentageChange = previousPeriodSpent > 0
        ? ((currentPeriodSpent - previousPeriodSpent) / previousPeriodSpent) * 100
        : 0;

      // Get current budget
      const currentBudgets = await BudgetService.getCurrentBudgets(userId);
      const currentBudget = currentBudgets[0]?.amount || 0;

      // Calculate category totals
      const categoryTotals: { [key: string]: number } = currentPeriodTransactions
        .filter((t: Transaction) => t.amount < 0)
        .reduce((acc: { [key: string]: number }, t: Transaction) => {
          acc[t.categoryId] = (acc[t.categoryId] || 0) + Math.abs(t.amount);
          return acc;
        }, {});

      // Get top 3 spending categories
      const categories = await CategoryService.getUserCategories(userId);
      const topCategoriesList = Object.entries(categoryTotals)
        .map(([categoryId, amount]) => ({
          categoryId,
          name: categories.find((cat) => cat.id === categoryId)?.name || "Unknown",
          amount,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);

      // Update state with new data
      setTotalSpent(currentPeriodSpent);
      setLastPeriodComparison(percentageChange);
      setCategorySpending(topCategoriesList.map(({ categoryId, name, amount }) => ({
        categoryId,
        name,
        amount,
        icon: getCategoryIcon(name),
      })));
      setMonthlyBudget(currentBudget);
    } catch (error) {
      console.error("Error fetching spending data:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to fetch spending data",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getTimeFrameLabel = () => {
    switch (timeFrame) {
      case "week":
        return "Spent This Week";
      case "month":
        return "Spent This Month";
      case "6months":
        return "Spent Last 6 Months";
      case "year":
        return "Spent This Year";
      default:
        return "Spent This Month";
    }
  };

  if (isLoading) {
    return (
      <View className="w-full items-center">
        <ActivityIndicator size="large" color={isDarkMode ? "#3B82F6" : "#1D4ED8"} />
      </View>
    );
  }

  return (
    <Pressable>
      <Animated.View
        className={`p-4 rounded-xl mb-4 ${
          isDarkMode ? "bg-gray-800 shadow-lg" : "bg-white shadow-md"
        }`}
        style={{
          width: Dimensions.get("window").width - 40,
          marginHorizontal: 20,
          opacity: fadeAnim,
        }}
      >
        {/* Header with total spent */}
        <View className="flex-row justify-between items-center mb-4">
          <Text className={`text-lg font-bold ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
            {getTimeFrameLabel()}
          </Text>
          <Text className={`text-2xl font-bold ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
            {formatCurrency(totalSpent)}
          </Text>
        </View>

        {/* Budget Progress Bar */}
        {monthlyBudget > 0 && (
          <View className="mb-4">
            <View className={`h-2 rounded-full ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`}>
              <View
                className={`h-full rounded-full ${
                  totalSpent > monthlyBudget ? "bg-red-500" : "bg-blue-500"
                }`}
                style={{
                  width: `${Math.min((totalSpent / monthlyBudget) * 100, 100)}%`,
                }}
              />
            </View>
            <Text className={`text-sm mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              {formatCurrency(totalSpent)} / {formatCurrency(monthlyBudget)}
            </Text>
          </View>
        )}

        {/* Top 3 Categories */}
        <View className="flex-row justify-between">
          {categorySpending.map((category) => (
            <View key={category.categoryId} className="items-center">
              <MaterialIcons
                name={category.icon as any}
                size={24}
                color={isDarkMode ? "#3B82F6" : "#1D4ED8"}
              />
              <Text className={`text-sm mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                {formatCurrency(category.amount)}
              </Text>
            </View>
          ))}
        </View>

        {/* Period Comparison */}
        {lastPeriodComparison !== 0 && (
          <View className="flex-row items-center mt-2">
            <MaterialIcons
              name={lastPeriodComparison > 0 ? "arrow-upward" : "arrow-downward"}
              size={16}
              color={lastPeriodComparison > 0 ? "#EF4444" : "#10B981"}
            />
            <Text
              className={`text-sm ml-1 ${
                lastPeriodComparison > 0 ? "text-red-500" : "text-green-500"
              }`}
            >
              {Math.abs(lastPeriodComparison).toFixed(1)}% compared to last {timeFrame}
            </Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
};

export default SpentThisMonthWidget;
