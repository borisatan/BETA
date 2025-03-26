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
        datasets: [
          {
            data: [1200, 1900, 1500, 2100], // Actual spending
            color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
            strokeWidth: 2,
            withDots: true
          },
          {
            data: [2000, 2000, 2000, 2000], // Budget line
            color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
            strokeWidth: 1,
            withDots: false
          }
        ]
      };
      setSpendingData(spendingVsBudgetData);

      // Prepare category spending data with budget comparison
      const categorySpendingData = {
        labels: categories.slice(0, 5).map(cat => cat.name),
        datasets: [{
          data: categories.slice(0, 5).map(cat => {
            const categoryTransactions = recentTransactions.filter((t: Transaction) => t.categoryId === cat.id);
            return categoryTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0);
          }),
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`
        }]
      };
      setCategoryData(categorySpendingData);

      // Prepare pie chart data with budget comparison
      const pieChartData = categories.slice(0, 5).map((cat, index) => {
        const categoryTransactions = recentTransactions.filter((t: Transaction) => t.categoryId === cat.id);
        const totalAmount = categoryTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0);
        const budget = currentBudgets.find(b => b.categories.some(c => c.categoryId === cat.id))?.categories.find(c => c.categoryId === cat.id)?.allocated || 0;
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
              const incomeTransactions = recentTransactions.filter((t: Transaction) => 
                t.accountId === acc.id && t.amount > 0
              );
              return incomeTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0);
            }),
            color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`
          },
          {
            data: accounts.map(acc => {
              const expenseTransactions = recentTransactions.filter((t: Transaction) => 
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
          title="Spending vs Budget"
          onPress={() => handleChartPress('spending', spendingData)}
        >
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
                {selectedChart === 'spending' && 'Spending Details'}
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
            {detailsData && (
              <View>
                {/* Add detailed information based on the chart type */}
                <Text className={`text-base ${
                  isDarkMode ? "text-gray-200" : "text-gray-900"
                }`}>
                  Detailed information will be displayed here based on the selected chart.
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