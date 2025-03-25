import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, Dimensions } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../firebase/firebaseConfig';
import { TransactionService } from '../services/transactionService';
import { AccountService } from '../services/accountService';
import { CategoryService } from '../services/categoryService';
import { BudgetService } from '../services/budgetService';
import Toast from 'react-native-toast-message';
import { Transaction } from '../firebase/types';
import { Timestamp } from 'firebase/firestore';

interface ChartData {
  labels: string[];
  datasets: {
    data: number[];
  }[];
}

interface PieChartData {
  name: string;
  amount: number;
  color: string;
  legendFontColor: string;
  legendFontSize: number;
}

const Dashboard = () => {
  const { isDarkMode } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [spendingData, setSpendingData] = useState<ChartData>({
    labels: [],
    datasets: [{ data: [] }]
  });
  const [categoryData, setCategoryData] = useState<ChartData>({
    labels: [],
    datasets: [{ data: [] }]
  });
  const [pieData, setPieData] = useState<PieChartData[]>([]);
  const [accountData, setAccountData] = useState<ChartData>({
    labels: [],
    datasets: [{ data: [] }]
  });

  const chartConfig = {
    backgroundColor: isDarkMode ? '#0A0F1F' : '#FFFFFF',
    backgroundGradientFrom: isDarkMode ? '#0A0F1F' : '#FFFFFF',
    backgroundGradientTo: isDarkMode ? '#0A0F1F' : '#FFFFFF',
    decimalPlaces: 0,
    color: (opacity = 1) => isDarkMode ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => isDarkMode ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: "6",
      strokeWidth: "2",
      stroke: isDarkMode ? "#3B82F6" : "#1D4ED8"
    }
  };

  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'You must be logged in to view the dashboard'
        });
        return;
      }

      setIsLoading(true);

      // Fetch current budgets
      const currentBudgets = await BudgetService.getCurrentBudgets(userId);
      
      // Fetch transactions from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const transactions = await TransactionService.getUserTransactions(userId);
      const recentTransactions = transactions.filter(t => 
        (t.date as Timestamp).toDate() >= thirtyDaysAgo
      );
      
      // Fetch user categories
      const categories = await CategoryService.getUserCategories(userId);
      
      // Fetch user accounts
      const accounts = await AccountService.getUserAccounts(userId);

      // Prepare spending vs budget data
      const spendingVsBudgetData = {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [{
          data: [1200, 1900, 1500, 2100] // Replace with actual weekly spending data
        }]
      };
      setSpendingData(spendingVsBudgetData);

      // Prepare category spending data
      const categorySpendingData = {
        labels: categories.slice(0, 5).map(cat => cat.name),
        datasets: [{
          data: categories.slice(0, 5).map(cat => {
            const categoryTransactions = recentTransactions.filter((t: Transaction) => t.categoryId === cat.id);
            return categoryTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0);
          })
        }]
      };
      setCategoryData(categorySpendingData);

      // Prepare pie chart data
      const pieChartData = categories.slice(0, 5).map((cat, index) => {
        const categoryTransactions = recentTransactions.filter((t: Transaction) => t.categoryId === cat.id);
        const totalAmount = categoryTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0);
        const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];
        return {
          name: cat.name,
          amount: totalAmount,
          color: colors[index],
          legendFontColor: isDarkMode ? '#FFFFFF' : '#000000',
          legendFontSize: 12
        };
      });
      setPieData(pieChartData);

      // Prepare account balances data
      const accountBalancesData = {
        labels: accounts.map(acc => acc.name),
        datasets: [{
          data: accounts.map(acc => acc.balance)
        }]
      };
      setAccountData(accountBalancesData);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to fetch dashboard data'
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

  if (isLoading) {
    return (
      <View className={`flex-1 justify-center items-center ${isDarkMode ? "bg-[#0A0F1F]" : "bg-white"}`}>
        <ActivityIndicator size="large" color={isDarkMode ? "#3B82F6" : "#1D4ED8"} />
      </View>
    );
  }

  return (
    <ScrollView
      className={isDarkMode ? "bg-[#0A0F1F]" : "bg-white"}
      contentContainerStyle={{ padding: 20 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={isDarkMode ? "#3B82F6" : "#1D4ED8"}
        />
      }
    >
      {/* Spending vs Budget Chart */}
      <View className="mb-8">
        <Text className={`text-lg font-bold mb-4 ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
          Spending vs Budget
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <LineChart
            data={spendingData}
            width={screenWidth - 40}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16
            }}
          />
        </ScrollView>
      </View>

      {/* Category Spending Chart */}
      <View className="mb-8">
        <Text className={`text-lg font-bold mb-4 ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
          Category Spending
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <BarChart
            data={categoryData}
            width={screenWidth - 40}
            height={220}
            yAxisLabel="$"
            yAxisSuffix=""
            chartConfig={chartConfig}
            style={{
              marginVertical: 8,
              borderRadius: 16
            }}
          />
        </ScrollView>
      </View>

      {/* Spending Distribution Pie Chart */}
      <View className="mb-8">
        <Text className={`text-lg font-bold mb-4 ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
          Spending Distribution
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <PieChart
            data={pieData}
            width={screenWidth - 40}
            height={220}
            chartConfig={chartConfig}
            accessor="amount"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </ScrollView>
      </View>

      {/* Account Balances Chart */}
      <View className="mb-8">
        <Text className={`text-lg font-bold mb-4 ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
          Account Balances
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <BarChart
            data={accountData}
            width={screenWidth - 40}
            height={220}
            yAxisLabel="$"
            yAxisSuffix=""
            chartConfig={chartConfig}
            style={{
              marginVertical: 8,
              borderRadius: 16
            }}
          />
        </ScrollView>
      </View>
    </ScrollView>
  );
};

export default Dashboard; 