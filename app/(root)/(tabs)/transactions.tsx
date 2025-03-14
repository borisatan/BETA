import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AccountService } from '../services/accountService';
import { TransactionService } from '../services/transactionService';
import { Account, Transaction } from '../firebase/types';
import { auth } from '../firebase/firebaseConfig';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

const Transactions = () => {
  const router = useRouter();
  const { accountId } = useLocalSearchParams();
  const { isDarkMode } = useTheme();
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    fetchAccountAndTransactions();
  }, [accountId, timeRange]);

  const fetchAccountAndTransactions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        setError('You must be logged in to view transactions');
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'You must be logged in to view transactions'
        });
        return;
      }

      // Fetch account details
      const accounts = await AccountService.getUserAccounts(userId);
      const accountData = accounts.find(acc => acc.id === accountId);
      if (accountData) {
        setAccount(accountData);
      } else {
        setError('Account not found');
        return;
      }

      // Fetch transactions for this account
      const userTransactions = await TransactionService.getAccountTransactions(accountId as string);
      setTransactions(userTransactions);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch transactions. Please try again.');
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to fetch transactions'
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    const income = transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    return { income, expenses };
  };

  const prepareChartData = () => {
    const { income, expenses } = calculateTotals();
    return [
      {
        name: 'Income',
        value: income,
        color: '#22C55E',
        legendFontColor: isDarkMode ? '#E5E7EB' : '#1F2937',
      },
      {
        name: 'Expenses',
        value: expenses,
        color: '#EF4444',
        legendFontColor: isDarkMode ? '#E5E7EB' : '#1F2937',
      }
    ];
  };

  const prepareLineChartData = () => {
    const sortedTransactions = [...transactions].sort((a, b) => 
      a.date.toDate().getTime() - b.date.toDate().getTime()
    );

    const labels = sortedTransactions.map(t => 
      t.date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );

    const data = sortedTransactions.map(t => t.amount);

    return {
      labels: labels.length ? labels : ['No Data'],
      datasets: [{
        data: data.length ? data : [0],
      }],
    };
  };

  if (loading) {
    return (
      <View className={`flex-1 items-center justify-center ${isDarkMode ? "bg-[#0A0F1F]" : "bg-white"}`}>
        <ActivityIndicator size="large" color={isDarkMode ? "#1E40AF" : "#1E3A8A"} />
        <Text className={`mt-4 ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>Loading transactions...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className={`flex-1 items-center justify-center ${isDarkMode ? "bg-[#0A0F1F]" : "bg-white"}`}>
        <Text className={`text-lg mb-4 ${isDarkMode ? "text-red-400" : "text-red-600"}`}>Error</Text>
        <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>{error}</Text>
        <TouchableOpacity 
          onPress={() => fetchAccountAndTransactions()}
          className={`mt-6 px-4 py-2 rounded-lg ${isDarkMode ? "bg-blue-900" : "bg-blue-600"}`}
        >
          <Text className="text-white">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!account) {
    return (
      <View className={`flex-1 items-center justify-center ${isDarkMode ? "bg-[#0A0F1F]" : "bg-white"}`}>
        <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>Account not found</Text>
        <TouchableOpacity 
          onPress={() => router.back()}
          className={`mt-6 px-4 py-2 rounded-lg ${isDarkMode ? "bg-blue-900" : "bg-blue-600"}`}
        >
          <Text className="text-white">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { income, expenses } = calculateTotals();
  const chartData = prepareChartData();
  const lineChartData = prepareLineChartData();

  return (
    <ScrollView 
      className={`flex-1 ${isDarkMode ? "bg-[#0A0F1F]" : "bg-white"}`}
      contentContainerStyle={{ padding: 20, paddingTop: 40 }}
    >
      <View className="w-full max-w-md mx-auto">
        {/* Header with back button */}
        <View className="flex-row justify-between items-center mb-8">
          <TouchableOpacity onPress={() => router.back()} className="p-2">
            <Text className={`text-lg ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>← Back</Text>
          </TouchableOpacity>
          <View className="flex-1 ml-4">
            <Text className={`text-2xl font-bold ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
              {account.name}
            </Text>
            <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              Transaction History
            </Text>
          </View>
        </View>

        {/* Account Summary */}
        <View className={`p-4 rounded-lg border mb-6 ${
          isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
        }`}>
          <Text className={`text-lg font-semibold mb-4 ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
            Account Summary
          </Text>
          <View className="flex-row justify-between mb-4">
            <View>
              <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                Current Balance
              </Text>
              <Text className={`text-xl font-bold ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                {account.currency} {account.balance.toFixed(2)}
              </Text>
            </View>
            <View>
              <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                Account Type
              </Text>
              <Text className={`text-xl font-bold ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                {account.type}
              </Text>
            </View>
          </View>
          <View className="flex-row justify-between">
            <View>
              <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                Income
              </Text>
              <Text className="text-xl font-bold text-green-600">
                {account.currency} {income.toFixed(2)}
              </Text>
            </View>
            <View>
              <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                Expenses
              </Text>
              <Text className="text-xl font-bold text-red-600">
                {account.currency} {expenses.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Time Range Selector */}
        <View className="flex-row justify-between mb-6">
          {(['week', 'month', 'year'] as const).map((range) => (
            <TouchableOpacity
              key={range}
              onPress={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg ${
                timeRange === range
                  ? (isDarkMode ? "bg-blue-900" : "bg-blue-600")
                  : (isDarkMode ? "bg-gray-700" : "bg-gray-200")
              }`}
            >
              <Text className={timeRange === range ? "text-white" : (isDarkMode ? "text-gray-300" : "text-gray-800")}>
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Charts */}
        <View className="mb-6">
          <Text className={`text-lg font-semibold mb-4 ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
            Overview
          </Text>
          <View className="flex-row justify-between">
            <View className="w-[48%]">
              <PieChart
                data={chartData}
                width={Dimensions.get('window').width * 0.4}
                height={220}
                chartConfig={{
                  color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                }}
                accessor="value"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            </View>
            <View className="w-[48%]">
              <LineChart
                data={lineChartData}
                width={Dimensions.get('window').width * 0.4}
                height={220}
                chartConfig={{
                  backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                  backgroundGradientFrom: isDarkMode ? '#1F2937' : '#FFFFFF',
                  backgroundGradientTo: isDarkMode ? '#1F2937' : '#FFFFFF',
                  decimalPlaces: 2,
                  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                  labelColor: (opacity = 1) => isDarkMode ? `rgba(229, 231, 235, ${opacity})` : `rgba(31, 41, 55, ${opacity})`,
                }}
                bezier
                style={{
                  marginVertical: 8,
                  borderRadius: 16,
                }}
              />
            </View>
          </View>
        </View>

        {/* Transactions List */}
        <View>
          <Text className={`text-lg font-semibold mb-4 ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
            Recent Transactions
          </Text>
          
          <View className="space-y-4">
            {transactions.length > 0 ? (
              transactions.map((transaction) => (
                <TouchableOpacity
                  key={transaction.id}
                  onPress={() => {
                    // Navigate to transaction details
                    router.push({
                      pathname: '/transaction-details',
                      params: { transactionId: transaction.id }
                    });
                  }}
                  className={`p-4 rounded-lg border ${
                    isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
                  }`}
                >
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className={`text-lg font-semibold ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                      {transaction.description}
                    </Text>
                    <Text className={`text-lg font-semibold ${
                      transaction.amount >= 0 
                        ? (isDarkMode ? "text-green-400" : "text-green-600")
                        : (isDarkMode ? "text-red-400" : "text-red-600")
                    }`}>
                      {account.currency} {transaction.amount.toFixed(2)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                      {transaction.categoryId}
                    </Text>
                    <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                      {transaction.date.toDate().toLocaleDateString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View className={`p-4 rounded-lg border ${
                isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
              }`}>
                <Text className={`text-center ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                  No transactions found
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default Transactions; 