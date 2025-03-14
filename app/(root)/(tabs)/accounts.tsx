import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Platform, Alert, Keyboard, ActivityIndicator } from 'react-native';
import { AccountService } from '../services/accountService';
import { Account } from '../firebase/types';
import { auth } from '../firebase/firebaseConfig';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'expo-router';

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
  const startEditingAccount = (account: Account) => {
    setEditingAccount(account);
    setNewAccountName(account.name);
    setNewAccountBalance(account.balance.toString());
    setNewAccountType(account.type);
    setNewAccountCurrency(account.currency);
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
      // Navigate to transactions overview for this account
      router.push({
        pathname: '/transactions',
        params: { accountId: account.id }
      });
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
                  <Text className={`text-lg font-semibold ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                    {account.name}
                  </Text>
                  <Text className={`text-lg font-semibold ${
                    account.balance >= 0 
                      ? (isDarkMode ? "text-green-400" : "text-green-600")
                      : (isDarkMode ? "text-red-400" : "text-red-600")
                  }`}>
                    {account.currency} {account.balance.toFixed(2)}
                  </Text>
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

                  {/* Delete Button */}
                  <TouchableOpacity 
                    onPress={() => handleDeleteAccount(account)}
                    className={`mt-4 p-3 rounded-lg items-center ${
                      isDarkMode ? "bg-red-900" : "bg-red-600"
                    }`}
                  >
                    <Text className="text-white font-semibold">Delete Account</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

export default Accounts;