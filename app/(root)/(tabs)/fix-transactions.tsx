import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { fixTransactionCategories } from '../scripts/fixTransactionCategories';
import { useTheme } from '../context/ThemeContext';

export default function FixTransactionsScreen() {
  const { isDarkMode } = useTheme();
  const [isFixing, setIsFixing] = useState(false);

  const handleFix = async () => {
    try {
      setIsFixing(true);
      const result = await fixTransactionCategories();
      if (result) {
        Alert.alert(
          'Fix Completed',
          `Updated ${result.updatedCount} transactions\nErrors: ${result.errorCount}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fix transactions');
      console.error(error);
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <View className={`flex-1 p-4 ${isDarkMode ? "bg-[#0A0F1F]" : "bg-white"}`}>
      <Text className={`text-lg mb-4 ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
        This will update all transactions to move the current category to subcategory and set the main category as the category.
      </Text>
      
      <TouchableOpacity
        onPress={handleFix}
        disabled={isFixing}
        className={`p-4 rounded-lg ${isFixing ? "bg-gray-400" : (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")}`}
      >
        <Text className="text-white text-center">
          {isFixing ? 'Updating...' : 'Update Transactions'}
        </Text>
      </TouchableOpacity>
    </View>
  );
} 