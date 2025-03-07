import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, useColorScheme } from 'react-native';
import { auth } from '../firebase/firebaseConfig';
import { AccountService, TransactionService } from '../firebase/services';
import { Account, Transaction } from '../firebase/types';

const Budget = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [netSavings, setNetSavings] = useState(0);
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  useEffect(() => {
    const fetchData = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          // Fetch accounts
          const userAccounts = await AccountService.getUserAccounts(user.uid);
          setAccounts(userAccounts);
          
          // Calculate total balance
          const total = userAccounts.reduce((sum, acc) => sum + acc.balance, 0);
          setTotalBalance(total);

          // Fetch recent transactions
          const transactions = await TransactionService.getRecentTransactions(user.uid);
          setRecentTransactions(transactions);

          // Calculate net savings (income - expenses)
          const savings = transactions.reduce((sum, trans) => {
            if (trans.transactionType === 'income') return sum + trans.amount;
            if (trans.transactionType === 'expense') return sum - trans.amount;
            return sum;
          }, 0);
          setNetSavings(savings);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      }
    };
    fetchData();
  }, []);

  return (
    <ScrollView className={`flex-1 ${isDarkMode ? 'bg-[#0A0F1F]' : 'bg-white'} p-5`}>
      <View className={`mb-6 p-5 ${isDarkMode ? 'bg-blue-800' : 'bg-blue-900'} rounded-xl shadow-lg`}>
        <Text className="text-white text-2xl font-semibold">Balance Overview</Text>
        <Text className="text-gray-200 mt-1 text-lg">Total Balance: ${totalBalance.toFixed(2)}</Text>
        <Text className={`mt-1 text-lg ${netSavings >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          Net Savings: ${netSavings.toFixed(2)}
        </Text>
      </View>

      <View className={`mb-6 p-5 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-md`}>
        <Text className={`text-xl font-semibold ${isDarkMode ? 'text-gray-200' : 'text-blue-900'}`}>
          Recent Transactions
        </Text>
        {recentTransactions.length > 0 ? (
          recentTransactions.map((transaction) => (
            <View 
              key={transaction.id} 
              className={`mt-2 p-3 rounded-lg ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
              }`}
            >
              <View className="flex-row justify-between items-center">
                <Text className={`${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                  {transaction.description}
                </Text>
                <Text className={transaction.transactionType === 'expense' ? 'text-red-500' : 'text-green-500'}>
                  {transaction.transactionType === 'expense' ? '-' : '+'}${transaction.amount.toFixed(2)}
                </Text>
              </View>
              <Text className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {transaction.date.toDate().toLocaleDateString()} • {transaction.categoryId}
              </Text>
            </View>
          ))
        ) : (
          <Text className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            No recent transactions.
          </Text>
        )}
      </View>

      <View className={`mb-6 p-5 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-md`}>
        <Text className={`text-xl font-semibold ${isDarkMode ? 'text-gray-200' : 'text-blue-900'}`}>
          Budget Status
        </Text>
        <Text className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Budget data not available.
        </Text>
      </View>

      <View className={`mb-6 p-5 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-md`}>
        <Text className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-blue-900'}`}>
          Quick Actions
        </Text>
        <TouchableOpacity className={`rounded-lg p-3 mb-2 ${isDarkMode ? 'bg-blue-700' : 'bg-blue-900'}`}>
          <Text className="text-white text-center">Add Transaction</Text>
        </TouchableOpacity>
        <TouchableOpacity className="bg-amber-500 rounded-lg p-3 mb-2">
          <Text className="text-white text-center">Scan Receipt</Text>
        </TouchableOpacity>
        <TouchableOpacity className="bg-green-600 rounded-lg p-3">
          <Text className="text-white text-center">Sync with Bank</Text>
        </TouchableOpacity>
      </View>

      <View className={`mb-6 p-5 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-md`}>
        <Text className={`text-xl font-semibold ${isDarkMode ? 'text-gray-200' : 'text-blue-900'}`}>
          Navigation
        </Text>
        <Text className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Navigation bar placeholder.
        </Text>
      </View>
    </ScrollView>
  );
};

export default Budget;