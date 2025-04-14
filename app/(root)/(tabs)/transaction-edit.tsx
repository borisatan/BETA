import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TransactionService } from '../services/transactionService';
import { AccountService } from '../services/accountService';
import { CategoryService, Category } from '../services/categoryService';
import { Transaction } from '../firebase/types';
import { auth } from '../firebase/firebaseConfig';
import { useTheme } from '../context/ThemeContext';
import Toast from 'react-native-toast-message';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { Timestamp } from 'firebase/firestore';

const TransactionEdit = () => {
  const { transactionId } = useLocalSearchParams();
  const router = useRouter();
  const { isDarkMode } = useTheme();
  
  // Transaction data states
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Data for dropdowns
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  
  // Modal states
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showPaymentMethodPicker, setShowPaymentMethodPicker] = useState(false);
  
  // Payment methods list
  const paymentMethods = ['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Mobile Payment', 'Check', 'Other'];

  useEffect(() => {
    fetchTransactionData();
  }, [transactionId]);

  const fetchTransactionData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        setError('You must be logged in to edit a transaction');
        return;
      }
      
      // Fetch the transaction
      const transactions = await TransactionService.getUserTransactions(userId);
      const transaction = transactions.find(t => t.id === transactionId);
      
      if (!transaction) {
        setError('Transaction not found');
        return;
      }
      
      // Set transaction data
      setDescription(transaction.description);
      setAmount(Math.abs(transaction.amount).toString());
      setDate(transaction.date.toDate());
      setCategoryId(transaction.categoryId);
      setAccountId(transaction.accountId);
      setTransactionType(transaction.transactionType as 'expense' | 'income');
      setNotes(transaction.notes || '');
      setPaymentMethod(transaction.paymentMethod);
      
      // Fetch categories and accounts for dropdowns
      const [userCategories, userAccounts] = await Promise.all([
        CategoryService.getUserCategories(userId),
        AccountService.getUserAccounts(userId)
      ]);
      
      setCategories(userCategories);
      setAccounts(userAccounts);
      
    } catch (error) {
      console.error('Error fetching transaction data:', error);
      setError('Failed to load transaction data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate input
    if (!description.trim() || !amount.trim() || !accountId || !categoryId) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in all required fields'
      });
      return;
    }
    
    // Validate amount is a valid number
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter a valid amount'
      });
      return;
    }
    
    setUpdating(true);
    try {
      // Prepare the transaction update data
      const transactionData: Partial<Transaction> = {
        description,
        amount: transactionType === 'expense' ? -numAmount : numAmount,
        date: Timestamp.fromDate(date),
        categoryId,
        accountId,
        transactionType,
        notes,
        paymentMethod
      };
      
      // Update the transaction
      await TransactionService.updateTransaction(transactionId as string, transactionData);
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Transaction updated successfully'
      });
      
      // Navigate back
      router.back();
      
    } catch (error) {
      console.error('Error updating transaction:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update transaction'
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const getCategoryName = (id: string) => {
    const category = categories.find(c => c.id === id);
    return category ? category.name : 'Select Category';
  };

  const getAccountName = (id: string) => {
    const account = accounts.find(a => a.id === id);
    return account ? account.name : 'Select Account';
  };

  if (loading) {
    return (
      <View className={`flex-1 items-center justify-center ${isDarkMode ? "bg-[#0A0F1F]" : "bg-white"}`}>
        <ActivityIndicator size="large" color={isDarkMode ? "#3B82F6" : "#1D4ED8"} />
        <Text className={`mt-4 ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>Loading transaction data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className={`flex-1 items-center justify-center ${isDarkMode ? "bg-[#0A0F1F]" : "bg-white"}`}>
        <MaterialIcons name="error-outline" size={48} color={isDarkMode ? "#F87171" : "#EF4444"} />
        <Text className={`mt-4 text-lg ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>{error}</Text>
        <TouchableOpacity 
          onPress={() => router.back()}
          className={`mt-6 px-4 py-2 rounded-lg ${isDarkMode ? "bg-blue-900" : "bg-blue-600"}`}
        >
          <Text className="text-white">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className={`flex-1 ${isDarkMode ? "bg-[#0A0F1F]" : "bg-white"}`}
    >
      <ScrollView className="flex-1">
        {/* Header */}
        <View className={`px-4 py-6 ${isDarkMode ? "bg-gray-900" : "bg-blue-500"}`}>
          <View className="flex-row items-center">
            <TouchableOpacity 
              onPress={() => router.back()} 
              className="mr-4"
            >
              <MaterialIcons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text className="text-white text-xl font-bold">Edit Transaction</Text>
          </View>
        </View>
        
        {/* Form */}
        <View className="p-4">
          {/* Transaction Type Selector */}
          <View className="mb-4">
            <Text className={`mb-2 font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>Transaction Type</Text>
            <View className="flex-row">
              <TouchableOpacity 
                onPress={() => setTransactionType('expense')}
                className={`flex-1 py-3 rounded-l-lg ${
                  transactionType === 'expense' 
                    ? (isDarkMode ? "bg-red-800" : "bg-red-500") 
                    : (isDarkMode ? "bg-gray-700" : "bg-gray-200")
                }`}
              >
                <Text className={`text-center ${transactionType === 'expense' ? "text-white" : (isDarkMode ? "text-gray-300" : "text-gray-700")}`}>
                  Expense
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setTransactionType('income')}
                className={`flex-1 py-3 rounded-r-lg ${
                  transactionType === 'income' 
                    ? (isDarkMode ? "bg-green-800" : "bg-green-500") 
                    : (isDarkMode ? "bg-gray-700" : "bg-gray-200")
                }`}
              >
                <Text className={`text-center ${transactionType === 'income' ? "text-white" : (isDarkMode ? "text-gray-300" : "text-gray-700")}`}>
                  Income
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Description */}
          <View className="mb-4">
            <Text className={`mb-2 font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Enter description"
              placeholderTextColor={isDarkMode ? "#4B5563" : "#9CA3AF"}
              className={`p-3 rounded-lg ${
                isDarkMode 
                  ? "bg-gray-800 text-white border-gray-700" 
                  : "bg-gray-100 text-gray-900 border-gray-200"
              } border`}
            />
          </View>
          
          {/* Amount */}
          <View className="mb-4">
            <Text className={`mb-2 font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>Amount</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={isDarkMode ? "#4B5563" : "#9CA3AF"}
              keyboardType="decimal-pad"
              className={`p-3 rounded-lg ${
                isDarkMode 
                  ? "bg-gray-800 text-white border-gray-700" 
                  : "bg-gray-100 text-gray-900 border-gray-200"
              } border`}
            />
          </View>
          
          {/* Date */}
          <View className="mb-4">
            <Text className={`mb-2 font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>Date</Text>
            <TouchableOpacity 
              onPress={() => setShowDatePicker(true)}
              className={`p-3 rounded-lg flex-row justify-between items-center ${
                isDarkMode 
                  ? "bg-gray-800 border-gray-700" 
                  : "bg-gray-100 border-gray-200"
              } border`}
            >
              <Text className={isDarkMode ? "text-white" : "text-gray-900"}>
                {date.toLocaleDateString()}
              </Text>
              <MaterialIcons 
                name="calendar-today" 
                size={20} 
                color={isDarkMode ? "#CBD5E0" : "#4B5563"} 
              />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={handleDateChange}
              />
            )}
          </View>
          
          {/* Category */}
          <View className="mb-4">
            <Text className={`mb-2 font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>Category</Text>
            <TouchableOpacity 
              onPress={() => setShowCategoryPicker(true)}
              className={`p-3 rounded-lg flex-row justify-between items-center ${
                isDarkMode 
                  ? "bg-gray-800 border-gray-700" 
                  : "bg-gray-100 border-gray-200"
              } border`}
            >
              <Text className={isDarkMode ? "text-white" : "text-gray-900"}>
                {getCategoryName(categoryId)}
              </Text>
              <MaterialIcons 
                name="arrow-drop-down" 
                size={24} 
                color={isDarkMode ? "#CBD5E0" : "#4B5563"} 
              />
            </TouchableOpacity>
          </View>
          
          {/* Account */}
          <View className="mb-4">
            <Text className={`mb-2 font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>Account</Text>
            <TouchableOpacity 
              onPress={() => setShowAccountPicker(true)}
              className={`p-3 rounded-lg flex-row justify-between items-center ${
                isDarkMode 
                  ? "bg-gray-800 border-gray-700" 
                  : "bg-gray-100 border-gray-200"
              } border`}
            >
              <Text className={isDarkMode ? "text-white" : "text-gray-900"}>
                {getAccountName(accountId)}
              </Text>
              <MaterialIcons 
                name="arrow-drop-down" 
                size={24} 
                color={isDarkMode ? "#CBD5E0" : "#4B5563"} 
              />
            </TouchableOpacity>
          </View>
          
          {/* Payment Method */}
          <View className="mb-4">
            <Text className={`mb-2 font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>Payment Method</Text>
            <TouchableOpacity 
              onPress={() => setShowPaymentMethodPicker(true)}
              className={`p-3 rounded-lg flex-row justify-between items-center ${
                isDarkMode 
                  ? "bg-gray-800 border-gray-700" 
                  : "bg-gray-100 border-gray-200"
              } border`}
            >
              <Text className={isDarkMode ? "text-white" : "text-gray-900"}>
                {paymentMethod || 'Select Payment Method'}
              </Text>
              <MaterialIcons 
                name="arrow-drop-down" 
                size={24} 
                color={isDarkMode ? "#CBD5E0" : "#4B5563"} 
              />
            </TouchableOpacity>
          </View>
          
          {/* Notes */}
          <View className="mb-6">
            <Text className={`mb-2 font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>Notes (Optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes"
              placeholderTextColor={isDarkMode ? "#4B5563" : "#9CA3AF"}
              multiline
              numberOfLines={3}
              className={`p-3 rounded-lg ${
                isDarkMode 
                  ? "bg-gray-800 text-white border-gray-700" 
                  : "bg-gray-100 text-gray-900 border-gray-200"
              } border`}
              style={{ textAlignVertical: 'top', minHeight: 100 }}
            />
          </View>
          
          {/* Action Buttons */}
          <View className="flex-row justify-between mb-8">
            <TouchableOpacity 
              onPress={() => router.back()}
              className={`px-6 py-3 rounded-lg ${isDarkMode ? "bg-gray-700" : "bg-gray-300"}`}
              style={{ width: '48%' }}
            >
              <Text className={`text-center ${isDarkMode ? "text-white" : "text-gray-800"}`}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleSave}
              disabled={updating}
              className={`px-6 py-3 rounded-lg ${isDarkMode ? "bg-blue-800" : "bg-blue-600"}`}
              style={{ width: '48%' }}
            >
              {updating ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-center text-white">Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      
      {/* Category Picker Modal */}
      <Modal
        visible={showCategoryPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className={isDarkMode ? "bg-gray-900" : "bg-white"}>
            <View className="flex-row justify-between items-center p-4 border-b border-gray-700">
              <Text className={`text-lg font-medium ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                Select Category
              </Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <MaterialIcons name="close" size={24} color={isDarkMode ? "white" : "black"} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {categories.map(category => (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => {
                    setCategoryId(category.id);
                    setShowCategoryPicker(false);
                  }}
                  className={`p-4 border-b ${
                    isDarkMode 
                      ? "border-gray-700" 
                      : "border-gray-200"
                  } ${category.id === categoryId ? (isDarkMode ? "bg-blue-900/30" : "bg-blue-50") : ""}`}
                >
                  <Text className={isDarkMode ? "text-white" : "text-gray-900"}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Account Picker Modal */}
      <Modal
        visible={showAccountPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAccountPicker(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className={isDarkMode ? "bg-gray-900" : "bg-white"}>
            <View className="flex-row justify-between items-center p-4 border-b border-gray-700">
              <Text className={`text-lg font-medium ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                Select Account
              </Text>
              <TouchableOpacity onPress={() => setShowAccountPicker(false)}>
                <MaterialIcons name="close" size={24} color={isDarkMode ? "white" : "black"} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {accounts.map(account => (
                <TouchableOpacity
                  key={account.id}
                  onPress={() => {
                    setAccountId(account.id);
                    setShowAccountPicker(false);
                  }}
                  className={`p-4 border-b ${
                    isDarkMode 
                      ? "border-gray-700" 
                      : "border-gray-200"
                  } ${account.id === accountId ? (isDarkMode ? "bg-blue-900/30" : "bg-blue-50") : ""}`}
                >
                  <Text className={isDarkMode ? "text-white" : "text-gray-900"}>
                    {account.name}
                  </Text>
                  <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                    {account.type} • {account.currency}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Payment Method Picker Modal */}
      <Modal
        visible={showPaymentMethodPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPaymentMethodPicker(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className={isDarkMode ? "bg-gray-900" : "bg-white"}>
            <View className="flex-row justify-between items-center p-4 border-b border-gray-700">
              <Text className={`text-lg font-medium ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                Select Payment Method
              </Text>
              <TouchableOpacity onPress={() => setShowPaymentMethodPicker(false)}>
                <MaterialIcons name="close" size={24} color={isDarkMode ? "white" : "black"} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {paymentMethods.map(method => (
                <TouchableOpacity
                  key={method}
                  onPress={() => {
                    setPaymentMethod(method);
                    setShowPaymentMethodPicker(false);
                  }}
                  className={`p-4 border-b ${
                    isDarkMode 
                      ? "border-gray-700" 
                      : "border-gray-200"
                  } ${method === paymentMethod ? (isDarkMode ? "bg-blue-900/30" : "bg-blue-50") : ""}`}
                >
                  <Text className={isDarkMode ? "text-white" : "text-gray-900"}>
                    {method}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

export default TransactionEdit; 