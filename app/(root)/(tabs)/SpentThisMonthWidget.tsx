import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
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

interface Category {
  id: string;
  name: string;
  icon?: string;
}

interface CategorySpending {
  categoryId: string;
  name: string;
  amount: number;
  icon: string;
}

const SpentThisMonthWidget = () => {
  const { isDarkMode } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>(
    []
  );
  const [lastMonthComparison, setLastMonthComparison] = useState<number>(0);

  useEffect(() => {
    fetchSpendingData();
  }, []);

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

      setIsLoading(true);

      // Get current date and first day of the month
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Get last month's date range for comparison
      const firstDayOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      );
      const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      // Fetch current month's transactions
      const transactions = await TransactionService.getUserTransactions(userId);
      const currentMonthTransactions = transactions.filter((t: Transaction) => {
        const transactionDate = (t.date as Timestamp).toDate();
        return (
          transactionDate >= firstDayOfMonth &&
          transactionDate <= lastDayOfMonth
        );
      });

      // Fetch last month's transactions for comparison
      const lastMonthTransactions = transactions.filter((t: Transaction) => {
        const transactionDate = (t.date as Timestamp).toDate();
        return (
          transactionDate >= firstDayOfLastMonth &&
          transactionDate <= lastDayOfLastMonth
        );
      });

      // Calculate total spent this month
      const currentMonthSpent = currentMonthTransactions
        .filter((t: Transaction) => t.amount < 0)
        .reduce((sum: number, t: Transaction) => sum + Math.abs(t.amount), 0);

      // Calculate last month's total spent
      const lastMonthSpent = lastMonthTransactions
        .filter((t: Transaction) => t.amount < 0)
        .reduce((sum: number, t: Transaction) => sum + Math.abs(t.amount), 0);

      // Calculate percentage change
      const percentageChange =
        lastMonthSpent > 0
          ? ((currentMonthSpent - lastMonthSpent) / lastMonthSpent) * 100
          : 0;

      // Fetch current budget
      const currentBudgets = await BudgetService.getCurrentBudgets(userId);
      const currentBudget = currentBudgets[0]?.amount || 0;

      // Fetch categories and calculate spending by category
      const categories = await CategoryService.getUserCategories(userId);
      const categorySpendingData = categories
        .map((cat: Category) => {
          const categoryTransactions = currentMonthTransactions.filter(
            (t: Transaction) => t.categoryId === cat.id && t.amount < 0
          );
          const amount = categoryTransactions.reduce(
            (sum: number, t: Transaction) => sum + Math.abs(t.amount),
            0
          );
          return {
            categoryId: cat.id,
            name: cat.name,
            amount,
            icon: cat.icon || "category",
          };
        })
        .filter((cat: CategorySpending) => cat.amount > 0)
        .sort((a: CategorySpending, b: CategorySpending) => b.amount - a.amount)
        .slice(0, 3);

      setTotalSpent(currentMonthSpent);
      setMonthlyBudget(currentBudget);
      setCategorySpending(categorySpendingData);
      setLastMonthComparison(percentageChange);
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

  if (isLoading) {
    return (
      <View
        className={`p-4 rounded-xl ${isDarkMode ? "bg-gray-800" : "bg-white"}`}
      >
        <ActivityIndicator
          size="small"
          color={isDarkMode ? "#3B82F6" : "#1D4ED8"}
        />
      </View>
    );
  }

  return (
    <TouchableOpacity
      className={`p-4 rounded-xl mb-4 ${
        isDarkMode ? "bg-gray-800 shadow-lg" : "bg-white shadow-md"
      }`}
      style={{
        width: Dimensions.get("window").width - 40,
        marginHorizontal: 20,
      }}
    >
      <View className="flex-row justify-between items-center mb-4">
        <Text
          className={`text-lg font-bold ${
            isDarkMode ? "text-gray-200" : "text-gray-900"
          }`}
        >
          Spent This Month
        </Text>
        <Text
          className={`text-2xl font-bold ${
            isDarkMode ? "text-gray-200" : "text-gray-900"
          }`}
        >
          {formatCurrency(totalSpent)}
        </Text>
      </View>

      {/* Progress Bar */}
      {monthlyBudget > 0 && (
        <View className="mb-4">
          <View
            className={`h-2 rounded-full ${
              isDarkMode ? "bg-gray-700" : "bg-gray-200"
            }`}
          >
            <View
              className={`h-full rounded-full ${
                totalSpent > monthlyBudget ? "bg-red-500" : "bg-blue-500"
              }`}
              style={{
                width: `${Math.min((totalSpent / monthlyBudget) * 100, 100)}%`,
              }}
            />
          </View>
          <Text
            className={`text-sm mt-1 ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {formatCurrency(totalSpent)} / {formatCurrency(monthlyBudget)}
          </Text>
        </View>
      )}

      {/* Category Breakdown */}
      <View className="flex-row justify-between">
        {categorySpending.map((category) => (
          <View key={category.categoryId} className="items-center">
            <MaterialIcons
              name={category.icon as any}
              size={24}
              color={isDarkMode ? "#3B82F6" : "#1D4ED8"}
            />
            <Text
              className={`text-sm mt-1 ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}
            >
              {formatCurrency(category.amount)}
            </Text>
          </View>
        ))}
      </View>

      {/* Month Comparison */}
      {lastMonthComparison !== 0 && (
        <View className="flex-row items-center mt-2">
          <MaterialIcons
            name={lastMonthComparison > 0 ? "arrow-upward" : "arrow-downward"}
            size={16}
            color={lastMonthComparison > 0 ? "#EF4444" : "#10B981"}
          />
          <Text
            className={`text-sm ml-1 ${
              lastMonthComparison > 0 ? "text-red-500" : "text-green-500"
            }`}
          >
            {Math.abs(lastMonthComparison).toFixed(1)}% compared to last month
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default SpentThisMonthWidget;
