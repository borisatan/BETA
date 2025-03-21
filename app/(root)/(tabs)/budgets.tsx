import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Platform, Alert, Keyboard, ActivityIndicator, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../firebase/firebaseConfig';
import { Timestamp } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { MaterialIcons } from '@expo/vector-icons';
import { CategoryService, Category } from '../services/categoryService';

interface Budget {
  id: string;
  userId: string;
  name: string;
  amount: number;
  categories: {
    categoryId: string;
    allocated: number;
    spent: number;
  }[];
  startDate: Timestamp;
  endDate: Timestamp;
  isRecurring: boolean;
  recurrenceType?: 'weekly' | 'monthly' | 'custom';
  recurrenceInterval?: number;
  nextRenewalDate?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  budgetType: 'category' | 'simple';
}

const Budgets = () => {
  const { isDarkMode } = useTheme();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [budgetName, setBudgetName] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'weekly' | 'monthly' | 'custom'>('monthly');
  const [recurrenceInterval, setRecurrenceInterval] = useState('1');
  const [categoryAllocations, setCategoryAllocations] = useState<{ [key: string]: string }>({});
  const [showRecurrenceOptions, setShowRecurrenceOptions] = useState(false);
  const [budgetType, setBudgetType] = useState<'category' | 'simple'>('category');
  const [showBudgetTypeSelection, setShowBudgetTypeSelection] = useState(false);
  const [showHelpMeDecide, setShowHelpMeDecide] = useState(false);

  useEffect(() => {
    fetchBudgets();
    fetchCategories();
  }, []);

  const fetchBudgets = async () => {
    setIsLoading(true);
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'You must be logged in to view budgets'
        });
        return;
      }
      // TODO: Implement BudgetService.getUserBudgets
      // const userBudgets = await BudgetService.getUserBudgets(userId);
      // setBudgets(userBudgets);
    } catch (error) {
      console.error('Error fetching budgets:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to fetch budgets'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const userCategories = await CategoryService.getUserCategories(userId);
      setCategories(userCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleAddBudget = () => {
    setEditingBudget(null);
    setBudgetName('');
    setBudgetAmount('');
    setStartDate(new Date());
    setEndDate(new Date());
    setIsRecurring(false);
    setRecurrenceType('monthly');
    setRecurrenceInterval('1');
    setCategoryAllocations({});
    setBudgetType('category');
    setShowBudgetTypeSelection(true);
  };

  const handleBudgetTypeSelect = (type: 'category' | 'simple') => {
    setBudgetType(type);
    setShowBudgetTypeSelection(false);
    setShowAddBudget(true);
  };

  const handleHelpMeDecide = () => {
    setShowHelpMeDecide(false);
    // Get main categories (Needs, Wants, Savings)
    const mainCategories = categories.filter(cat => 
      ['Needs', 'Wants', 'Savings'].includes(cat.name)
    );

    if (mainCategories.length === 3) {
      const totalAmount = parseFloat(budgetAmount) || 0;
      const allocations: { [key: string]: string } = {};
      
      // Apply 50/30/20 split
      allocations[mainCategories.find(cat => cat.name === 'Needs')!.id] = (totalAmount * 0.5).toString();
      allocations[mainCategories.find(cat => cat.name === 'Wants')!.id] = (totalAmount * 0.3).toString();
      allocations[mainCategories.find(cat => cat.name === 'Savings')!.id] = (totalAmount * 0.2).toString();
      
      setCategoryAllocations(allocations);
    }
  };

  const handleEditBudget = (budget: Budget) => {
    setEditingBudget(budget);
    setBudgetName(budget.name);
    setBudgetAmount(budget.amount.toString());
    setStartDate(budget.startDate.toDate());
    setEndDate(budget.endDate.toDate());
    setIsRecurring(budget.isRecurring);
    setRecurrenceType(budget.recurrenceType || 'monthly');
    setRecurrenceInterval(budget.recurrenceInterval?.toString() || '1');
    
    // Set category allocations
    const allocations: { [key: string]: string } = {};
    budget.categories.forEach(cat => {
      allocations[cat.categoryId] = cat.allocated.toString();
    });
    setCategoryAllocations(allocations);
    
    setShowAddBudget(true);
  };

  const handleDeleteBudget = async (budget: Budget) => {
    Alert.alert(
      'Delete Budget',
      'Are you sure you want to delete this budget? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // TODO: Implement BudgetService.deleteBudget
              // await BudgetService.deleteBudget(budget.id);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Budget deleted successfully'
              });
              fetchBudgets();
            } catch (error) {
              console.error('Error deleting budget:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to delete budget'
              });
            }
          }
        }
      ]
    );
  };

  const handleSaveBudget = async () => {
    if (!budgetName.trim() || !budgetAmount.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in all required fields'
      });
      return;
    }

    setIsSaving(true);
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'You must be logged in to manage budgets'
        });
        return;
      }

      const budgetData: Omit<Budget, 'id'> = {
        userId,
        name: budgetName,
        amount: parseFloat(budgetAmount),
        categories: Object.entries(categoryAllocations).map(([categoryId, allocated]) => ({
          categoryId,
          allocated: parseFloat(allocated),
          spent: 0
        })),
        startDate: Timestamp.fromDate(startDate),
        endDate: Timestamp.fromDate(endDate),
        isRecurring,
        recurrenceType: isRecurring ? recurrenceType : undefined,
        recurrenceInterval: isRecurring ? parseInt(recurrenceInterval) : undefined,
        nextRenewalDate: isRecurring ? Timestamp.fromDate(endDate) : undefined,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
        budgetType,
      };

      if (editingBudget) {
        // TODO: Implement BudgetService.updateBudget
        // await BudgetService.updateBudget(editingBudget.id, budgetData);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Budget updated successfully'
        });
      } else {
        // TODO: Implement BudgetService.createBudget
        // await BudgetService.createBudget(budgetData);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Budget created successfully'
        });
      }

      setShowAddBudget(false);
      fetchBudgets();
    } catch (error) {
      console.error('Error saving budget:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save budget'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const calculateProgress = (budget: Budget) => {
    const totalSpent = budget.categories.reduce((sum, cat) => sum + cat.spent, 0);
    return (totalSpent / budget.amount) * 100;
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
              Budgets
            </Text>
            <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              Manage your spending limits
            </Text>
          </View>
        </View>

        {/* Add Budget Button */}
        <TouchableOpacity 
          onPress={handleAddBudget}
          className={`p-4 rounded-lg items-center mb-6 ${
            isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]"
          }`}
        >
          <Text className="text-white font-semibold">Create New Budget</Text>
        </TouchableOpacity>

        {/* Loading Indicator */}
        {isLoading && (
          <View className="items-center mb-6">
            <ActivityIndicator size="large" color={isDarkMode ? "#1E40AF" : "#1E3A8A"} />
            <Text className={`mt-2 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              Loading budgets...
            </Text>
          </View>
        )}

        {/* Budgets List */}
        <View className="space-y-4">
          {budgets.map((budget) => (
            <View key={budget.id}>
              <TouchableOpacity 
                onPress={() => handleEditBudget(budget)}
                className={`p-4 rounded-lg border ${
                  isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
                }`}
              >
                <View className="flex-row justify-between items-center mb-2">
                  <Text className={`text-lg font-semibold ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                    {budget.name}
                  </Text>
                  <Text className={`text-lg font-semibold ${
                    calculateProgress(budget) > 100 
                      ? (isDarkMode ? "text-red-400" : "text-red-600")
                      : (isDarkMode ? "text-green-400" : "text-green-600")
                  }`}>
                    ${budget.amount.toFixed(2)}
                  </Text>
                </View>

                {/* Progress Bar */}
                <View className="h-2 bg-gray-200 rounded-full mb-2">
                  <View 
                    className={`h-full rounded-full ${
                      calculateProgress(budget) > 100 
                        ? "bg-red-500" 
                        : "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(calculateProgress(budget), 100)}%` }}
                  />
                </View>

                <View className="flex-row justify-between">
                  <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                    {budget.categories.length} categories
                  </Text>
                  <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                    {budget.isRecurring ? 'Recurring' : 'One-time'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Delete Button */}
              <TouchableOpacity 
                onPress={() => handleDeleteBudget(budget)}
                className={`mt-2 p-3 rounded-lg items-center ${
                  isDarkMode ? "bg-red-900" : "bg-red-600"
                }`}
              >
                <Text className="text-white font-semibold">Delete Budget</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Budget Type Selection Modal */}
        <Modal
          visible={showBudgetTypeSelection}
          transparent={true}
          animationType="slide"
        >
          <View className="flex-1 justify-end">
            <View className={`rounded-t-3xl p-6 ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            }`}>
              <Text className={`text-xl font-bold mb-6 ${
                isDarkMode ? "text-gray-200" : "text-gray-900"
              }`}>
                Choose Budget Type
              </Text>

              <TouchableOpacity
                onPress={() => handleBudgetTypeSelect('category')}
                className={`p-4 rounded-lg mb-4 ${
                  isDarkMode ? "bg-gray-700" : "bg-gray-100"
                }`}
              >
                <Text className={`text-lg font-semibold mb-2 ${
                  isDarkMode ? "text-gray-200" : "text-gray-900"
                }`}>
                  Category-Based Budget
                </Text>
                <Text className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  Allocate your budget across different categories (e.g., Needs, Wants, Savings)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleBudgetTypeSelect('simple')}
                className={`p-4 rounded-lg ${
                  isDarkMode ? "bg-gray-700" : "bg-gray-100"
                }`}
              >
                <Text className={`text-lg font-semibold mb-2 ${
                  isDarkMode ? "text-gray-200" : "text-gray-900"
                }`}>
                  Simple Budget
                </Text>
                <Text className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  Track spending without categories (e.g., vacation fund, project budget)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Help Me Decide Modal */}
        <Modal
          visible={showHelpMeDecide}
          transparent={true}
          animationType="slide"
        >
          <View className="flex-1 justify-end">
            <View className={`rounded-t-3xl p-6 ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            }`}>
              <Text className={`text-xl font-bold mb-6 ${
                isDarkMode ? "text-gray-200" : "text-gray-900"
              }`}>
                Help Me Decide
              </Text>

              <Text className={`text-base mb-4 ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}>
                I'll help you set up a balanced budget using the 50/30/20 rule:
              </Text>

              <View className="space-y-4 mb-6">
                <View className={`p-4 rounded-lg ${
                  isDarkMode ? "bg-gray-700" : "bg-gray-100"
                }`}>
                  <Text className={`text-lg font-semibold mb-1 ${
                    isDarkMode ? "text-gray-200" : "text-gray-900"
                  }`}>
                    50% - Needs
                  </Text>
                  <Text className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}>
                    Essential expenses like rent, groceries, utilities
                  </Text>
                </View>

                <View className={`p-4 rounded-lg ${
                  isDarkMode ? "bg-gray-700" : "bg-gray-100"
                }`}>
                  <Text className={`text-lg font-semibold mb-1 ${
                    isDarkMode ? "text-gray-200" : "text-gray-900"
                  }`}>
                    30% - Wants
                  </Text>
                  <Text className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}>
                    Non-essential expenses like entertainment, dining out
                  </Text>
                </View>

                <View className={`p-4 rounded-lg ${
                  isDarkMode ? "bg-gray-700" : "bg-gray-100"
                }`}>
                  <Text className={`text-lg font-semibold mb-1 ${
                    isDarkMode ? "text-gray-200" : "text-gray-900"
                  }`}>
                    20% - Savings
                  </Text>
                  <Text className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}>
                    Emergency fund, retirement, investments
                  </Text>
                </View>
              </View>

              <View className="flex-row space-x-4">
                <TouchableOpacity
                  onPress={() => setShowHelpMeDecide(false)}
                  className={`flex-1 p-4 rounded-lg ${
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
                  onPress={handleHelpMeDecide}
                  className={`flex-1 p-4 rounded-lg ${
                    isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]"
                  }`}
                >
                  <Text className="text-white text-center">
                    Apply 50/30/20 Split
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Add/Edit Budget Modal */}
        <Modal
          visible={showAddBudget}
          transparent={true}
          animationType="slide"
        >
          <View className="flex-1 justify-end">
            <ScrollView className={`max-h-[90%] rounded-t-3xl ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            }`}>
              <View className="p-6">
                <View className="flex-row justify-between items-center mb-6">
                  <Text className={`text-xl font-bold ${
                    isDarkMode ? "text-gray-200" : "text-gray-900"
                  }`}>
                    {editingBudget ? 'Edit Budget' : 'Create New Budget'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowAddBudget(false)}>
                    <MaterialIcons 
                      name="close" 
                      size={24} 
                      color={isDarkMode ? "#E5E7EB" : "#1F2937"} 
                    />
                  </TouchableOpacity>
                </View>

                <View className="space-y-4">
                  {/* Budget Name */}
                  <View>
                    <Text className={`text-sm mb-1 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Budget Name
                    </Text>
                    <TextInput
                      value={budgetName}
                      onChangeText={setBudgetName}
                      placeholder="Enter budget name"
                      className={`p-4 rounded-lg ${
                        isDarkMode 
                          ? "bg-gray-700 text-gray-200" 
                          : "bg-gray-100 text-gray-900"
                      }`}
                    />
                  </View>

                  {/* Budget Amount */}
                  <View>
                    <Text className={`text-sm mb-1 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Total Amount
                    </Text>
                    <TextInput
                      value={budgetAmount}
                      onChangeText={setBudgetAmount}
                      placeholder="Enter total amount"
                      keyboardType="numeric"
                      className={`p-4 rounded-lg ${
                        isDarkMode 
                          ? "bg-gray-700 text-gray-200" 
                          : "bg-gray-100 text-gray-900"
                      }`}
                    />
                  </View>

                  {/* Date Range */}
                  <View>
                    <Text className={`text-sm mb-1 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Date Range
                    </Text>
                    <View className="flex-row space-x-4">
                      <TouchableOpacity
                        onPress={() => setShowStartDatePicker(true)}
                        className={`flex-1 p-4 rounded-lg ${
                          isDarkMode 
                            ? "bg-gray-700" 
                            : "bg-gray-100"
                        }`}
                      >
                        <Text className={`${
                          isDarkMode ? "text-gray-200" : "text-gray-900"
                        }`}>
                          Start: {startDate.toLocaleDateString()}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setShowEndDatePicker(true)}
                        className={`flex-1 p-4 rounded-lg ${
                          isDarkMode 
                            ? "bg-gray-700" 
                            : "bg-gray-100"
                        }`}
                      >
                        <Text className={`${
                          isDarkMode ? "text-gray-200" : "text-gray-900"
                        }`}>
                          End: {endDate.toLocaleDateString()}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Recurring Budget Toggle */}
                  <View>
                    <TouchableOpacity
                      onPress={() => {
                        setIsRecurring(!isRecurring);
                        setShowRecurrenceOptions(!isRecurring);
                      }}
                      className={`p-4 rounded-lg ${
                        isRecurring
                          ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                          : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                      }`}
                    >
                      <Text className={`${
                        isRecurring ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                      }`}>
                        {isRecurring ? 'Recurring Budget' : 'One-time Budget'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Recurrence Options */}
                  {showRecurrenceOptions && (
                    <View className="space-y-4">
                      <View>
                        <Text className={`text-sm mb-1 ${
                          isDarkMode ? "text-gray-300" : "text-gray-700"
                        }`}>
                          Recurrence Type
                        </Text>
                        <View className="flex-row space-x-2">
                          <TouchableOpacity
                            onPress={() => setRecurrenceType('weekly')}
                            className={`flex-1 p-3 rounded-lg ${
                              recurrenceType === 'weekly'
                                ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                                : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                            }`}
                          >
                            <Text className={`text-center ${
                              recurrenceType === 'weekly' ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                            }`}>
                              Weekly
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setRecurrenceType('monthly')}
                            className={`flex-1 p-3 rounded-lg ${
                              recurrenceType === 'monthly'
                                ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                                : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                            }`}
                          >
                            <Text className={`text-center ${
                              recurrenceType === 'monthly' ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                            }`}>
                              Monthly
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setRecurrenceType('custom')}
                            className={`flex-1 p-3 rounded-lg ${
                              recurrenceType === 'custom'
                                ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                                : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                            }`}
                          >
                            <Text className={`text-center ${
                              recurrenceType === 'custom' ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                            }`}>
                              Custom
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {recurrenceType === 'custom' && (
                        <View>
                          <Text className={`text-sm mb-1 ${
                            isDarkMode ? "text-gray-300" : "text-gray-700"
                          }`}>
                            Interval (months)
                          </Text>
                          <TextInput
                            value={recurrenceInterval}
                            onChangeText={setRecurrenceInterval}
                            keyboardType="numeric"
                            className={`p-4 rounded-lg ${
                              isDarkMode 
                                ? "bg-gray-700 text-gray-200" 
                                : "bg-gray-100 text-gray-900"
                            }`}
                          />
                        </View>
                      )}
                    </View>
                  )}

                  {/* Category Allocations Section */}
                  {budgetType === 'category' && (
                    <View>
                      <View className="flex-row justify-between items-center mb-4">
                        <Text className={`text-sm ${
                          isDarkMode ? "text-gray-300" : "text-gray-700"
                        }`}>
                          Category Allocations
                        </Text>
                        <TouchableOpacity
                          onPress={() => setShowHelpMeDecide(true)}
                          className={`px-4 py-2 rounded-lg ${
                            isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]"
                          }`}
                        >
                          <Text className="text-white text-sm">Help Me Decide</Text>
                        </TouchableOpacity>
                      </View>
                      {categories.map((category) => (
                        <View key={category.id} className="mb-2">
                          <Text className={`text-sm mb-1 ${
                            isDarkMode ? "text-gray-200" : "text-gray-900"
                          }`}>
                            {category.name}
                          </Text>
                          <TextInput
                            value={categoryAllocations[category.id] || ''}
                            onChangeText={(text) => {
                              setCategoryAllocations(prev => ({
                                ...prev,
                                [category.id]: text
                              }));
                            }}
                            placeholder="Enter amount"
                            keyboardType="numeric"
                            className={`p-4 rounded-lg ${
                              isDarkMode 
                                ? "bg-gray-700 text-gray-200" 
                                : "bg-gray-100 text-gray-900"
                            }`}
                          />
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <View className="flex-row justify-between mt-6">
                  <TouchableOpacity
                    onPress={() => setShowAddBudget(false)}
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
                    onPress={handleSaveBudget}
                    disabled={isSaving}
                    className={`flex-1 ml-2 p-4 rounded-lg ${
                      isSaving 
                        ? (isDarkMode ? "bg-gray-600" : "bg-gray-400")
                        : (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                    }`}
                  >
                    <Text className="text-white text-center">
                      {isSaving ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* Date Pickers */}
        {showStartDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowStartDatePicker(false);
              if (selectedDate) {
                setStartDate(selectedDate);
              }
            }}
          />
        )}
        {showEndDatePicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowEndDatePicker(false);
              if (selectedDate) {
                setEndDate(selectedDate);
              }
            }}
          />
        )}
      </View>
    </ScrollView>
  );
};

export default Budgets; 