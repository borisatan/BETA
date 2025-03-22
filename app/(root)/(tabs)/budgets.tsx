import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Platform, Alert, Keyboard, ActivityIndicator, Modal, KeyboardAvoidingView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../firebase/firebaseConfig';
import { Timestamp } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { MaterialIcons } from '@expo/vector-icons';
import { CategoryService, Category } from '../services/categoryService';

const availableIcons: string[] = [
  'shopping-cart',
  'home',
  'directions-car',
  'local-dining',
  'local-hospital',
  'school',
  'sports-basketball',
  'flight',
  'movie',
  'music-note',
  'book',
  'fitness-center',
  'pets',
  'local-grocery-store',
  'local-mall',
  'local-cafe',
  'local-bar',
  'local-gas-station',
  'local-pharmacy',
  'local-laundry-service',
  'local-offer',
  'local-parking',
  'local-post-office',
  'local-printshop',
  'local-see',
  'local-shipping',
  'local-taxi',
  'work',
  'beach-access',
  'child-care',
  'spa'
];

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
  recurrenceType?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
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
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'>('monthly');
  const [recurrenceInterval, setRecurrenceInterval] = useState('1');
  const [categoryAllocations, setCategoryAllocations] = useState<{ [key: string]: string }>({});
  const [showRecurrenceOptions, setShowRecurrenceOptions] = useState(false);
  const [budgetType, setBudgetType] = useState<'category' | 'simple'>('category');
  const [showBudgetTypeSelection, setShowBudgetTypeSelection] = useState(false);
  const [showHelpMeDecide, setShowHelpMeDecide] = useState(false);
  const [showCustomOrHelp, setShowCustomOrHelp] = useState(false);
  const [showSubcategoryPrompt, setShowSubcategoryPrompt] = useState(false);
  const [mainCategoryAllocations, setMainCategoryAllocations] = useState<{ [key: string]: string }>({});
  const [showMainCategoryModal, setShowMainCategoryModal] = useState(false);
  const [showAddMainCategory, setShowAddMainCategory] = useState(false);
  const [newMainCategoryName, setNewMainCategoryName] = useState('');
  const [newMainCategoryIcon, setNewMainCategoryIcon] = useState('priority-high');
  const [editingMainCategory, setEditingMainCategory] = useState<Category | null>(null);
  const [showEmojiInput, setShowEmojiInput] = useState(false);
  const [emojiInput, setEmojiInput] = useState('');

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
    if (type === 'category') {
      setShowCustomOrHelp(true);
    } else {
      setShowAddBudget(true);
    }
  };

  const handleCustomOrHelpSelect = (choice: 'custom' | 'help') => {
    setShowCustomOrHelp(false);
    if (choice === 'help') {
      setShowHelpMeDecide(true);
    } else {
      setShowAddBudget(true);
    }
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

  const handleNext = () => {
    if (!budgetName.trim() || !budgetAmount.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in all required fields'
      });
      return;
    }
    setShowSubcategoryPrompt(true);
  };

  const handleSaveWithoutSubcategories = async () => {
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
        categories: Object.entries(mainCategoryAllocations).map(([categoryId, allocated]) => ({
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
      setShowSubcategoryPrompt(false);
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
        categories: [],
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
                    {budget.budgetType === 'category' ? `${budget.categories.length} categories` : 'Simple budget'}
                  </Text>
                  <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                    Last updated: {budget.updatedAt.toDate().toLocaleDateString()}
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

        {/* Custom or Help Me Decide Modal */}
        <Modal
          visible={showCustomOrHelp}
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
                Choose Setup Method
              </Text>

              <TouchableOpacity
                onPress={() => handleCustomOrHelpSelect('custom')}
                className={`p-4 rounded-lg mb-4 ${
                  isDarkMode ? "bg-gray-700" : "bg-gray-100"
                }`}
              >
                <Text className={`text-lg font-semibold mb-2 ${
                  isDarkMode ? "text-gray-200" : "text-gray-900"
                }`}>
                  Custom Setup
                </Text>
                <Text className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  Manually allocate your budget across categories
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleCustomOrHelpSelect('help')}
                className={`p-4 rounded-lg ${
                  isDarkMode ? "bg-gray-700" : "bg-gray-100"
                }`}
              >
                <Text className={`text-lg font-semibold mb-2 ${
                  isDarkMode ? "text-gray-200" : "text-gray-900"
                }`}>
                  Help Me Decide
                </Text>
                <Text className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  Use the 50/30/20 rule to automatically allocate your budget
                </Text>
              </TouchableOpacity>
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
                          onPress={() => setRecurrenceType('daily')}
                          className={`mr-3 px-4 py-2 rounded-full ${
                            recurrenceType === 'daily'
                              ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                              : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                          }`}
                        >
                          <Text className={`${
                            recurrenceType === 'daily' ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                          }`}>
                            Daily
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setRecurrenceType('weekly')}
                          className={`mr-3 px-4 py-2 rounded-full ${
                            recurrenceType === 'weekly'
                              ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                              : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                          }`}
                        >
                          <Text className={`${
                            recurrenceType === 'weekly' ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                          }`}>
                            Weekly
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setRecurrenceType('biweekly')}
                          className={`mr-3 px-4 py-2 rounded-full ${
                            recurrenceType === 'biweekly'
                              ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                              : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                          }`}
                        >
                          <Text className={`${
                            recurrenceType === 'biweekly' ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                          }`}>
                            Biweekly
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setRecurrenceType('monthly')}
                          className={`mr-3 px-4 py-2 rounded-full ${
                            recurrenceType === 'monthly'
                              ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                              : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                          }`}
                        >
                          <Text className={`${
                            recurrenceType === 'monthly' ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                          }`}>
                            Monthly
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setRecurrenceType('custom')}
                          className={`mr-3 px-4 py-2 rounded-full ${
                            recurrenceType === 'custom'
                              ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                              : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                          }`}
                        >
                          <Text className={`${
                            recurrenceType === 'custom' ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                          }`}>
                            Custom
                          </Text>
                        </TouchableOpacity>
                      </ScrollView>

                      {recurrenceType === 'custom' && (
                        <View className="mt-4">
                          <Text className={`text-sm mb-1 ${
                            isDarkMode ? "text-gray-300" : "text-gray-700"
                          }`}>
                            Interval (months)
                          </Text>
                          <View className="flex-row">
                            <TextInput
                              value={recurrenceInterval}
                              onChangeText={setRecurrenceInterval}
                              keyboardType="numeric"
                              returnKeyType="done"
                              className={`flex-1 p-4 rounded-lg ${
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

                  {/* Category Allocations Section */}
                  {budgetType === 'category' && (
                    <View>
                      <View className="flex-row justify-between items-center mb-4">
                        <Text className={`text-sm ${
                          isDarkMode ? "text-gray-300" : "text-gray-700"
                        }`}>
                          Main Category Allocations
                        </Text>
                        <TouchableOpacity
                          onPress={() => setShowMainCategoryModal(true)}
                          className={`px-4 py-2 rounded-lg ${
                            isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]"
                          }`}
                        >
                          <Text className="text-white text-sm">Add Category</Text>
                        </TouchableOpacity>
                      </View>
                      {categories.map((category) => (
                        <View key={category.id} className="mb-4">
                          <View className="flex-row justify-between items-center mb-2">
                            <View className="flex-row items-center">
                              {category.icon.length <= 2 ? (
                                <Text style={{ fontSize: 20 }}>{category.icon}</Text>
                              ) : (
                                <MaterialIcons 
                                  name={category.icon as any} 
                                  size={20} 
                                  color={isDarkMode ? "#E5E7EB" : "#1F2937"} 
                                />
                              )}
                              <Text className={`ml-2 text-sm font-medium ${
                                isDarkMode ? "text-gray-200" : "text-gray-900"
                              }`}>
                                {category.name}
                              </Text>
                            </View>
                            <View className="flex-row">
                              <TouchableOpacity
                                onPress={() => {
                                  setEditingMainCategory(category);
                                  setNewMainCategoryName(category.name);
                                  if (category.icon.length <= 2) {
                                    setShowEmojiInput(true);
                                    setEmojiInput(category.icon);
                                  } else {
                                    setShowEmojiInput(false);
                                    setNewMainCategoryIcon(category.icon);
                                  }
                                  setShowMainCategoryModal(true);
                                }}
                                className="mr-4"
                              >
                                <MaterialIcons 
                                  name="edit" 
                                  size={20} 
                                  color={isDarkMode ? "#E5E7EB" : "#1F2937"} 
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => {
                                  Alert.alert(
                                    'Delete Category',
                                    'Are you sure you want to delete this category?',
                                    [
                                      { text: 'Cancel', style: 'cancel' },
                                      {
                                        text: 'Delete',
                                        style: 'destructive',
                                        onPress: async () => {
                                          try {
                                            await CategoryService.deleteMainCategory(category.id);
                                            Toast.show({
                                              type: 'success',
                                              text1: 'Success',
                                              text2: 'Main category deleted successfully'
                                            });
                                            fetchBudgets();
                                          } catch (error) {
                                            console.error('Error deleting main category:', error);
                                            Toast.show({
                                              type: 'error',
                                              text1: 'Error',
                                              text2: 'Failed to delete main category'
                                            });
                                          }
                                        }
                                      }
                                    ]
                                  );
                                }}
                              >
                                <MaterialIcons 
                                  name="delete" 
                                  size={20} 
                                  color={isDarkMode ? "#EF4444" : "#B91C1C"} 
                                />
                              </TouchableOpacity>
                            </View>
                          </View>
                          <TextInput
                            value={mainCategoryAllocations[category.id] || ''}
                            onChangeText={(text) => {
                              setMainCategoryAllocations(prev => ({
                                ...prev,
                                [category.id]: text
                              }));
                            }}
                            placeholder="Enter amount or percentage"
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
                    onPress={budgetType === 'category' ? handleNext : handleSaveBudget}
                    disabled={isSaving}
                    className={`flex-1 ml-2 p-4 rounded-lg ${
                      isSaving 
                        ? (isDarkMode ? "bg-gray-600" : "bg-gray-400")
                        : (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                    }`}
                  >
                    <Text className="text-white text-center">
                      {isSaving ? 'Saving...' : (budgetType === 'category' ? 'Next' : 'Save')}
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
                  Category Budget
                </Text>
                <Text className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  Track spending across multiple categories
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleBudgetTypeSelect('simple')}
                className={`p-4 rounded-lg mb-4 ${
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
                  Track total spending without categories
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowBudgetTypeSelection(false)}
                className={`p-4 rounded-lg ${
                  isDarkMode ? "bg-gray-600" : "bg-gray-200"
                }`}
              >
                <Text className={`text-center ${
                  isDarkMode ? "text-gray-200" : "text-gray-900"
                }`}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Subcategory Prompt Modal */}
        <Modal
          visible={showSubcategoryPrompt}
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
                Allocate to Subcategories?
              </Text>

              <Text className={`text-sm mb-6 ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>
                Would you like to allocate your budget to specific subcategories, or keep it at the main category level?
              </Text>

              <TouchableOpacity
                onPress={() => {
                  setShowSubcategoryPrompt(false);
                  // Show subcategory allocation view
                  setShowAddBudget(true);
                }}
                className={`p-4 rounded-lg mb-4 ${
                  isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]"
                }`}
              >
                <Text className="text-white text-center font-semibold">
                  Yes, Allocate to Subcategories
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveWithoutSubcategories}
                className={`p-4 rounded-lg ${
                  isDarkMode ? "bg-gray-700" : "bg-gray-200"
                }`}
              >
                <Text className={`text-center font-semibold ${
                  isDarkMode ? "text-gray-200" : "text-gray-900"
                }`}>
                  No, Keep Main Categories Only
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Main Category Modal */}
        <Modal
          visible={showMainCategoryModal}
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
                    {editingMainCategory ? 'Edit Main Category' : 'Add New Main Category'}
                  </Text>
                  <TouchableOpacity onPress={() => {
                    setShowMainCategoryModal(false);
                    setEditingMainCategory(null);
                    setNewMainCategoryName('');
                    setNewMainCategoryIcon('priority-high');
                    setShowEmojiInput(false);
                    setEmojiInput('');
                  }}>
                    <MaterialIcons 
                      name="close" 
                      size={24} 
                      color={isDarkMode ? "#E5E7EB" : "#1F2937"} 
                    />
                  </TouchableOpacity>
                </View>

                <View className="space-y-4">
                  <View>
                    <Text className={`text-sm mb-1 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Main Category Name
                    </Text>
                    <TextInput
                      value={newMainCategoryName}
                      onChangeText={setNewMainCategoryName}
                      placeholder="Enter main category name"
                      className={`p-4 rounded-lg ${
                        isDarkMode 
                          ? "bg-gray-700 text-gray-200" 
                          : "bg-gray-100 text-gray-900"
                      }`}
                    />
                  </View>

                  <View>
                    <Text className={`text-sm mb-1 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Icon
                    </Text>
                    <View className="flex-row mb-2">
                      <TouchableOpacity
                        onPress={() => setShowEmojiInput(false)}
                        className={`flex-1 mr-2 p-3 rounded-lg ${
                          !showEmojiInput
                            ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                            : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                        }`}
                      >
                        <Text className={`text-center ${
                          !showEmojiInput ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                        }`}>
                          Material Icons
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setShowEmojiInput(true)}
                        className={`flex-1 ml-2 p-3 rounded-lg ${
                          showEmojiInput
                            ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                            : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                        }`}
                      >
                        <Text className={`text-center ${
                          showEmojiInput ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                        }`}>
                          Emoji
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {showEmojiInput ? (
                      <TextInput
                        value={emojiInput}
                        onChangeText={(text) => {
                          setEmojiInput(text);
                          if (text.length > 0) {
                            setNewMainCategoryIcon(text);
                          }
                        }}
                        placeholder="Enter emoji"
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        className={`p-4 rounded-lg ${
                          isDarkMode 
                            ? "bg-gray-700 text-gray-200" 
                            : "bg-gray-100 text-gray-900"
                        }`}
                      />
                    ) : (
                      <ScrollView 
                        className="h-48"
                        showsVerticalScrollIndicator={false}
                      >
                        <View className="flex-row flex-wrap justify-between">
                          {availableIcons.map((icon) => (
                            <TouchableOpacity
                              key={icon}
                              onPress={() => setNewMainCategoryIcon(icon)}
                              className={`w-[18%] p-3 mb-3 rounded-lg items-center justify-center ${
                                newMainCategoryIcon === icon
                                  ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                                  : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                              }`}
                            >
                              <MaterialIcons 
                                name={icon as any} 
                                size={24} 
                                color={newMainCategoryIcon === icon ? "white" : (isDarkMode ? "#E5E7EB" : "#1F2937")} 
                              />
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    )}
                  </View>
                </View>

                <View className="flex-row justify-between mt-6">
                  <TouchableOpacity
                    onPress={() => {
                      setShowMainCategoryModal(false);
                      setEditingMainCategory(null);
                      setNewMainCategoryName('');
                      setNewMainCategoryIcon('priority-high');
                      setShowEmojiInput(false);
                      setEmojiInput('');
                    }}
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
                    onPress={async () => {
                      if (!newMainCategoryName.trim()) {
                        Toast.show({
                          type: 'error',
                          text1: 'Error',
                          text2: 'Please enter a main category name'
                        });
                        return;
                      }

                      setIsLoading(true);
                      try {
                        const userId = auth.currentUser?.uid;
                        if (!userId) {
                          Toast.show({
                            type: 'error',
                            text1: 'Error',
                            text2: 'You must be logged in to manage main categories'
                          });
                          return;
                        }

                        if (editingMainCategory) {
                          await CategoryService.updateMainCategory(editingMainCategory.id, {
                            name: newMainCategoryName,
                            icon: newMainCategoryIcon
                          });
                          Toast.show({
                            type: 'success',
                            text1: 'Success',
                            text2: 'Main category updated successfully'
                          });
                        } else {
                          await CategoryService.createMainCategory({
                            name: newMainCategoryName,
                            icon: newMainCategoryIcon,
                            userId,
                            order: categories.length
                          });
                          Toast.show({
                            type: 'success',
                            text1: 'Success',
                            text2: 'Main category added successfully'
                          });
                        }
                        setShowMainCategoryModal(false);
                        setEditingMainCategory(null);
                        setNewMainCategoryName('');
                        setNewMainCategoryIcon('priority-high');
                        setShowEmojiInput(false);
                        setEmojiInput('');
                        await fetchBudgets();
                      } catch (error) {
                        console.error('Error saving main category:', error);
                        Toast.show({
                          type: 'error',
                          text1: 'Error',
                          text2: error instanceof Error ? error.message : 'Failed to save main category'
                        });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                    className={`flex-1 ml-2 p-4 rounded-lg ${
                      isLoading 
                        ? (isDarkMode ? "bg-gray-600" : "bg-gray-400")
                        : (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                    }`}
                  >
                    <Text className="text-white text-center">
                      {isLoading ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
      </View>
    </ScrollView>
  );
};

export default Budgets;