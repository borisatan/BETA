import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';

const BasePage = () => {
  return (
    <ScrollView className="flex-1 bg-white p-5">
      <View className="mb-6 p-5 bg-blue-900 rounded-xl shadow-lg">
        <Text className="text-white text-2xl font-semibold">Balance Overview</Text>
        <Text className="text-gray-200 mt-1 text-lg">Total Balance: $0.00</Text>
        <Text className="text-green-400 mt-1 text-lg">Net Savings: $0.00</Text>
      </View>

      <View className="mb-6 p-5 bg-white rounded-xl shadow-md">
        <Text className="text-blue-900 text-xl font-semibold">Recent Transactions</Text>
        <Text className="text-gray-500 mt-2">No recent transactions.</Text>
      </View>

      <View className="mb-6 p-5 bg-white rounded-xl shadow-md">
        <Text className="text-blue-900 text-xl font-semibold">Budget Status</Text>
        <Text className="text-gray-500 mt-2">Budget data not available.</Text>
      </View>

      <View className="mb-6 p-5 bg-white rounded-xl shadow-md">
        <Text className="text-blue-900 text-xl font-semibold mb-2">Quick Actions</Text>
        <TouchableOpacity className="bg-blue-900 rounded-lg p-3 mb-2">
          <Text className="text-white text-center">Add Transaction</Text>
        </TouchableOpacity>
        <TouchableOpacity className="bg-amber-500 rounded-lg p-3 mb-2">
          <Text className="text-white text-center">Scan Receipt</Text>
        </TouchableOpacity>
        <TouchableOpacity className="bg-green-600 rounded-lg p-3">
          <Text className="text-white text-center">Sync with Bank</Text>
        </TouchableOpacity>
      </View>

      <View className="mb-6 p-5 bg-white rounded-xl shadow-md">
        <Text className="text-blue-900 text-xl font-semibold">Navigation</Text>
        <Text className="text-gray-500 mt-2">Navigation bar placeholder.</Text>
      </View>
    </ScrollView>
  );
};

export default BasePage;