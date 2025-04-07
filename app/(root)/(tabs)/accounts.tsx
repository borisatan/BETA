import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Platform, Alert, Keyboard, ActivityIndicator, Modal } from 'react-native';
import { AccountService } from '../services/accountService';
import { Account, RecurringIncome } from '../firebase/types';
import { auth } from '../firebase/firebaseConfig';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';

// Add the number formatting helper function
const formatNumber = (value: string | number): string => {
  // If it's a number, convert to string first
  const stringValue = typeof value === 'number' ? value.toString() : value;
  // Split the string into integer and decimal parts
  const [integerPart, decimalPart] = stringValue.split('.');
  // Add thousand separators to the integer part
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  // Return the formatted number with decimal part if it exists
  return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger;
};

const Accounts = () => {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountBalance, setNewAccountBalance] = useState('');
  const [newAccountType, setNewAccountType] = useState<'Checking' | 'Savings' | 'Cash' | 'Card'>('Checking');
  const [newAccountCurrency, setNewAccountCurrency] = useState('USD');
  // Separate state for add form dropdowns
  const [showAddTypePicker, setShowAddTypePicker] = useState(false);
  const [showAddCurrencyPicker, setShowAddCurrencyPicker] = useState(false);
  // Separate state for edit form dropdowns
  const [showEditTypePicker, setShowEditTypePicker] = useState(false);
  const [showEditCurrencyPicker, setShowEditCurrencyPicker] = useState(false);
  // Add a new state for loading at the top with other states
  const [isLoading, setIsLoading] = useState(true);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeDescription, setIncomeDescription] = useState('');
  const [isRecurringIncome, setIsRecurringIncome] = useState(false);
  const [incomeRecurrenceType, setIncomeRecurrenceType] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'>('monthly');
  const [incomeRecurrenceInterval, setIncomeRecurrenceInterval] = useState('1');
  const [showRecurrenceOptions, setShowRecurrenceOptions] = useState(false);
  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>([]);
  const [editingRecurringIncome, setEditingRecurringIncome] = useState<RecurringIncome | null>(null);
  const [showEditRecurringIncomeModal, setShowEditRecurringIncomeModal] = useState(false);
  // Add state for tracking recurring income processing
  const [isProcessingRecurringIncomes, setIsProcessingRecurringIncomes] = useState(false);
  const [recurringIncomeProcessingResult, setRecurringIncomeProcessingResult] = useState<{
    processed: number;
    errors: number;
  } | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setIsLoading(true); // Set loading to true when starting to fetch
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
      
      // Process any due recurring incomes before fetching accounts
      await processRecurringIncomes(userId);
      
      const userAccounts = await AccountService.getUserAccounts(userId);
      setAccounts(userAccounts);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to fetch accounts'
      });
    } finally {
      setIsLoading(false); // Set loading to false when done
    }
  };

  // New function to check and process recurring incomes
  const processRecurringIncomes = async (userId: string) => {
    setIsProcessingRecurringIncomes(true);
    try {
      console.log('Checking for due recurring incomes...');
      const result = await AccountService.processAllDueRecurringIncomes(userId);
      setRecurringIncomeProcessingResult(result);
      
      if (result.processed > 0) {
        Toast.show({
          type: 'success',
          text1: 'Recurring Income',
          text2: `Processed ${result.processed} recurring income payments`,
          position: 'bottom',
          visibilityTime: 4000,
        });
      }
      
      if (result.errors > 0) {
        Toast.show({
          type: 'error',
          text1: 'Warning',
          text2: `Failed to process ${result.errors} recurring incomes`,
          position: 'bottom',
          visibilityTime: 4000,
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error processing recurring incomes:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to process recurring incomes',
        position: 'bottom',
      });
      return { processed: 0, errors: 0 };
    } finally {
      setIsProcessingRecurringIncomes(false);
    }
  };

  const handleAddAccount = async () => {
    if (!newAccountName.trim() || !newAccountBalance.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in all required fields'
      });
      return;
    }

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'You must be logged in to add an account'
        });
        return;
      }

      const accountData: Omit<Account, 'id'> = {
        userId,
        name: newAccountName,
        balance: parseFloat(newAccountBalance),
        type: newAccountType,
        currency: newAccountCurrency,
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any
      };

      await AccountService.createAccount(accountData);
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Account added successfully'
      });

      // Reset form
      setNewAccountName('');
      setNewAccountBalance('');
      setNewAccountType('Checking');
      setNewAccountCurrency('USD');
      setShowAddAccount(false);

      // Refresh accounts list
      fetchAccounts();
    } catch (error) {
      console.error('Error adding account:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to add account'
      });
    }
  };

  // Function to close all pickers
  const closeAllPickers = () => {
    setShowAddTypePicker(false);
    setShowAddCurrencyPicker(false);
    setShowEditTypePicker(false);
    setShowEditCurrencyPicker(false);
  };

  // Function to handle account edit
  const handleEditAccount = async () => {
    if (!editingAccount || !newAccountName.trim() || !newAccountBalance.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in all required fields'
      });
      return;
    }

    try {
      const updatedAccount: Partial<Account> = {
        name: newAccountName,
        balance: parseFloat(newAccountBalance),
        type: newAccountType,
        currency: newAccountCurrency,
        updatedAt: serverTimestamp() as any
      };

      await AccountService.updateAccount(editingAccount.id, updatedAccount);
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Account updated successfully'
      });

      // Reset form and refresh accounts
      setEditingAccount(null);
      setNewAccountName('');
      setNewAccountBalance('');
      setNewAccountType('Checking');
      setNewAccountCurrency('USD');
      fetchAccounts();
    } catch (error) {
      console.error('Error updating account:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update account'
      });
    }
  };

  // Function to start editing an account
  const startEditingAccount = async (account: Account) => {
    setEditingAccount(account);
    setNewAccountName(account.name);
    setNewAccountBalance(account.balance.toString());
    setNewAccountType(account.type);
    setNewAccountCurrency(account.currency);
    // Fetch recurring incomes for this account
    await fetchRecurringIncomes(account.id);
  };

  // Function to reset form
  const resetForm = () => {
    setNewAccountName('');
    setNewAccountBalance('');
    setNewAccountType('Checking');
    setNewAccountCurrency('USD');
    setShowAddAccount(false);
    setEditingAccount(null);
  };

  // Function to handle account deletion
  const handleDeleteAccount = async (account: Account) => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete this account? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await AccountService.deleteAccount(account.id);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Account deleted successfully'
              });
              fetchAccounts();
            } catch (error) {
              console.error('Error deleting account:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to delete account'
              });
            }
          }
        }
      ]
    );
  };

  const handleAccountPress = (account: Account) => {
    if (isEditMode) {
      startEditingAccount(account);
    } else {
      setSelectedAccount(account);
      setShowIncomeModal(true);
      // Reset income form
      setIncomeAmount('');
      setIncomeDescription('');
      setIsRecurringIncome(false);
      setIncomeRecurrenceType('monthly');
      setIncomeRecurrenceInterval('1');
      setShowRecurrenceOptions(false);
    }
  };

  const handleAddIncome = async () => {
    try {
      if (!selectedAccount || !incomeAmount) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Please enter an amount',
          position: 'bottom'
        });
        return;
      }

      // Remove any commas and convert to number
      const cleanAmount = parseFloat(incomeAmount.replace(/,/g, ''));

      if (isNaN(cleanAmount)) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Please enter a valid amount',
          position: 'bottom'
        });
        return;
      }

      if (isRecurringIncome) {
        // Add recurring income
        await AccountService.addRecurringIncome(selectedAccount.id, {
          amount: cleanAmount,
          description: incomeDescription || 'Recurring Income',
          recurrenceType: incomeRecurrenceType,
          recurrenceInterval: parseInt(incomeRecurrenceInterval),
          nextRecurrenceDate: Timestamp.fromDate(new Date())
        });

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Recurring income added successfully',
          position: 'bottom'
        });
      } else {
        // Add one-time income
        await AccountService.addIncome(selectedAccount.id, {
          amount: cleanAmount,
          description: incomeDescription || 'Income'
        });

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Income added successfully',
          position: 'bottom'
        });
      }

      // Reset form and close modal
      setIncomeAmount('');
      setIncomeDescription('');
      setIsRecurringIncome(false);
      setIncomeRecurrenceType('monthly');
      setIncomeRecurrenceInterval('1');
      setShowRecurrenceOptions(false);
      setShowIncomeModal(false);
      setSelectedAccount(null);

      // Refresh accounts
      fetchAccounts();
    } catch (error) {
      console.error('Error adding income:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to add income',
        position: 'bottom'
      });
    }
  };

  const handleDeleteRecurringIncome = async (recurringIncomeId: string) => {
    Alert.alert(
      "Delete Recurring Income",
      "Are you sure you want to delete this recurring income? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (!selectedAccount) return;

              await AccountService.deleteRecurringIncome(selectedAccount.id, recurringIncomeId);
              
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Recurring income deleted successfully',
                position: 'bottom'
              });

              // Refresh recurring incomes
              fetchRecurringIncomes(selectedAccount.id);
            } catch (error) {
              console.error('Error deleting recurring income:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to delete recurring income',
                position: 'bottom'
              });
            }
          }
        }
      ]
    );
  };

  const handleEditRecurringIncome = (income: RecurringIncome) => {
    setEditingRecurringIncome(income);
    setIncomeAmount(income.amount.toString());
    setIncomeDescription(income.description);
    setIsRecurringIncome(true);
    setIncomeRecurrenceType(income.recurrenceType);
    setIncomeRecurrenceInterval(income.recurrenceInterval.toString());
    setShowRecurrenceOptions(true);
    setShowEditRecurringIncomeModal(true);
  };

  const handleUpdateRecurringIncome = async () => {
    try {
      if (!selectedAccount || !editingRecurringIncome) return;

      // Remove any commas and convert to number
      const cleanAmount = parseFloat(incomeAmount.replace(/,/g, ''));

      if (isNaN(cleanAmount)) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Please enter a valid amount',
          position: 'bottom'
        });
        return;
      }

      await AccountService.updateRecurringIncome(selectedAccount.id, editingRecurringIncome.id, {
        amount: cleanAmount,
        description: incomeDescription,
        recurrenceType: incomeRecurrenceType,
        recurrenceInterval: parseInt(incomeRecurrenceInterval),
        nextRecurrenceDate: editingRecurringIncome.nextRecurrenceDate
      });
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Recurring income updated successfully',
        position: 'bottom'
      });

      // Reset form and close modal
      setIncomeAmount('');
      setIncomeDescription('');
      setIsRecurringIncome(false);
      setIncomeRecurrenceType('monthly');
      setIncomeRecurrenceInterval('1');
      setShowRecurrenceOptions(false);
      setShowEditRecurringIncomeModal(false);
      setEditingRecurringIncome(null);

      // Refresh recurring incomes
      fetchRecurringIncomes(selectedAccount.id);
    } catch (error) {
      console.error('Error updating recurring income:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update recurring income',
        position: 'bottom'
      });
    }
  };

  const fetchRecurringIncomes = async (accountId: string) => {
    try {
      const incomes = await AccountService.getAccountRecurringIncomes(accountId);
      setRecurringIncomes(incomes);
    } catch (error) {
      console.error('Error fetching recurring incomes:', error);
    }
  };

  return (
    <ScrollView 
      className={`flex-1 ${isDarkMode ? "bg-[#0A0F1F]" : "bg-white"}`}
      contentContainerStyle={{ padding: 20, paddingTop: 40 }}
    >
      <View className="w-full max-w-md mx-auto">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-8">
          <View>
            <Text className={`text-2xl font-bold ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
              Accounts
            </Text>
            <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              Manage your financial accounts
            </Text>
          </View>
          <View className="flex-row">
            <TouchableOpacity 
              onPress={async () => {
                const userId = auth.currentUser?.uid;
                if (userId) {
                  await processRecurringIncomes(userId);
                  fetchAccounts();
                }
              }}
              className={`px-4 py-2 rounded-lg mr-2 ${
                isDarkMode ? "bg-gray-700" : "bg-gray-200"
              }`}
              disabled={isProcessingRecurringIncomes}
            >
              <MaterialIcons 
                name="refresh" 
                size={20} 
                color={isDarkMode ? "#E5E7EB" : "#1F2937"} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setIsEditMode(!isEditMode)}
              className={`px-4 py-2 rounded-lg ${
                isEditMode 
                  ? (isDarkMode ? "bg-blue-900" : "bg-blue-600")
                  : (isDarkMode ? "bg-gray-700" : "bg-gray-200")
              }`}
            >
              <Text className={isEditMode ? "text-white" : (isDarkMode ? "text-gray-300" : "text-gray-800")}>
                {isEditMode ? "Done" : "Edit"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recurring Income Processing Indicator */}
        {isProcessingRecurringIncomes && (
          <View className={`p-4 rounded-lg mb-4 ${
            isDarkMode ? "bg-gray-800" : "bg-gray-100"
          }`}>
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color={isDarkMode ? "#1E40AF" : "#1E3A8A"} />
              <Text className={`ml-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                Processing recurring income payments...
              </Text>
            </View>
          </View>
        )}
        
        {/* Recurring Income Processing Results */}
        {!isProcessingRecurringIncomes && recurringIncomeProcessingResult && recurringIncomeProcessingResult.processed > 0 && (
          <View className={`p-4 rounded-lg mb-4 ${
            isDarkMode ? "bg-blue-900" : "bg-blue-100"
          }`}>
            <View className="flex-row items-center">
              <MaterialIcons name="check-circle" size={20} color={isDarkMode ? "#93C5FD" : "#1E3A8A"} />
              <Text className={`ml-2 ${isDarkMode ? "text-blue-200" : "text-blue-800"}`}>
                Processed {recurringIncomeProcessingResult.processed} recurring income payments
              </Text>
            </View>
          </View>
        )}

        {/* Add Account Button */}
        <TouchableOpacity 
          onPress={() => {
            resetForm();
            setShowAddAccount(true);
          }}
          className={`p-4 rounded-lg items-center mb-6 ${
            isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]"
          }`}
        >
          <Text className="text-white font-semibold">Add New Account</Text>
        </TouchableOpacity>

        {/* Loading Indicator */}
        {isLoading && (
          <View className="items-center mb-6">
            <ActivityIndicator size="large" color={isDarkMode ? "#1E40AF" : "#1E3A8A"} />
            <Text className={`mt-2 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              Loading accounts...
            </Text>
          </View>
        )}

        {/* Add Account Form */}
        {showAddAccount && (
          <View className={`p-4 rounded-lg border mb-6 ${
            isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
          }`}>
            <Text className={`text-lg font-semibold mb-4 ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
              New Account
            </Text>
            
            {/* Account Name Input */}
            <TextInput
              value={newAccountName}
              onChangeText={setNewAccountName}
              placeholder="Account Name"
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              className={`p-3 rounded-lg border mb-4 ${
                isDarkMode ? "border-gray-700 bg-gray-800 text-gray-200" : "border-gray-300 bg-white text-gray-900"
              }`}
            />

            {/* Account Balance Input */}
            <TextInput
              value={newAccountBalance}
              onChangeText={setNewAccountBalance}
              placeholder="Initial Balance"
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              className={`p-3 rounded-lg border mb-4 ${
                isDarkMode ? "border-gray-700 bg-gray-800 text-gray-200" : "border-gray-300 bg-white text-gray-900"
              }`}
            />

            {/* Account Type Dropdown */}
            <View className="mb-4">
              <Text className={`text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
                Account Type
              </Text>
              <TouchableOpacity 
                onPress={() => {
                  closeAllPickers();
                  setShowAddTypePicker(true);
                }}
                className={`p-3 rounded-lg border ${
                  isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
                }`}
              >
                <View className="flex-row justify-between items-center">
                  <Text className={`${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                    {newAccountType}
                  </Text>
                  {showAddTypePicker && (
                    <Text className={`text-sm ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>▼</Text>
                  )}
                </View>
              </TouchableOpacity>
              {showAddTypePicker && (
                <View className={`mt-1 rounded-lg border ${
                  isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
                }`}>
                  <TouchableOpacity 
                    onPress={() => {
                      setNewAccountType('Checking');
                      setShowAddTypePicker(false);
                    }}
                    className={`p-3 border-b ${
                      isDarkMode ? "border-gray-700" : "border-gray-300"
                    }`}
                  >
                    <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>Checking</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      setNewAccountType('Savings');
                      setShowAddTypePicker(false);
                    }}
                    className={`p-3 border-b ${
                      isDarkMode ? "border-gray-700" : "border-gray-300"
                    }`}
                  >
                    <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>Savings</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      setNewAccountType('Cash');
                      setShowAddTypePicker(false);
                    }}
                    className={`p-3 border-b ${
                      isDarkMode ? "border-gray-700" : "border-gray-300"
                    }`}
                  >
                    <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>Cash</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      setNewAccountType('Card');
                      setShowAddTypePicker(false);
                    }}
                    className="p-3"
                  >
                    <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>Card</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Currency Dropdown */}
            <View className="mb-4">
              <Text className={`text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
                Currency
              </Text>
              <TouchableOpacity 
                onPress={() => {
                  closeAllPickers();
                  setShowAddCurrencyPicker(true);
                }}
                className={`p-3 rounded-lg border ${
                  isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
                }`}
              >
                <View className="flex-row justify-between items-center">
                  <Text className={`${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                    {newAccountCurrency}
                  </Text>
                  {showAddCurrencyPicker && (
                    <Text className={`text-sm ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>▼</Text>
                  )}
                </View>
              </TouchableOpacity>
              {showAddCurrencyPicker && (
                <View className={`mt-1 rounded-lg border ${
                  isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
                }`}>
                  <TouchableOpacity 
                    onPress={() => {
                      setNewAccountCurrency('USD');
                      setShowAddCurrencyPicker(false);
                    }}
                    className={`p-3 border-b ${
                      isDarkMode ? "border-gray-700" : "border-gray-300"
                    }`}
                  >
                    <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>USD</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      setNewAccountCurrency('EUR');
                      setShowAddCurrencyPicker(false);
                    }}
                    className="p-3"
                  >
                    <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>EUR</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View className="flex-row justify-between">
              <TouchableOpacity 
                onPress={resetForm}
                className={`flex-1 p-3 rounded-lg mr-2 ${
                  isDarkMode ? "bg-gray-700" : "bg-gray-200"
                }`}
              >
                <Text className={`text-center ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleAddAccount}
                className={`flex-1 p-3 rounded-lg ${
                  isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]"
                }`}
              >
                <Text className="text-white text-center">Add Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Accounts List */}
        <View className="space-y-4">
          {accounts.map((account) => (
            <View key={account.id}>
              <TouchableOpacity 
                onPress={() => handleAccountPress(account)}
                className={`p-4 rounded-lg border ${
                  isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
                }`}
              >
                <View className="flex-row justify-between items-center mb-2">
                  <View className="flex-row items-center">
                    <Text className={`text-lg font-semibold ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                      {account.name}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Text className={`text-lg font-semibold mr-4 ${
                      account.balance >= 0 
                        ? (isDarkMode ? "text-green-400" : "text-green-600")
                        : (isDarkMode ? "text-red-400" : "text-red-600")
                    }`}>
                      {account.currency} {formatNumber(account.balance.toFixed(2))}
                    </Text>
                    {isEditMode && (
                      <TouchableOpacity 
                        onPress={() => handleDeleteAccount(account)}
                        className={`w-8 h-8 rounded-full items-center justify-center ${
                          isDarkMode ? "bg-red-900" : "bg-red-100"
                        }`}
                      >
                        <MaterialIcons 
                          name="remove" 
                          size={20} 
                          color={isDarkMode ? "#FCA5A5" : "#EF4444"} 
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <View className="flex-row justify-between">
                  <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                    {account.type}
                  </Text>
                  <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                    Last updated: {account.updatedAt.toDate().toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Edit Form - Only show for the selected account and in edit mode */}
              {isEditMode && editingAccount?.id === account.id && (
                <View className={`mt-2 p-4 rounded-lg border ${
                  isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
                }`}>
                  <Text className={`text-lg font-semibold mb-4 ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                    Edit Account
                  </Text>
                  
                  {/* Account Name Input */}
                  <Text className={`text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>Account Name</Text>
                  <TextInput
                    value={newAccountName}
                    onChangeText={setNewAccountName}
                    placeholder="Account Name"
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    className={`p-3 rounded-lg border mb-4 ${
                      isDarkMode ? "border-gray-700 bg-gray-800 text-gray-200" : "border-gray-300 bg-white text-gray-900"
                    }`}
                  />

                  {/* Account Balance Input */}
                  <Text className={`text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
                      Account Balance
                  </Text>
                  <TextInput
                    value={newAccountBalance}
                    onChangeText={setNewAccountBalance}
                    placeholder="Initial Balance"
                    keyboardType="numeric"
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    className={`p-3 rounded-lg border mb-4 ${
                      isDarkMode ? "border-gray-700 bg-gray-800 text-gray-200" : "border-gray-300 bg-white text-gray-900"
                    }`}
                  />

                  {/* Account Type Dropdown */}
                  <View className="mb-4">
                    <Text className={`text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
                      Account Type
                    </Text>
                    <TouchableOpacity 
                      onPress={() => {
                        closeAllPickers();
                        setShowEditTypePicker(true);
                      }}
                      className={`p-3 rounded-lg border ${
                        isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
                      }`}
                    >
                      <View className="flex-row justify-between items-center">
                        <Text className={`${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                          {newAccountType}
                        </Text>
                        {showEditTypePicker && (
                          <Text className={`text-sm ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>▼</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                    {showEditTypePicker && (
                      <View className={`mt-1 rounded-lg border ${
                        isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
                      }`}>
                        <TouchableOpacity 
                          onPress={() => {
                            setNewAccountType('Checking');
                            setShowEditTypePicker(false);
                          }}
                          className={`p-3 border-b ${
                            isDarkMode ? "border-gray-700" : "border-gray-300"
                          }`}
                        >
                          <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>Checking</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => {
                            setNewAccountType('Savings');
                            setShowEditTypePicker(false);
                          }}
                          className={`p-3 border-b ${
                            isDarkMode ? "border-gray-700" : "border-gray-300"
                          }`}
                        >
                          <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>Savings</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => {
                            setNewAccountType('Cash');
                            setShowEditTypePicker(false);
                          }}
                          className={`p-3 border-b ${
                            isDarkMode ? "border-gray-700" : "border-gray-300"
                          }`}
                        >
                          <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>Cash</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => {
                            setNewAccountType('Card');
                            setShowEditTypePicker(false);
                          }}
                          className="p-3"
                        >
                          <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>Card</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Currency Dropdown */}
                  <View className="mb-4">
                    <Text className={`text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
                      Currency
                    </Text>
                    <TouchableOpacity 
                      onPress={() => {
                        closeAllPickers();
                        setShowEditCurrencyPicker(true);
                      }}
                      className={`p-3 rounded-lg border ${
                        isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
                      }`}
                    >
                      <View className="flex-row justify-between items-center">
                        <Text className={`${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                          {newAccountCurrency}
                        </Text>
                        {showEditCurrencyPicker && (
                          <Text className={`text-sm ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>▼</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                    {showEditCurrencyPicker && (
                      <View className={`mt-1 rounded-lg border ${
                        isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
                      }`}>
                        <TouchableOpacity 
                          onPress={() => {
                            setNewAccountCurrency('USD');
                            setShowEditCurrencyPicker(false);
                          }}
                          className={`p-3 border-b ${
                            isDarkMode ? "border-gray-700" : "border-gray-300"
                          }`}
                        >
                          <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>USD</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => {
                            setNewAccountCurrency('EUR');
                            setShowEditCurrencyPicker(false);
                          }}
                          className="p-3"
                        >
                          <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>EUR</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Recurrence Income Section */}
                  <View className="mb-4">
                    <Text className={`text-lg font-semibold mb-4 ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                      Recurring Income
                    </Text>
                    {recurringIncomes.length > 0 ? (
                      <View className="space-y-3">
                        {recurringIncomes.map((income) => (
                          <View 
                            key={income.id}
                            className={`p-4 rounded-lg ${
                              isDarkMode ? "bg-gray-700" : "bg-gray-100"
                            }`}
                          >
                            <View className="flex-row justify-between items-center mb-2">
                              <Text className={`font-semibold ${
                                isDarkMode ? "text-gray-200" : "text-gray-900"
                              }`}>
                                ${formatNumber(income.amount.toFixed(2))}
                              </Text>
                              <View className="flex-row">
                                <TouchableOpacity
                                  onPress={() => handleEditRecurringIncome(income)}
                                  className="mr-4"
                                >
                                  <MaterialIcons 
                                    name="edit" 
                                    size={20} 
                                    color={isDarkMode ? "#E5E7EB" : "#1F2937"} 
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => handleDeleteRecurringIncome(income.id)}
                                >
                                  <MaterialIcons 
                                    name="delete" 
                                    size={20} 
                                    color={isDarkMode ? "#EF4444" : "#B91C1C"} 
                                  />
                                </TouchableOpacity>
                              </View>
                            </View>
                            <Text className={`text-sm ${
                              isDarkMode ? "text-gray-400" : "text-gray-600"
                            }`}>
                              {income.description}
                            </Text>
                            <Text className={`text-sm ${
                              isDarkMode ? "text-gray-400" : "text-gray-600"
                            }`}>
                              {income.recurrenceType.charAt(0).toUpperCase() + income.recurrenceType.slice(1)}
                              {income.recurrenceType === 'custom' ? ` (${income.recurrenceInterval} months)` : ''}
                            </Text>
                            <Text className={`text-sm ${
                              isDarkMode ? "text-gray-400" : "text-gray-600"
                            }`}>
                              Next: {income.nextRecurrenceDate.toDate().toLocaleDateString()}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                        No recurring income set for this account
                      </Text>
                    )}
                  </View>

                  <View className="flex-row justify-between">
                    <TouchableOpacity 
                      onPress={resetForm}
                      className={`flex-1 p-3 rounded-lg mr-2 ${
                        isDarkMode ? "bg-gray-700" : "bg-gray-200"
                      }`}
                    >
                      <Text className={`text-center ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={handleEditAccount}
                      className={`flex-1 p-3 rounded-lg ${
                        isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]"
                      }`}
                    >
                      <Text className="text-white text-center">Update Account</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Income Modal */}
      <Modal
        visible={showIncomeModal}
        transparent={true}
        animationType="slide"
      >
        <View className="flex-1 justify-end">
          <View className={`rounded-t-3xl p-6 ${
            isDarkMode ? "bg-gray-800" : "bg-white"
          }`}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className={`text-xl font-bold ${
                isDarkMode ? "text-gray-200" : "text-gray-900"
              }`}>
                {isEditMode ? 'Manage Income' : 'Add Income to'} {selectedAccount?.name}
              </Text>
              <TouchableOpacity onPress={() => setShowIncomeModal(false)}>
                <Text className={isDarkMode ? "text-gray-400" : "text-gray-600"}>Close</Text>
              </TouchableOpacity>
            </View>

            {isEditMode && recurringIncomes.length > 0 && (
              <View className="mb-6">
                <Text className={`text-lg font-semibold mb-4 ${
                  isDarkMode ? "text-gray-200" : "text-gray-900"
                }`}>
                  Recurring Incomes
                </Text>
                {recurringIncomes.map((income) => (
                  <View 
                    key={income.id}
                    className={`p-4 rounded-lg mb-3 ${
                      isDarkMode ? "bg-gray-700" : "bg-gray-100"
                    }`}
                  >
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className={`font-semibold ${
                        isDarkMode ? "text-gray-200" : "text-gray-900"
                      }`}>
                        ${formatNumber(income.amount.toFixed(2))}
                      </Text>
                      <View className="flex-row">
                        <TouchableOpacity
                          onPress={() => handleEditRecurringIncome(income)}
                          className="mr-4"
                        >
                          <MaterialIcons 
                            name="edit" 
                            size={20} 
                            color={isDarkMode ? "#E5E7EB" : "#1F2937"} 
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteRecurringIncome(income.id)}
                        >
                          <MaterialIcons 
                            name="delete" 
                            size={20} 
                            color={isDarkMode ? "#EF4444" : "#B91C1C"} 
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text className={`text-sm ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>
                      {income.description}
                    </Text>
                    <Text className={`text-sm ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>
                      {income.recurrenceType.charAt(0).toUpperCase() + income.recurrenceType.slice(1)}
                      {income.recurrenceType === 'custom' ? ` (${income.recurrenceInterval} months)` : ''}
                    </Text>
                    <Text className={`text-sm ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>
                      Next: {income.nextRecurrenceDate.toDate().toLocaleDateString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View className="space-y-4">
              {/* Amount Input */}
              <View className="mb-4">
                <Text className={`text-sm mb-1 ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}>
                  Amount
                </Text>
                <TextInput
                  value={incomeAmount}
                  onChangeText={(text) => {
                    // Remove any non-numeric characters except decimal point and comma
                    const cleaned = text.replace(/[^0-9.,]/g, '');
                    // Ensure only one decimal point
                    const parts = cleaned.split('.');
                    if (parts.length > 2) {
                      return;
                    }
                    // Format the integer part with commas
                    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                    // Combine with decimal part if it exists
                    const formatted = parts.length > 1 ? `${integerPart}.${parts[1]}` : integerPart;
                    setIncomeAmount(formatted);
                  }}
                  placeholder="Enter amount"
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  className={`p-4 rounded-lg ${
                    isDarkMode 
                      ? "bg-gray-700 text-gray-200" 
                      : "bg-gray-100 text-gray-900"
                  }`}
                />
              </View>

              {/* Description Input */}
              <View className="mb-4">
                <Text className={`text-sm mb-1 ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}>
                  Description (Optional)
                </Text>
                <TextInput
                  value={incomeDescription}
                  onChangeText={setIncomeDescription}
                  placeholder="Enter description"
                  className={`p-4 rounded-lg ${
                    isDarkMode 
                      ? "bg-gray-700 text-gray-200" 
                      : "bg-gray-100 text-gray-900"
                  }`}
                />
              </View>

              {/* Recurrence Toggle */}
              <View className="mb-4">
                <Text className={`text-sm mb-1 ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}>
                  Income Type
                </Text>
                <View className="flex-row">
                  <TouchableOpacity
                    onPress={() => {
                      setIsRecurringIncome(false);
                      setShowRecurrenceOptions(false);
                    }}
                    className={`flex-1 p-3 rounded-l-lg ${
                      !isRecurringIncome
                        ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                        : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                    }`}
                  >
                    <Text className={`text-center ${
                      !isRecurringIncome ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                    }`}>
                      One-time
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setIsRecurringIncome(true);
                      setShowRecurrenceOptions(true);
                    }}
                    className={`flex-1 p-3 rounded-r-lg ${
                      isRecurringIncome
                        ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                        : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                    }`}
                  >
                    <Text className={`text-center ${
                      isRecurringIncome ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                    }`}>
                      Recurring
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Recurrence Options */}
              {showRecurrenceOptions && (
                <View className="mt-4">
                  <Text className={`text-sm mb-2 ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}>
                    Recurrence Type
                  </Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    className="flex-row"
                  >
                    <TouchableOpacity
                      onPress={() => setIncomeRecurrenceType('daily')}
                      className={`mr-3 px-4 py-2 rounded-full ${
                        incomeRecurrenceType === 'daily'
                          ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                          : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                      }`}
                    >
                      <Text className={`${
                        incomeRecurrenceType === 'daily' ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                      }`}>
                        Daily
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setIncomeRecurrenceType('weekly')}
                      className={`mr-3 px-4 py-2 rounded-full ${
                        incomeRecurrenceType === 'weekly'
                          ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                          : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                      }`}
                    >
                      <Text className={`${
                        incomeRecurrenceType === 'weekly' ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                      }`}>
                        Weekly
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setIncomeRecurrenceType('biweekly')}
                      className={`mr-3 px-4 py-2 rounded-full ${
                        incomeRecurrenceType === 'biweekly'
                          ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                          : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                      }`}
                    >
                      <Text className={`${
                        incomeRecurrenceType === 'biweekly' ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                      }`}>
                        Biweekly
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setIncomeRecurrenceType('monthly')}
                      className={`mr-3 px-4 py-2 rounded-full ${
                        incomeRecurrenceType === 'monthly'
                          ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                          : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                      }`}
                    >
                      <Text className={`${
                        incomeRecurrenceType === 'monthly' ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                      }`}>
                        Monthly
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setIncomeRecurrenceType('custom')}
                      className={`mr-3 px-4 py-2 rounded-full ${
                        incomeRecurrenceType === 'custom'
                          ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                          : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                      }`}
                    >
                      <Text className={`${
                        incomeRecurrenceType === 'custom' ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                      }`}>
                        Custom
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>

                  {incomeRecurrenceType === 'custom' && (
                    <View className="mt-4">
                      <Text className={`text-sm mb-1 ${
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      }`}>
                        Interval (months)
                      </Text>
                      <View className="flex-row">
                        <TextInput
                          value={incomeRecurrenceInterval}
                          onChangeText={setIncomeRecurrenceInterval}
                          keyboardType="numeric"
                          returnKeyType="done"
                          className={`flex-1 p-4 rounded-l-lg ${
                            isDarkMode 
                              ? "bg-gray-700 text-gray-200" 
                              : "bg-gray-100 text-gray-900"
                          }`}
                        />
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View className="flex-row justify-between mt-6">
              <TouchableOpacity
                onPress={() => setShowIncomeModal(false)}
                className={`flex-1 mr-2 p-4 rounded-lg ${
                  isDarkMode ? "bg-gray-700" : "bg-gray-200"
                }`}
              >
                <Text className={`text-center ${
                  isDarkMode ? "text-gray-200" : "text-gray-900"
                }`}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddIncome}
                className={`flex-1 ml-2 p-4 rounded-lg ${
                  isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]"
                }`}
              >
                <Text className="text-white text-center">
                  Add Income
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Recurring Income Modal */}
      <Modal
        visible={showEditRecurringIncomeModal}
        transparent={true}
        animationType="slide"
      >
        <View className="flex-1 justify-end">
          <View className={`rounded-t-3xl p-6 ${
            isDarkMode ? "bg-gray-800" : "bg-white"
          }`}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className={`text-xl font-bold ${
                isDarkMode ? "text-gray-200" : "text-gray-900"
              }`}>
                Edit Recurring Income
              </Text>
              <TouchableOpacity onPress={() => setShowEditRecurringIncomeModal(false)}>
                <Text className={isDarkMode ? "text-gray-400" : "text-gray-600"}>Close</Text>
              </TouchableOpacity>
            </View>

            <View className="space-y-4">
              {/* Amount Input */}
              <View className="mb-4">
                <Text className={`text-sm mb-1 ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}>
                  Amount
                </Text>
                <TextInput
                  value={incomeAmount}
                  onChangeText={(text) => {
                    // Remove any non-numeric characters except decimal point and comma
                    const cleaned = text.replace(/[^0-9.,]/g, '');
                    // Ensure only one decimal point
                    const parts = cleaned.split('.');
                    if (parts.length > 2) {
                      return;
                    }
                    // Format the integer part with commas
                    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                    // Combine with decimal part if it exists
                    const formatted = parts.length > 1 ? `${integerPart}.${parts[1]}` : integerPart;
                    setIncomeAmount(formatted);
                  }}
                  placeholder="Enter amount"
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  className={`p-4 rounded-lg ${
                    isDarkMode 
                      ? "bg-gray-700 text-gray-200" 
                      : "bg-gray-100 text-gray-900"
                  }`}
                />
              </View>

              {/* Description Input */}
              <View className="mb-4">
                <Text className={`text-sm mb-1 ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}>
                  Description
                </Text>
                <TextInput
                  value={incomeDescription}
                  onChangeText={setIncomeDescription}
                  placeholder="Enter description"
                  className={`p-4 rounded-lg ${
                    isDarkMode 
                      ? "bg-gray-700 text-gray-200" 
                      : "bg-gray-100 text-gray-900"
                  }`}
                />
              </View>

              {/* Recurrence Type */}
              <View className="mb-4">
                <Text className={`text-sm mb-2 ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}>
                  Recurrence Type
                </Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  className="flex-row"
                >
                  <TouchableOpacity
                    onPress={() => setIncomeRecurrenceType('daily')}
                    className={`mr-3 px-4 py-2 rounded-full ${
                      incomeRecurrenceType === 'daily'
                        ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                        : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                    }`}
                  >
                    <Text className={`${
                      incomeRecurrenceType === 'daily' ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                    }`}>
                      Daily
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setIncomeRecurrenceType('weekly')}
                    className={`mr-3 px-4 py-2 rounded-full ${
                      incomeRecurrenceType === 'weekly'
                        ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                        : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                    }`}
                  >
                    <Text className={`${
                      incomeRecurrenceType === 'weekly' ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                    }`}>
                      Weekly
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setIncomeRecurrenceType('biweekly')}
                    className={`mr-3 px-4 py-2 rounded-full ${
                      incomeRecurrenceType === 'biweekly'
                        ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                        : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                    }`}
                  >
                    <Text className={`${
                      incomeRecurrenceType === 'biweekly' ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                    }`}>
                      Biweekly
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setIncomeRecurrenceType('monthly')}
                    className={`mr-3 px-4 py-2 rounded-full ${
                      incomeRecurrenceType === 'monthly'
                        ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                        : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                    }`}
                  >
                    <Text className={`${
                      incomeRecurrenceType === 'monthly' ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                    }`}>
                      Monthly
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setIncomeRecurrenceType('custom')}
                    className={`mr-3 px-4 py-2 rounded-full ${
                      incomeRecurrenceType === 'custom'
                        ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                        : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                    }`}
                  >
                    <Text className={`${
                      incomeRecurrenceType === 'custom' ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                    }`}>
                      Custom
                    </Text>
                  </TouchableOpacity>
                </ScrollView>

                {incomeRecurrenceType === 'custom' && (
                  <View className="mt-4">
                    <Text className={`text-sm mb-1 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Interval (months)
                    </Text>
                    <View className="flex-row">
                      <TextInput
                        value={incomeRecurrenceInterval}
                        onChangeText={setIncomeRecurrenceInterval}
                        keyboardType="numeric"
                        returnKeyType="done"
                        className={`flex-1 p-4 rounded-l-lg ${
                          isDarkMode 
                            ? "bg-gray-700 text-gray-200" 
                            : "bg-gray-100 text-gray-900"
                        }`}
                      />
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row justify-between mt-6">
              <TouchableOpacity
                onPress={() => setShowEditRecurringIncomeModal(false)}
                className={`flex-1 mr-2 p-4 rounded-lg ${
                  isDarkMode ? "bg-gray-700" : "bg-gray-200"
                }`}
              >
                <Text className={`text-center ${
                  isDarkMode ? "text-gray-200" : "text-gray-900"
                }`}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleUpdateRecurringIncome}
                className={`flex-1 ml-2 p-4 rounded-lg ${
                  isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]"
                }`}
              >
                <Text className="text-white text-center">
                  Update Income
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

export default Accounts;