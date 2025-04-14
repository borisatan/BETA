import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import { TransactionService } from '../services/transactionService';
import { CategoryService, Category } from '../services/categoryService';
import { Transaction } from '../firebase/types';
import { auth } from '../firebase/firebaseConfig';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Timestamp } from 'firebase/firestore';
import { Picker } from '@react-native-picker/picker';

const TransactionsScreen = () => {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Sort and filter states
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'category'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<{start: Date | null, end: Date | null}>({
    start: null,
    end: null
  });
  
  // Date picker states
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  // Delete confirmation modal
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  // Dropdown state
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  useEffect(() => {
    fetchTransactionsAndCategories();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [transactions, sortBy, sortOrder, filterCategory, filterDateRange]);

  const fetchTransactionsAndCategories = async () => {
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

      // Fetch all transactions
      const userTransactions = await TransactionService.getUserTransactions(userId);
      setTransactions(userTransactions);
      
      // Fetch categories for display
      const userCategories = await CategoryService.getUserCategories(userId);
      setCategories(userCategories);
      
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

  const applyFiltersAndSort = useCallback(() => {
    let result = [...transactions];
    
    // Apply category filter
    if (filterCategory !== 'all') {
      result = result.filter(t => t.categoryId === filterCategory);
    }
    
    // Apply date range filter
    if (filterDateRange.start) {
      result = result.filter(t => t.date.toDate() >= filterDateRange.start!);
    }
    
    if (filterDateRange.end) {
      result = result.filter(t => t.date.toDate() <= filterDateRange.end!);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      if (sortBy === 'date') {
        return sortOrder === 'asc' 
          ? a.date.toDate().getTime() - b.date.toDate().getTime()
          : b.date.toDate().getTime() - a.date.toDate().getTime();
      } else if (sortBy === 'amount') {
        return sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount;
      } else if (sortBy === 'category') {
        const catA = categories.find(c => c.id === a.categoryId)?.name || '';
        const catB = categories.find(c => c.id === b.categoryId)?.name || '';
        return sortOrder === 'asc' 
          ? catA.localeCompare(catB)
          : catB.localeCompare(catA);
      }
      return 0;
    });
    
    setFilteredTransactions(result);
  }, [transactions, sortBy, sortOrder, filterCategory, filterDateRange, categories]);

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      await TransactionService.deleteTransaction(transactionId);
      
      // Update local state
      setTransactions(prev => prev.filter(t => t.id !== transactionId));
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Transaction deleted successfully'
      });

      // Refresh the transactions list to ensure UI is in sync
      fetchTransactionsAndCategories();
      
    } catch (error) {
      console.error('Error deleting transaction:', error);
      
      // Check if the transaction still exists in Firestore
      const userId = auth.currentUser?.uid;
      if (userId) {
        try {
          const transaction = await TransactionService.getTransaction(transactionId);
          if (!transaction) {
            // Transaction was actually deleted successfully
            setTransactions(prev => prev.filter(t => t.id !== transactionId));
            Toast.show({
              type: 'success',
              text1: 'Success',
              text2: 'Transaction deleted successfully'
            });
            return;
          }
        } catch (checkError) {
          // Ignore check error
        }
      }

      // Only show error if we confirmed the transaction still exists
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete transaction'
      });
    }
  };

  const confirmDelete = (transactionId: string) => {
    setTransactionToDelete(transactionId);
    setDeleteModalVisible(true);
  };

  const handleEditTransaction = (transactionId: string) => {
    router.push({
      pathname: '/transaction-edit',
      params: { transactionId }
    });
  };

  const handleDateChange = (event: any, selectedDate?: Date, type?: 'start' | 'end') => {
    if (type === 'start') {
      setShowStartDatePicker(false);
      if (selectedDate) {
        setFilterDateRange(prev => ({ ...prev, start: selectedDate }));
      }
    } else {
      setShowEndDatePicker(false);
      if (selectedDate) {
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);
        setFilterDateRange(prev => ({ ...prev, end: endOfDay }));
      }
    }
  };

  const resetFilters = () => {
    setFilterCategory('all');
    setFilterDateRange({ start: null, end: null });
    setSortBy('date');
    setSortOrder('desc');
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD', // Default to USD, ideally this would come from user settings
    }).format(amount);
  };
  
  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Uncategorized';
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
          onPress={() => fetchTransactionsAndCategories()}
          className={`mt-6 px-4 py-2 rounded-lg ${isDarkMode ? "bg-blue-900" : "bg-blue-600"}`}
        >
          <Text className="text-white">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className={`flex-1 ${isDarkMode ? "bg-[#0A0F1F]" : "bg-white"}`}>
      {/* Header */}
      <View className={`px-4 py-6 ${isDarkMode ? "bg-gray-900" : "bg-blue-500"}`}>
        <Text className="text-white text-xl font-bold text-center">
          Transactions
        </Text>
      </View>
      
      {/* Filter and Sort Controls */}
      <View className={`px-4 py-3 ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`}>
        <View className="flex-row justify-between items-center mb-3">
          <TouchableOpacity 
            onPress={() => setShowFilterDropdown(!showFilterDropdown)}
            className={`flex-row items-center p-2 rounded-md ${isDarkMode ? "bg-gray-700" : "bg-white"}`}
          >
            <MaterialIcons name="filter-list" size={20} color={isDarkMode ? "#CBD5E0" : "#4A5568"} />
            <Text className={`ml-1 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>Filters</Text>
            <MaterialIcons 
              name={showFilterDropdown ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
              size={20} 
              color={isDarkMode ? "#CBD5E0" : "#4A5568"} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => router.push('transaction-adder')}
            className={`p-2 rounded-md ${isDarkMode ? "bg-blue-800" : "bg-blue-500"}`}
          >
            <Text className="text-white">Add Transaction</Text>
          </TouchableOpacity>
        </View>
        
        {showFilterDropdown && (
          <View className={`p-3 rounded-md mb-3 ${isDarkMode ? "bg-gray-700" : "bg-white"}`}>
            {/* Sort Controls */}
            <View className="mb-3">
              <Text className={`mb-1 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>Sort by:</Text>
              <View className="flex-row">
                <TouchableOpacity 
                  onPress={() => setSortBy('date')}
                  className={`mr-2 px-3 py-1 rounded-md ${sortBy === 'date' 
                    ? (isDarkMode ? "bg-blue-800" : "bg-blue-500") 
                    : (isDarkMode ? "bg-gray-600" : "bg-gray-200")}`}
                >
                  <Text className={sortBy === 'date' ? "text-white" : (isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Date
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setSortBy('amount')}
                  className={`mr-2 px-3 py-1 rounded-md ${sortBy === 'amount' 
                    ? (isDarkMode ? "bg-blue-800" : "bg-blue-500") 
                    : (isDarkMode ? "bg-gray-600" : "bg-gray-200")}`}
                >
                  <Text className={sortBy === 'amount' ? "text-white" : (isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Amount
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setSortBy('category')}
                  className={`px-3 py-1 rounded-md ${sortBy === 'category' 
                    ? (isDarkMode ? "bg-blue-800" : "bg-blue-500") 
                    : (isDarkMode ? "bg-gray-600" : "bg-gray-200")}`}
                >
                  <Text className={sortBy === 'category' ? "text-white" : (isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Category
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Sort Order */}
            <View className="flex-row mb-3">
              <TouchableOpacity 
                onPress={() => setSortOrder('asc')}
                className={`mr-2 px-3 py-1 rounded-md ${sortOrder === 'asc' 
                  ? (isDarkMode ? "bg-blue-800" : "bg-blue-500") 
                  : (isDarkMode ? "bg-gray-600" : "bg-gray-200")}`}
              >
                <Text className={sortOrder === 'asc' ? "text-white" : (isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Ascending
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setSortOrder('desc')}
                className={`px-3 py-1 rounded-md ${sortOrder === 'desc' 
                  ? (isDarkMode ? "bg-blue-800" : "bg-blue-500") 
                  : (isDarkMode ? "bg-gray-600" : "bg-gray-200")}`}
              >
                <Text className={sortOrder === 'desc' ? "text-white" : (isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Descending
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Category Filter */}
            <View className="mb-3">
              <Text className={`mb-1 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>Filter by category:</Text>
              <View className={isDarkMode ? "bg-gray-800" : "bg-gray-100"}>
                <Picker
                  selectedValue={filterCategory}
                  onValueChange={(itemValue) => setFilterCategory(itemValue)}
                  style={{
                    color: isDarkMode ? '#CBD5E0' : '#4A5568',
                    backgroundColor: isDarkMode ? '#1A202C' : '#F7FAFC'
                  }}
                  dropdownIconColor={isDarkMode ? '#CBD5E0' : '#4A5568'}
                >
                  <Picker.Item label="All Categories" value="all" />
                  {categories.map(category => (
                    <Picker.Item 
                      key={category.id} 
                      label={category.name} 
                      value={category.id} 
                    />
                  ))}
                </Picker>
              </View>
            </View>
            
            {/* Date Range Filter */}
            <View className="mb-3">
              <Text className={`mb-1 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>Filter by date range:</Text>
              <View className="flex-row justify-between">
                <TouchableOpacity 
                  onPress={() => setShowStartDatePicker(true)}
                  className={`flex-1 mr-2 p-2 rounded-md ${isDarkMode ? "bg-gray-600" : "bg-gray-200"}`}
                >
                  <Text className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
                    {filterDateRange.start ? filterDateRange.start.toLocaleDateString() : 'Start Date'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setShowEndDatePicker(true)}
                  className={`flex-1 p-2 rounded-md ${isDarkMode ? "bg-gray-600" : "bg-gray-200"}`}
                >
                  <Text className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
                    {filterDateRange.end ? filterDateRange.end.toLocaleDateString() : 'End Date'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Reset Button */}
            <TouchableOpacity 
              onPress={resetFilters}
              className={`px-3 py-2 rounded-md ${isDarkMode ? "bg-red-800" : "bg-red-500"}`}
            >
              <Text className="text-white text-center">Reset Filters</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Transaction Count Summary */}
        <View className="flex-row justify-between">
          <Text className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
            {filteredTransactions.length} {filteredTransactions.length === 1 ? 'transaction' : 'transactions'}
          </Text>
          <Text className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
            Total: {formatCurrency(filteredTransactions.reduce((sum, t) => sum + t.amount, 0))}
          </Text>
        </View>
      </View>
      
      {/* Transaction List */}
      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View 
            className={`p-4 border-b ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}
          >
            <View className="flex-row justify-between items-center mb-1">
              <Text 
                className={`font-medium text-base ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ maxWidth: '60%' }}
              >
                {item.description}
              </Text>
              <Text
                className={`font-bold ${
                  item.amount >= 0 
                    ? (isDarkMode ? "text-green-400" : "text-green-600")
                    : (isDarkMode ? "text-red-400" : "text-red-600")
                }`}
              >
                {formatCurrency(item.amount)}
              </Text>
            </View>
            
            <View className="flex-row justify-between">
              <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                {getCategoryName(item.categoryId)}
              </Text>
              <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                {item.date.toDate().toLocaleDateString()}
              </Text>
            </View>
            
            {/* Action Buttons */}
            <View className="flex-row mt-2 justify-end">
              <TouchableOpacity 
                onPress={() => handleEditTransaction(item.id)}
                className="mr-3"
              >
                <MaterialIcons 
                  name="edit" 
                  size={20} 
                  color={isDarkMode ? "#38B2AC" : "#0D9488"} 
                />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => confirmDelete(item.id)}
              >
                <MaterialIcons 
                  name="delete" 
                  size={20} 
                  color={isDarkMode ? "#F56565" : "#E53E3E"} 
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View className={`p-8 items-center justify-center`}>
            <MaterialIcons 
              name="receipt-long" 
              size={48} 
              color={isDarkMode ? "#4A5568" : "#A0AEC0"} 
            />
            <Text 
              className={`text-center mt-4 text-lg ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}
            >
              No transactions found
            </Text>
            <Text 
              className={`text-center mt-2 ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}
            >
              Add a transaction or adjust your filters
            </Text>
          </View>
        }
      />
      
      {/* Date Pickers (hidden by default) */}
      {showStartDatePicker && (
        <DateTimePicker
          value={filterDateRange.start || new Date()}
          mode="date"
          is24Hour={true}
          display="default"
          onChange={(event, date) => handleDateChange(event, date, 'start')}
        />
      )}
      
      {showEndDatePicker && (
        <DateTimePicker
          value={filterDateRange.end || new Date()}
          mode="date"
          is24Hour={true}
          display="default"
          onChange={(event, date) => handleDateChange(event, date, 'end')}
        />
      )}
      
      {/* Delete Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteModalVisible}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View 
            className={`m-5 p-5 rounded-lg ${isDarkMode ? "bg-gray-800" : "bg-white"}`}
            style={{ width: '80%' }}
          >
            <Text 
              className={`mb-4 text-lg text-center ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}
            >
              Are you sure you want to delete this transaction?
            </Text>
            <Text 
              className={`mb-6 text-center ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}
            >
              This action cannot be undone.
            </Text>
            <View className="flex-row justify-between">
              <TouchableOpacity
                onPress={() => setDeleteModalVisible(false)}
                className={`flex-1 p-3 rounded-md mr-2 ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`}
              >
                <Text className="text-center">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (transactionToDelete) {
                    handleDeleteTransaction(transactionToDelete);
                    setTransactionToDelete(null);
                  }
                  setDeleteModalVisible(false);
                }}
                className={`flex-1 p-3 rounded-md ${isDarkMode ? "bg-red-800" : "bg-red-500"}`}
              >
                <Text className="text-center text-white">Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default TransactionsScreen; 