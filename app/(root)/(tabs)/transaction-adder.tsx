import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, Keyboard, KeyboardAvoidingView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import { TransactionService } from '../services/transactionService';
import { AccountService } from '../services/accountService';
import { useTheme } from '../context/ThemeContext';
import { Transaction, Account } from '../firebase/types';
import { auth } from '../firebase/firebaseConfig';
import { Timestamp } from 'firebase/firestore';
import { router } from 'expo-router';

const TransactionAdder = () => {
  const { isDarkMode } = useTheme();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [category, setCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTransactionTypePicker, setShowTransactionTypePicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPaymentMethodPicker, setShowPaymentMethodPicker] = useState(false);
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');

  // Function to close all pickers
  const closeAllPickers = () => {
    setShowDatePicker(false);
    setShowTransactionTypePicker(false);
    setShowAccountPicker(false);
    setShowCategoryPicker(false);
    setShowPaymentMethodPicker(false);
  };

  // Function to handle text input focus
  const handleInputFocus = () => {
    closeAllPickers();
  };

  // Function to handle notes text change with limits
  const handleNotesChange = (text: string) => {
    // Count the number of newlines
    const newlineCount = (text.match(/\n/g) || []).length;
    // Only update if within character limit and line limit
    if (text.length <= 200 && newlineCount < 10) {
      setNotes(text);
    }
  };

  // Add this function to handle the return key for multiline input
  const handleNotesKeyPress = (e: any) => {
    if (e.nativeEvent.key === 'Enter') {
      // If we're at the line limit, dismiss keyboard
      const newlineCount = (notes.match(/\n/g) || []).length;
      if (newlineCount >= 9) {
        Keyboard.dismiss();
      }
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'You must be logged in to fetch accounts'
        });
        return;
      }
      const userAccounts = await AccountService.getUserAccounts(userId);
      setAccounts(userAccounts);
      if (userAccounts.length > 0) {
        setSelectedAccount(userAccounts[0].id);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to fetch accounts'
      });
    }
  };

  const handleSubmit = async () => {
    if (!amount || !selectedAccount || !category) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in all required fields'
      });
      return;
    }

    try {
      const transaction: Omit<Transaction, 'id'> = {
        userId: auth.currentUser?.uid || '',
        amount: parseFloat(amount),
        date: Timestamp.fromDate(new Date(date)),
        description: notes,
        accountId: selectedAccount,
        categoryId: category,
        subcategoryId: '',
        paymentMethod: paymentMethod || '',
        notes: '',
        transactionType,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      };

      await TransactionService.createTransaction(transaction);
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Transaction added successfully'
      });

      // Reset form
      setAmount('');
      setDate(new Date());
      setCategory('');
      setPaymentMethod('');
      setNotes('');
      setTransactionType('expense');

      // Redirect to home page
      router.replace('/');
    } catch (error) {
      console.error('Error adding transaction:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to add transaction'
      });
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className={`flex-1 ${isDarkMode ? "bg-[#0A0F1F]" : "bg-white"}`}
    >
      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ padding: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full max-w-md mx-auto">
          {/* Header */}
          <View className="items-center mb-8">
            <Text className={`text-2xl font-bold ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
              Add Transaction
            </Text>
            <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              Record your income or expenses
            </Text>
          </View>

          {/* Transaction Type */}
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
              Transaction Type
            </Text>
            <TouchableOpacity 
              onPress={() => {
                setShowTransactionTypePicker(true);
                setShowAccountPicker(false);
                setShowCategoryPicker(false);
                setShowPaymentMethodPicker(false);
              }}
              className={`p-3 rounded-lg border ${
                isDarkMode 
                  ? "border-gray-700 bg-gray-800" 
                  : "border-gray-300 bg-white"
              }`}
            >
              <View className="flex-row justify-between items-center">
                <Text className={`${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                  {transactionType === 'income' ? 'Income' : 'Expense'}
                </Text>
                {showTransactionTypePicker && (
                  <Text className={`text-sm ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>▼</Text>
                )}
              </View>
            </TouchableOpacity>
            {showTransactionTypePicker && (
              <View className={`mt-1 rounded-lg border ${
                isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
              }`}>
                <TouchableOpacity 
                  onPress={() => {
                    setTransactionType('income');
                    setShowTransactionTypePicker(false);
                  }}
                  className={`p-3 border-b ${
                    isDarkMode ? "border-gray-700" : "border-gray-300"
                  }`}
                >
                  <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>Income</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => {
                    setTransactionType('expense');
                    setShowTransactionTypePicker(false);
                  }}
                  className="p-3"
                >
                  <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>Expense</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Amount */}
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
              Amount
            </Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="Enter amount"
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              onFocus={handleInputFocus}
              className={`p-3 rounded-lg border ${
                isDarkMode ? "border-gray-700 bg-gray-800 text-gray-200" : "border-gray-300 bg-white text-gray-900"
              }`}
            />
          </View>

          {/* Date */}
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
              Date
            </Text>
            <TouchableOpacity 
              onPress={() => {
                closeAllPickers();
                setShowDatePicker(true);
              }}
              className={`p-3 rounded-lg border ${
                isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
              }`}
            >
              <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>
                {date.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    setDate(selectedDate);
                  }
                }}
              />
            )}
          </View>

          {/* Account Selection */}
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
              Account
            </Text>
            <TouchableOpacity 
              onPress={() => {
                if (accounts.length === 0) {
                  Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'No accounts available. Please add an account first.'
                  });
                  return;
                }
                closeAllPickers();
                setShowAccountPicker(true);
              }}
              className={`p-3 rounded-lg border ${
                isDarkMode 
                  ? "border-gray-700 bg-gray-800" 
                  : "border-gray-300 bg-white"
              }`}
            >
              <View className="flex-row justify-between items-center">
                <Text className={`${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                  {accounts.find(acc => acc.id === selectedAccount)?.name || 'Select Account'}
                </Text>
                {showAccountPicker && (
                  <Text className={`text-sm ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>▼</Text>
                )}
              </View>
            </TouchableOpacity>
            {showAccountPicker && (
              <View className={`mt-1 rounded-lg border ${
                isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
              }`}>
                <ScrollView>
                  {accounts.map(account => (
                    <TouchableOpacity 
                      key={account.id}
                      onPress={() => {
                        setSelectedAccount(account.id);
                        setShowAccountPicker(false);
                      }}
                      className={`p-3 border-b ${
                        isDarkMode ? "border-gray-700" : "border-gray-300"
                      }`}
                    >
                      <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>
                        {account.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Category */}
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
              Category
            </Text>
            <TouchableOpacity 
              onPress={() => {
                closeAllPickers();
                setShowCategoryPicker(true);
              }}
              className={`p-3 rounded-lg border ${
                isDarkMode 
                  ? "border-gray-700 bg-gray-800" 
                  : "border-gray-300 bg-white"
              }`}
            >
              <View className="flex-row justify-between items-center">
                <Text className={`${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                  {category || 'Select Category'}
                </Text>
                {showCategoryPicker && (
                  <Text className={`text-sm ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>▼</Text>
                )}
              </View>
            </TouchableOpacity>
            {showCategoryPicker && (
              <View className={`mt-1 rounded-lg border ${
                isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
              }`}>
                <ScrollView>
                  <TouchableOpacity 
                    onPress={() => {
                      setCategory('Food & Dining');
                      setShowCategoryPicker(false);
                    }}
                    className={`p-3 border-b ${
                      isDarkMode ? "border-gray-700" : "border-gray-300"
                    }`}
                  >
                    <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>Food & Dining</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      setCategory('Transportation');
                      setShowCategoryPicker(false);
                    }}
                    className={`p-3 border-b ${
                      isDarkMode ? "border-gray-700" : "border-gray-300"
                    }`}
                  >
                    <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>Transportation</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      setCategory('Shopping');
                      setShowCategoryPicker(false);
                    }}
                    className={`p-3 border-b ${
                      isDarkMode ? "border-gray-700" : "border-gray-300"
                    }`}
                  >
                    <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>Shopping</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      setCategory('Bills & Utilities');
                      setShowCategoryPicker(false);
                    }}
                    className={`p-3 border-b ${
                      isDarkMode ? "border-gray-700" : "border-gray-300"
                    }`}
                  >
                    <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>Bills & Utilities</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      setCategory('Entertainment');
                      setShowCategoryPicker(false);
                    }}
                    className="p-3"
                  >
                    <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>Entertainment</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            )}
          </View>

          {/* Payment Method */}
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
              Payment Method (Optional)
            </Text>
            <TouchableOpacity 
              onPress={() => {
                closeAllPickers();
                setShowPaymentMethodPicker(true);
              }}
              className={`p-3 rounded-lg border ${
                isDarkMode 
                  ? "border-gray-700 bg-gray-800" 
                  : "border-gray-300 bg-white"
              }`}
            >
              <View className="flex-row justify-between items-center">
                <Text className={`${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                  {paymentMethod || 'Select Payment Method'}
                </Text>
                {showPaymentMethodPicker && (
                  <Text className={`text-sm ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>▼</Text>
                )}
              </View>
            </TouchableOpacity>
            {showPaymentMethodPicker && (
              <View className={`mt-1 rounded-lg border ${
                isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
              }`}>
                <ScrollView>
                  <TouchableOpacity 
                    onPress={() => {
                      setPaymentMethod('Transfer');
                      setShowPaymentMethodPicker(false);
                    }}
                    className={`p-3 border-b ${
                      isDarkMode ? "border-gray-700" : "border-gray-300"
                    }`}
                  >
                    <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>Transfer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      setPaymentMethod('Credit Card');
                      setShowPaymentMethodPicker(false);
                    }}
                    className={`p-3 border-b ${
                      isDarkMode ? "border-gray-700" : "border-gray-300"
                    }`}
                  >
                    <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>Credit Card</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      setPaymentMethod('Debit Card');
                      setShowPaymentMethodPicker(false);
                    }}
                    className="p-3"
                  >
                    <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>Debit Card</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            )}
          </View>

          {/* Notes */}
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
              Description
            </Text>
            <TextInput
              value={notes}
              onChangeText={(text) => {
                if (text.length <= 200) {
                  setNotes(text);
                }
              }}
              placeholder="Enter transaction description"
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              onFocus={handleInputFocus}
              className={`p-3 rounded-lg border ${
                isDarkMode ? "border-gray-700 bg-gray-800 text-gray-200" : "border-gray-300 bg-white text-gray-900"
              }`}
            />
            <Text className={`text-xs mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              {notes.length}/200 characters
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            onPress={handleSubmit}
            className={`p-4 rounded-lg items-center ${
              isDarkMode ? "bg-blue-900" : "bg-blue-600"
            }`}
          >
            <Text className="text-white font-semibold">Add Transaction</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default TransactionAdder;
