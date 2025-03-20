import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, Keyboard, KeyboardAvoidingView, Modal, Dimensions, Alert, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import { TransactionService } from '../services/transactionService';
import { AccountService } from '../services/accountService';
import { CategoryService, Category, MainCategory } from '../services/categoryService';
import { useTheme } from '../context/ThemeContext';
import { Transaction, Account } from '../firebase/types';
import { auth } from '../firebase/firebaseConfig';
import { Timestamp } from 'firebase/firestore';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

const TransactionAdder = () => {
  const { isDarkMode } = useTheme();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAddEditCategoryModal, setShowAddEditCategoryModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryMainCategory, setNewCategoryMainCategory] = useState<string>('');
  const [selectedIcon, setSelectedIcon] = useState('shopping-cart');
  const [isLoading, setIsLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([]);
  const [showMainCategoryModal, setShowMainCategoryModal] = useState(false);
  const [editingMainCategory, setEditingMainCategory] = useState<MainCategory | null>(null);
  const [newMainCategoryName, setNewMainCategoryName] = useState('');
  const [newMainCategoryIcon, setNewMainCategoryIcon] = useState('priority-high');
  const [emojiInput, setEmojiInput] = useState('');
  const [showEmojiInput, setShowEmojiInput] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingMainCategories, setIsLoadingMainCategories] = useState(true);

  // Define available icons for category selection
  const availableIcons = [
    'shopping-cart', 'home', 'power-settings-new', 'directions-car', 'local-hospital',
    'movie', 'shopping-bag', 'restaurant', 'flight', 'sports-esports',
    'account-balance', 'trending-up', 'school', 'flag', 'favorite',
    'priority-high', 'work', 'fitness-center', 'local-grocery-store',
    'local-cafe', 'local-mall', 'local-gas-station', 'local-pharmacy',
    'local-laundry-service', 'local-parking', 'local-phone', 'local-post-office',
    'local-printshop', 'local-see', 'local-shipping', 'local-taxi'
  ];

  // Add this after the availableIcons array
  const commonEmojis = [
    '🍽️', '🏠', '🚗', '💊', '🎬', '🛍️', '🍴', '✈️', '🎮', '💰',
    '📈', '🎓', '🎯', '❤️', '⚠️', '💼', '💪', '🛒', '☕', '��',
    '⛽',  '👕', '🅿️', '📱', '📬', '🖨️', '👀', '📦', '🚕'
  ];

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'You must be logged in to view categories'
      });
      return;
    }
    fetchAccounts();
    fetchCategories();
    fetchMainCategories();
  }, []);

  const fetchAccounts = async () => {
    setIsLoadingAccounts(true);
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
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const fetchCategories = async () => {
    setIsLoadingCategories(true);
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'You must be logged in to fetch categories'
        });
        return;
      }
      const userCategories = await CategoryService.getUserCategories(userId);
      setCategories(userCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to fetch categories'
      });
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const fetchMainCategories = async () => {
    setIsLoadingMainCategories(true);
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'You must be logged in to fetch main categories'
        });
        return;
      }
      const userMainCategories = await CategoryService.getUserMainCategories(userId);
      setMainCategories(userMainCategories);
      // Set the first main category as selected if none is selected
      if (!selectedMainCategory && userMainCategories.length > 0) {
        setSelectedMainCategory(userMainCategories[0].name);
      }
    } catch (error) {
      console.error('Error fetching main categories:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to fetch main categories'
      });
    } finally {
      setIsLoadingMainCategories(false);
    }
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setShowAmountModal(true);
  };

  const handleSubmit = async () => {
    if (!amount || !selectedAccount || !selectedCategory) {
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
        date: Timestamp.fromDate(date),
        description: notes,
        accountId: selectedAccount,
        categoryId: selectedCategory,
        subcategoryId: '',
        paymentMethod: '',
        notes: '',
        transactionType: 'expense',
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
      setSelectedCategory('');
      setNotes('');
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

  const handleAddCategory = () => {
    setShowCategoryModal(false);
    setEditingCategory(null);
    setNewCategoryName('');
    setNewCategoryMainCategory('Needs');
    setSelectedIcon('shopping-cart');
    setSelectedEmoji(null);
    setShowEmojiPicker(false);
    setShowAddEditCategoryModal(true);
  };

  const handleEditCategory = (category: Category) => {
    setShowCategoryModal(false);
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setNewCategoryMainCategory(category.mainCategory);
    
    // Check if the icon is an emoji or material icon
    if (commonEmojis.includes(category.icon)) {
      setSelectedEmoji(category.icon);
      setSelectedIcon('');
      setShowEmojiPicker(true);
    } else {
      setSelectedIcon(category.icon);
      setSelectedEmoji(null);
      setShowEmojiPicker(false);
    }
    
    setShowAddEditCategoryModal(true);
  };

  const handleDeleteCategory = async (category: Category) => {
    Alert.alert(
      'Delete Category',
      'Are you sure you want to delete this category? This action cannot be undone.',
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
              await CategoryService.deleteCategory(category.id);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Category deleted successfully'
              });
              fetchCategories();
            } catch (error) {
              console.error('Error deleting category:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error instanceof Error ? error.message : 'Failed to delete category'
              });
            }
          }
        }
      ]
    );
  };

  const handleSaveCategory = async () => {
    if (!newCategoryName.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter a category name'
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
          text2: 'You must be logged in to manage categories'
        });
        return;
      }

      const iconToSave = selectedEmoji || selectedIcon;

      if (editingCategory) {
        await CategoryService.updateCategory(editingCategory.id, {
          name: newCategoryName,
          mainCategory: newCategoryMainCategory,
          icon: iconToSave
        });
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Category updated successfully'
        });
      } else {
        await CategoryService.createCategory({
          name: newCategoryName,
          mainCategory: newCategoryMainCategory,
          icon: iconToSave,
          userId
        });
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Category added successfully'
        });
      }
      setShowAddEditCategoryModal(false);
      await fetchCategories();
      setSelectedMainCategory(newCategoryMainCategory);
    } catch (error) {
      console.error('Error saving category:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to save category'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMainCategorySelect = (categoryName: string) => {
    setSelectedMainCategory(categoryName);
  };

  const handleAddMainCategory = () => {
    setShowCategoryModal(false);
    setEditingMainCategory(null);
    setNewMainCategoryName('');
    setNewMainCategoryIcon('priority-high');
    setShowEmojiInput(false);
    setEmojiInput('');
    setShowMainCategoryModal(true);
  };

  const handleEditMainCategory = (mainCategory: MainCategory) => {
    setShowCategoryModal(false);
    setEditingMainCategory(mainCategory);
    setNewMainCategoryName(mainCategory.name);
    
    // Check if the icon is an emoji or material icon
    if (mainCategory.icon.length <= 2) {
      setShowEmojiInput(true);
      setEmojiInput(mainCategory.icon);
    } else {
      setShowEmojiInput(false);
      setNewMainCategoryIcon(mainCategory.icon);
    }
    
    setShowMainCategoryModal(true);
  };

  const handleDeleteMainCategory = async (mainCategory: MainCategory) => {
    Alert.alert(
      'Delete Main Category',
      'Are you sure you want to delete this main category? This action cannot be undone.',
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
              await CategoryService.deleteMainCategory(mainCategory.id);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Main category deleted successfully'
              });
              fetchMainCategories();
            } catch (error) {
              console.error('Error deleting main category:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error instanceof Error ? error.message : 'Failed to delete main category'
              });
            }
          }
        }
      ]
    );
  };

  const handleSaveMainCategory = async () => {
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
          order: mainCategories.length
        });
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Main category added successfully'
        });
      }
      setShowMainCategoryModal(false);
      await fetchMainCategories();
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
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className={`flex-1 ${isDarkMode ? "bg-[#0A0F1F]" : "bg-white"}`}
    >
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="flex-row justify-between items-center mt-12 mb-8 px-6">
          <Text className={`text-2xl font-bold ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
            Categories
          </Text>
          <TouchableOpacity onPress={() => setShowCategoryModal(true)}>
            <Text className={isDarkMode ? "text-blue-400" : "text-blue-800"}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Account Selector */}
        <View className="px-6 mb-6">
          <View className="flex-row items-center mb-2">
            <Text className={`text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              Accounts:
            </Text>
          </View>
          {isLoadingAccounts ? (
            <View className="items-center py-4">
              <ActivityIndicator size="small" color={isDarkMode ? "#1E40AF" : "#1E3A8A"} />
              <Text className={`mt-2 text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                Loading accounts...
              </Text>
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              className="flex-row"
            >
              {accounts.map((account) => (
                <TouchableOpacity 
                  key={account.id}
                  onPress={() => setSelectedAccount(account.id)}
                  className={`mr-3 px-4 py-2 rounded-full ${
                    selectedAccount === account.id
                      ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                      : (isDarkMode ? "bg-gray-800" : "bg-gray-100")
                  }`}
                >
                  <Text className={`${
                    selectedAccount === account.id ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                  }`}>
                    {account.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
            
        {/* Main Categories */}
        {isLoadingMainCategories ? (
          <View className="items-center py-4">
            <ActivityIndicator size="small" color={isDarkMode ? "#1E40AF" : "#1E3A8A"} />
            <Text className={`mt-2 text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              Loading main categories...
            </Text>
          </View>
        ) : (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            className="px-6 mb-6"
          >
            {mainCategories.map((category) => (
              <TouchableOpacity 
                key={category.id}
                onPress={() => handleMainCategorySelect(category.name)}
                className={`mr-4 px-4 py-2 rounded-lg flex-row items-center ${
                  selectedMainCategory === category.name
                    ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                    : (isDarkMode ? "bg-gray-800" : "bg-gray-100")
                }`}
              >
                {category.icon.length <= 2 ? (
                  <Text style={{ fontSize: 20 }}>{category.icon}</Text>
                ) : (
                  <MaterialIcons 
                    name={category.icon as any} 
                    size={20} 
                    color={selectedMainCategory === category.name ? "white" : (isDarkMode ? "#E5E7EB" : "#1F2937")} 
                  />
                )}
                <Text className={`ml-2 ${
                  selectedMainCategory === category.name ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                }`}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Subcategories Grid */}
        <View className="px-6">
          {isLoadingCategories ? (
            <View className="items-center py-4">
              <ActivityIndicator size="small" color={isDarkMode ? "#1E40AF" : "#1E3A8A"} />
              <Text className={`mt-2 text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                Loading subcategories...
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap justify-center">
              {categories
                .filter(cat => cat.mainCategory === selectedMainCategory)
                .map((subCategory) => (
                  <TouchableOpacity 
                    key={subCategory.id}
                    onPress={() => handleCategorySelect(subCategory.name)}
                    className={`w-[31%] mb-4 mx-1 aspect-square rounded-lg ${
                      isDarkMode ? "bg-gray-800" : "bg-gray-100"
                    }`}
                  >
                    <View className="flex-1 items-center justify-center">
                      {subCategory.icon.length <= 2 ? (
                        <Text style={{ fontSize: 32 }}>{subCategory.icon}</Text>
                      ) : (
                        <MaterialIcons 
                          name={subCategory.icon as any} 
                          size={32} 
                          color={isDarkMode ? "#E5E7EB" : "#1F2937"} 
                        />
                      )}
                      <Text className={`mt-2 text-center text-sm ${
                        isDarkMode ? "text-gray-200" : "text-gray-900"
                      }`}>
                        {subCategory.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
            </View>
          )}
        </View>

        {/* Category Management Modal */}
        <Modal
          visible={showCategoryModal}
          transparent={true}
          animationType="slide"
        >
          <View className="flex-1 justify-end">
            <ScrollView className={`max-h-[80%] rounded-t-3xl ${isDarkMode ? "bg-gray-800" : "bg-white"}`}>
              <View className="p-6">
                <View className="flex-row justify-between items-center mb-6">
                  <Text className={`text-xl font-bold ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                    Manage Categories
                  </Text>
                  <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                    <MaterialIcons name="close" size={24} color={isDarkMode ? "#E5E7EB" : "#1F2937"} />
                  </TouchableOpacity>
                </View>

                {/* Main Categories Section */}
                <View className="mb-8">
                  <View className="flex-row justify-between items-center mb-4">
                    <Text className={`text-lg font-semibold ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                      Main Categories
                    </Text>
                    <TouchableOpacity 
                      onPress={handleAddMainCategory}
                      className="flex-row items-center"
                    >
                      <MaterialIcons name="add" size={20} color={isDarkMode ? "#E5E7EB" : "#1F2937"} />
                      <Text className={`ml-1 ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>Add</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {mainCategories.map((category) => (
                    <View key={`main-${category.id}`} className="flex-row items-center justify-between mb-3 p-3 rounded-lg bg-opacity-10 bg-gray-500">
                      <View className="flex-row items-center">
                        {category.icon.length > 2 ? (
                          <MaterialIcons name={category.icon as any} size={24} color={isDarkMode ? "#E5E7EB" : "#1F2937"} />
                        ) : (
                          <Text style={{ fontSize: 20 }}>{category.icon}</Text>
                        )}
                        <Text className={`ml-3 font-medium ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                          {category.name}
                        </Text>
                      </View>
                      <View className="flex-row">
                        <TouchableOpacity onPress={() => handleEditMainCategory(category)} className="mr-4">
                          <MaterialIcons name="edit" size={20} color={isDarkMode ? "#E5E7EB" : "#1F2937"} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteMainCategory(category)}>
                          <MaterialIcons name="delete" size={20} color={isDarkMode ? "#EF4444" : "#B91C1C"} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Subcategories Section */}
                <View className="mb-8">
                  <Text className={`text-lg font-semibold mb-4 ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                    Subcategories
                  </Text>
                  
                  {mainCategories.map((mainCat) => (
                    <View key={`main-${mainCat.id}`} className="mb-6">
                      <Text className={`text-base font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                        {mainCat.name}
                      </Text>
                      {categories
                        .filter(cat => cat.mainCategory === mainCat.name)
                        .map((category) => (
                          <View key={`sub-${category.id}`} className="flex-row items-center justify-between mb-3 p-3 rounded-lg bg-opacity-5 bg-gray-500">
                            <View className="flex-row items-center">
                              {category.icon.length <= 2 ? (
                                <Text style={{ fontSize: 20 }}>{category.icon}</Text>
                              ) : (
                                <MaterialIcons name={category.icon as any} size={20} color={isDarkMode ? "#E5E7EB" : "#1F2937"} />
                              )}
                              <Text className={`ml-3 ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                                {category.name}
                              </Text>
                            </View>
                            <View className="flex-row">
                              <TouchableOpacity onPress={() => handleEditCategory(category)} className="mr-4">
                                <MaterialIcons name="edit" size={20} color={isDarkMode ? "#E5E7EB" : "#1F2937"} />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => handleDeleteCategory(category)}>
                                <MaterialIcons name="delete" size={20} color={isDarkMode ? "#EF4444" : "#B91C1C"} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                    </View>
                  ))}
                </View>

                {/* Add New Category Button */}
                <TouchableOpacity
                  onPress={handleAddCategory}
                  className={`p-4 rounded-lg flex-row items-center justify-center mb-6 ${
                    isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]"
                  }`}
                >
                  <MaterialIcons name="add" size={24} color="white" />
                  <Text className="ml-2 text-white font-semibold">
                    Add New Category
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* Add/Edit Category Modal */}
        <Modal
          visible={showAddEditCategoryModal}
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
                    {editingCategory ? 'Edit Category' : 'Add New Category'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowAddEditCategoryModal(false)}>
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
                      Category Name
                    </Text>
                    <TextInput
                      value={newCategoryName}
                      onChangeText={setNewCategoryName}
                      placeholder="Enter category name"
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
                      Main Category
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      className="flex-row"
                    >
                      {mainCategories.map((category) => (
                        <TouchableOpacity 
                          key={category.id}
                          onPress={() => setNewCategoryMainCategory(category.name)}
                          className={`mr-4 px-4 py-2 rounded-lg flex-row items-center ${
                            newCategoryMainCategory === category.name
                              ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                              : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                          }`}
                        >
                          {category.icon.length <= 2 ? (
                            <Text style={{ fontSize: 18 }}>{category.icon}</Text>
                          ) : (
                            <MaterialIcons 
                              name={category.icon as any} 
                              size={20} 
                              color={newCategoryMainCategory === category.name ? "white" : (isDarkMode ? "#E5E7EB" : "#1F2937")} 
                            />
                          )}
                          <Text className={`ml-2 ${
                            newCategoryMainCategory === category.name ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                          }`}>
                            {category.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View>
                    <Text className={`text-sm mb-1 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Icon
                    </Text>
                    <View className="flex-row mb-2">
                      <TouchableOpacity 
                        onPress={() => setShowEmojiPicker(false)}
                        className={`flex-1 mr-2 p-3 rounded-lg ${
                          !showEmojiPicker
                            ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                            : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                        }`}
                      >
                        <Text className={`text-center ${
                          !showEmojiPicker ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                        }`}>
                          Material Icons
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setShowEmojiPicker(true)}
                        className={`flex-1 ml-2 p-3 rounded-lg ${
                          showEmojiPicker
                            ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                            : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                        }`}
                      >
                        <Text className={`text-center ${
                          showEmojiPicker ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-900")
                        }`}>
                          Emojis
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {showEmojiPicker ? (
                      <View>
                        <TextInput
                          value={emojiInput}
                          onChangeText={(text) => {
                            setEmojiInput(text);
                            if (text.length > 0) {
                              setSelectedEmoji(text);
                              setSelectedIcon('');
                            }
                          }}
                          placeholder="Type an emoji"
                          returnKeyType="done"
                          onSubmitEditing={Keyboard.dismiss}
                          className={`p-4 mb-2 rounded-lg ${
                            isDarkMode 
                              ? "bg-gray-700 text-gray-200" 
                              : "bg-gray-100 text-gray-900"
                          }`}
                        />
                        <ScrollView 
                          horizontal 
                          showsHorizontalScrollIndicator={false}
                          className="flex-row"
                        >
                          {commonEmojis.map((emoji) => (
                            <TouchableOpacity
                              key={emoji}
                              onPress={() => {
                                setSelectedEmoji(emoji);
                                setSelectedIcon('');
                                setEmojiInput(emoji);
                              }}
                              className={`mr-3 p-3 rounded-lg ${
                                selectedEmoji === emoji
                                  ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                                  : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                              }`}
                            >
                              <Text style={{ fontSize: 24 }}>{emoji}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    ) : (
                      <ScrollView 
                        className="h-48"
                        showsVerticalScrollIndicator={false}
                      >
                        <View className="flex-row flex-wrap justify-between">
                          {availableIcons.map((icon) => (
                            <TouchableOpacity
                              key={icon}
                              onPress={() => {
                                setSelectedIcon(icon);
                                setSelectedEmoji(null);
                              }}
                              className={`w-[18%] p-3 mb-3 rounded-lg items-center justify-center ${
                                selectedIcon === icon
                                  ? (isDarkMode ? "bg-[#1E40AF]" : "bg-[#1E3A8A]")
                                  : (isDarkMode ? "bg-gray-700" : "bg-gray-100")
                              }`}
                            >
                              <MaterialIcons 
                                name={icon as any} 
                                size={24} 
                                color={selectedIcon === icon ? "white" : (isDarkMode ? "#E5E7EB" : "#1F2937")} 
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
                    onPress={() => setShowAddEditCategoryModal(false)}
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
                    onPress={handleSaveCategory}
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

        {/* Main Category Management Modal */}
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
                  <TouchableOpacity onPress={() => setShowMainCategoryModal(false)}>
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
                    onPress={() => setShowMainCategoryModal(false)}
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
                    onPress={handleSaveMainCategory}
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

        {/* Amount Input Modal */}
        <Modal
          visible={showAmountModal}
          transparent={true}
          animationType="slide"
        >
          <View className="flex-1 justify-end">
            <View className={`p-6 rounded-t-3xl ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            }`}>
              <View className="mb-4">
                <Text className={`text-lg font-bold ${
                  isDarkMode ? "text-gray-200" : "text-gray-900"
                }`}>
                  Enter Amount for {selectedCategory}
                </Text>
                <Text className={`text-sm mt-1 ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  Please enter the amount and any additional notes
                </Text>
              </View>
              <View className="space-y-4">
                <View>
                  <Text className={`text-sm mb-1 ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}>
                    Amount
                  </Text>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="Enter amount"
                    keyboardType="numeric"
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
                    Notes (Optional)
                  </Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Add notes"
                    className={`p-4 rounded-lg ${
                      isDarkMode 
                        ? "bg-gray-700 text-gray-200" 
                        : "bg-gray-100 text-gray-900"
                    }`}
                  />
                </View>
              </View>
              <View className="flex-row justify-between mt-6">
                <TouchableOpacity 
                  onPress={() => setShowAmountModal(false)}
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
                  onPress={handleSubmit}
                  className={isDarkMode ? "flex-1 ml-2 p-4 rounded-lg bg-[#1E40AF]" : "flex-1 ml-2 p-4 rounded-lg bg-[#1E3A8A]"}
                >
                  <Text className="text-white text-center">Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default TransactionAdder;
