import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, Dimensions, TouchableOpacity, Modal } from 'react-native';
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
import { MaterialIcons } from '@expo/vector-icons';

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

const ChartCard: React.FC<ChartCardProps> = ({ title, children, onPress }) => {
  const { isDarkMode } = useTheme();
  
  return (
    <TouchableOpacity 
      onPress={onPress}
      className={`p-4 rounded-xl mb-4 ${
        isDarkMode 
          ? "bg-gray-800 shadow-lg" 
          : "bg-white shadow-md"
      }`}
      style={{
        width: Dimensions.get('window').width - 40,
        marginHorizontal: 20,
      }}
    >
      <Text className={`text-lg font-bold mb-4 ${
        isDarkMode ? "text-gray-200" : "text-gray-900"
      }`}>
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
  const [dailySpending, setDailySpending] = useState<DailySpending[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(0);

  // Chart data states
  const [spendingData, setSpendingData] = useState<ChartData>({
    labels: [],
    datasets: [{ data: [] }, { data: [] }]
  });
  const [categoryData, setCategoryData] = useState<ChartData>({
    labels: [],
    datasets: [{ data: [] }]
  });
  const [pieData, setPieData] = useState<PieChartData[]>([]);
  const [accountData, setAccountData] = useState<ChartData>({
    labels: [],
    datasets: [{ data: [] }, { data: [] }]
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

      // Get current month's start and end dates
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Fetch current month's transactions
      const transactions = await TransactionService.getUserTransactions(userId);
      const currentMonthTransactions = transactions.filter(t => {
        const transactionDate = (t.date as Timestamp).toDate();
        return transactionDate >= startOfMonth && transactionDate <= endOfMonth;
      });

      // Calculate daily spending
      const dailySpendingMap = new Map<string, { amount: number; transactions: Transaction[] }>();
      currentMonthTransactions.forEach(transaction => {
        const date = (transaction.date as Timestamp).toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const existing = dailySpendingMap.get(date) || { amount: 0, transactions: [] };
        dailySpendingMap.set(date, {
          amount: existing.amount + Math.abs(transaction.amount),
          transactions: [...existing.transactions, transaction]
        });
      });

      // Convert to array and sort by date
      const dailySpendingArray = Array.from(dailySpendingMap.entries())
        .map(([date, data]) => ({
          date,
          amount: data.amount,
          transactions: data.transactions
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setDailySpending(dailySpendingArray);

      // Get current month's budget
      const budgets = await BudgetService.getUserBudgets(userId);
      const currentBudget = budgets.find(b => {
        const budgetStart = b.startDate.toDate();
        const budgetEnd = b.endDate.toDate();
        return budgetStart <= startOfMonth && budgetEnd >= endOfMonth;
      });

      const monthlyBudgetAmount = currentBudget?.amount || 0;
      setMonthlyBudget(monthlyBudgetAmount);

      // Prepare spending vs budget data
      const spendingVsBudgetData = {
        labels: dailySpendingArray.map(d => d.date),
        datasets: [
          {
            data: dailySpendingArray.map(d => d.amount),
            color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
            strokeWidth: 2,
            withDots: true
          },
          {
            data: dailySpendingArray.map(() => monthlyBudgetAmount),
            color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
            strokeWidth: 1,
            withDots: false
          }
        ]
      };
      setSpendingData(spendingVsBudgetData);

      // Fetch user categories
      const categories = await CategoryService.getUserCategories(userId);
      
      // Fetch user accounts
      const accounts = await AccountService.getUserAccounts(userId);

      // Prepare category spending data with budget comparison
      const categorySpendingData = {
        labels: categories.slice(0, 5).map(cat => cat.name),
        datasets: [{
          data: categories.slice(0, 5).map(cat => {
            const categoryTransactions = currentMonthTransactions.filter((t: Transaction) => t.categoryId === cat.id);
            return categoryTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0);
          }),
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`
        }]
      };
      setCategoryData(categorySpendingData);

      // Prepare pie chart data with budget comparison
      const pieChartData = categories.slice(0, 5).map((cat, index) => {
        const categoryTransactions = currentMonthTransactions.filter((t: Transaction) => t.categoryId === cat.id);
        const totalAmount = categoryTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0);
        const budget = currentBudget?.categories.find(c => c.categoryId === cat.id)?.allocated || 0;
        const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];
        return {
          name: cat.name,
          amount: totalAmount,
          budget,
          color: colors[index],
          legendFontColor: isDarkMode ? '#FFFFFF' : '#000000',
          legendFontSize: 12
        };
      });
      setPieData(pieChartData);

      // Prepare account balances data with income/expense comparison
      const accountBalancesData = {
        labels: accounts.map(acc => acc.name),
        datasets: [
          {
            data: accounts.map(acc => {
              const incomeTransactions = currentMonthTransactions.filter((t: Transaction) => 
                t.accountId === acc.id && t.amount > 0
              );
              return incomeTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0);
            }),
            color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`
          },
          {
            data: accounts.map(acc => {
              const expenseTransactions = currentMonthTransactions.filter((t: Transaction) => 
                t.accountId === acc.id && t.amount < 0
              );
              return Math.abs(expenseTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0));
            }),
            color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`
          }
        ]
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

  const handleChartPress = (chartType: string, data: any) => {
    setSelectedChart(chartType);
    setDetailsData(data);
    setShowDetailsModal(true);
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
      {/* Horizontal Scrollable Cards */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="mb-8"
      >
        {/* Spending vs Budget Card */}
        <ChartCard 
          title="Spent this month"
          onPress={() => handleChartPress('spending', { dailySpending, monthlyBudget })}
        >
          <View className="mb-4">
            <Text className={`text-2xl font-bold ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
              ${dailySpending.reduce((sum, day) => sum + day.amount, 0).toFixed(2)}
            </Text>
            <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              of ${monthlyBudget.toFixed(2)} budget
            </Text>
          </View>
          <LineChart
            data={spendingData}
            width={screenWidth - 80}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16
            }}
            withDots={true}
            withInnerLines={true}
            withOuterLines={true}
            withVerticalLines={true}
            withHorizontalLines={true}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            withShadow={true}
            segments={4}
            fromZero={true}
            yAxisLabel="$"
            yAxisSuffix=""
          />
        </ChartCard>

        {/* Category Spending Card */}
        <ChartCard 
          title="Category Spending"
          onPress={() => handleChartPress('category', categoryData)}
        >
          <BarChart
            data={categoryData}
            width={screenWidth - 80}
            height={220}
            yAxisLabel="$"
            yAxisSuffix=""
            chartConfig={chartConfig}
            style={{
              marginVertical: 8,
              borderRadius: 16
            }}
            withInnerLines={true}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            segments={4}
            fromZero={true}
            showBarTops={true}
            withCustomBarColorFromData={true}
          />
        </ChartCard>

        {/* Spending Distribution Card */}
        <ChartCard 
          title="Spending Distribution"
          onPress={() => handleChartPress('distribution', pieData)}
        >
          <PieChart
            data={pieData}
            width={screenWidth - 80}
            height={220}
            chartConfig={chartConfig}
            accessor="amount"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
            hasLegend={true}
            center={[screenWidth / 4, 0]}
          />
        </ChartCard>

        {/* Account Balances Card */}
        <ChartCard 
          title="Account Balances"
          onPress={() => handleChartPress('accounts', accountData)}
        >
          <BarChart
            data={accountData}
            width={screenWidth - 80}
            height={220}
            yAxisLabel="$"
            yAxisSuffix=""
            chartConfig={chartConfig}
            style={{
              marginVertical: 8,
              borderRadius: 16
            }}
            withInnerLines={true}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            segments={4}
            fromZero={true}
            showBarTops={true}
            withCustomBarColorFromData={true}
          />
        </ChartCard>
      </ScrollView>

      {/* Details Modal */}
      <Modal
        visible={showDetailsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View className="flex-1 justify-end">
          <View className={`rounded-t-3xl p-6 ${
            isDarkMode ? "bg-gray-800" : "bg-white"
          }`}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className={`text-xl font-bold ${
                isDarkMode ? "text-gray-200" : "text-gray-900"
              }`}>
                {selectedChart === 'spending' && 'Monthly Spending'}
                {selectedChart === 'category' && 'Category Details'}
                {selectedChart === 'distribution' && 'Distribution Details'}
                {selectedChart === 'accounts' && 'Account Details'}
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
            {detailsData && selectedChart === 'spending' && (
              <ScrollView className="max-h-[70vh]">
                <View className="space-y-4">
                  {detailsData.dailySpending.map((day: DailySpending) => (
                    <View key={day.date} className={`p-4 rounded-lg ${
                      isDarkMode ? "bg-gray-700" : "bg-gray-100"
                    }`}>
                      <View className="flex-row justify-between items-center mb-2">
                        <Text className={`text-lg font-semibold ${
                          isDarkMode ? "text-gray-200" : "text-gray-900"
                        }`}>
                          {day.date}
                        </Text>
                        <Text className={`text-lg font-semibold ${
                          isDarkMode ? "text-gray-200" : "text-gray-900"
                        }`}>
                          ${day.amount.toFixed(2)}
                        </Text>
                      </View>
                      <View className="space-y-2">
                        {day.transactions.map((transaction: Transaction) => (
                          <View key={transaction.id} className="flex-row justify-between items-center">
                            <Text className={`${
                              isDarkMode ? "text-gray-300" : "text-gray-700"
                            }`}>
                              {transaction.description}
                            </Text>
                            <Text className={`${
                              isDarkMode ? "text-gray-300" : "text-gray-700"
                            }`}>
                              ${Math.abs(transaction.amount).toFixed(2)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

export default Dashboard; 