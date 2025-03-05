import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, useColorScheme, Platform, Switch} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import { db, auth } from '../firebase/firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Appearance } from 'react-native';

// Transaction interface
interface Transaction {
  amount: number;
  date: Date;
  category: string;
  paymentMethod: string;
  notes: string;
  userId: string;
  createdAt: any;
}

const TransactionAdder = () => {
  // Form state
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [category, setCategory] = useState('Groceries');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  
  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Theme state
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreference] = useState('system');
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');
  
  // Update theme based on preference
  useEffect(() => {
    if (themePreference === 'system') {
      setIsDarkMode(systemColorScheme === 'dark');
    }
  }, [systemColorScheme, themePreference]);
  
  // Categories and payment methods
  const categories = [
    'Groceries', 'Dining', 'Transportation', 'Entertainment', 
    'Shopping', 'Utilities', 'Housing', 'Healthcare', 'Education', 
    'Personal Care', 'Travel', 'Gifts', 'Investments', 'Income', 'Other'
  ];
  
  const paymentMethods = [
    'Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 
    'Mobile Payment', 'Check', 'Other'
  ];

  // Handle date change
  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios');
    setDate(currentDate);
  };

  // Handle theme toggle
  const handleThemeToggle = (value: string) => {
    setThemePreference(value);
    if (value === 'light') {
      setIsDarkMode(false);
    } else if (value === 'dark') {
      setIsDarkMode(true);
    } else {
      setIsDarkMode(systemColorScheme === 'dark');
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validate form
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter a valid amount'
      });
      return;
    }

    try {
      const user = auth.currentUser;
      
      if (!user) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'You must be logged in to add transactions'
        });
        return;
      }

      // Create transaction object
      const transaction: Transaction = {
        amount: parseFloat(amount),
        date,
        category,
        paymentMethod,
        notes,
        userId: user.uid,
        createdAt: serverTimestamp()
      };

      // Add to Firestore
      // This is where the backend integration would happen
      // For now, we'll just show a success message
      
      // Simulating a successful transaction add
      console.log('Transaction to add:', transaction);
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Transaction added successfully'
      });

      // Reset form
      setAmount('');
      setDate(new Date());
      setCategory('Groceries');
      setPaymentMethod('Cash');
      setNotes('');
      
    } catch (error) {
      console.error('Error adding transaction:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to add transaction'
      });
    }
  };

  // Backend implementation idea:
  /*
    To implement the backend logic for transaction adding:
    
    1. Create a transactions collection in Firestore
    2. Use the following code to add a transaction:
    
    const addTransaction = async (transaction: Transaction) => {
      try {
        const docRef = await addDoc(collection(db, "transactions"), transaction);
        console.log("Transaction added with ID: ", docRef.id);
        return docRef.id;
      } catch (error) {
        console.error("Error adding transaction: ", error);
        throw error;
      }
    };
    
    3. Add offline support using SQLite:
    - Store transactions locally when offline
    - Sync with Firestore when back online
    - Use a queue system to handle pending uploads
    
    4. Add transaction categorization:
    - Use keywords in notes to suggest categories
    - Learn from user's categorization patterns
    
    5. Add recurring transactions:
    - Add a "recurring" flag and frequency to the transaction object
    - Use a background task to add recurring transactions on schedule
  */

  return (
    <ScrollView 
      contentContainerStyle={{ flexGrow: 1, padding: 20 }}
      className={isDarkMode ? "bg-[#0A0F1F]" : "bg-white"}
    >
      <View className="w-full max-w-md mx-auto">
        {/* Header */}
        <View className="items-center mb-8">
          <Text className={`text-2xl font-bold ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
            Add Transaction
          </Text>
          <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
            Track your spending and income
          </Text>
        </View>

        {/* Theme Toggle */}
        <View className="mb-6 p-4 rounded-lg border border-gray-300 dark:border-gray-700">
          <Text className={`text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
            Theme Preference
          </Text>
          <View className="flex-row justify-between items-center">
            <TouchableOpacity 
              onPress={() => handleThemeToggle('light')}
              className={`px-3 py-2 rounded-lg ${themePreference === 'light' ? 'bg-blue-900 dark:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              <Text className={themePreference === 'light' ? 'text-white' : isDarkMode ? 'text-gray-300' : 'text-gray-800'}>
                Light
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => handleThemeToggle('system')}
              className={`px-3 py-2 rounded-lg ${themePreference === 'system' ? 'bg-blue-900 dark:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              <Text className={themePreference === 'system' ? 'text-white' : isDarkMode ? 'text-gray-300' : 'text-gray-800'}>
                System
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => handleThemeToggle('dark')}
              className={`px-3 py-2 rounded-lg ${themePreference === 'dark' ? 'bg-blue-900 dark:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              <Text className={themePreference === 'dark' ? 'text-white' : isDarkMode ? 'text-gray-300' : 'text-gray-800'}>
                Dark
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Transaction Form */}
        <View className="gap-y-4">
          {/* Amount */}
          <View>
            <Text className={`text-sm font-medium mb-1 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
              Amount
            </Text>
            <TextInput
              className={`w-full h-12 border rounded-lg px-4 ${
                isDarkMode 
                  ? "border-gray-600 text-gray-200 bg-gray-800" 
                  : "border-gray-300 text-gray-900 bg-white"
              }`}
              placeholder="0.00"
              placeholderTextColor={isDarkMode ? "#9CA3AF" : "#6B7280"}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
          </View>

          {/* Date */}
          <View>
            <Text className={`text-sm font-medium mb-1 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
              Date
            </Text>
            <TouchableOpacity 
              onPress={() => setShowDatePicker(true)}
              className={`w-full h-12 border rounded-lg px-4 flex-row items-center justify-between ${
                isDarkMode 
                  ? "border-gray-600 bg-gray-800" 
                  : "border-gray-300 bg-white"
              }`}
            >
              <Text className={isDarkMode ? "text-gray-200" : "text-gray-900"}>
                {date.toLocaleDateString()}
              </Text>
              <Text className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                📅
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={onDateChange}
              />
            )}
          </View>

          {/* Category */}
          <View>
            <Text className={`text-sm font-medium mb-1 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
              Category
            </Text>
            <View className={`border rounded-lg overflow-hidden ${
              isDarkMode 
                ? "border-gray-600 bg-gray-800" 
                : "border-gray-300 bg-white"
            }`}>
              <Picker
                selectedValue={category}
                onValueChange={(itemValue : any) => setCategory(itemValue)}
                style={{ 
                  color: isDarkMode ? '#E5E7EB' : '#1F2937',
                  height: 50
                }}
                dropdownIconColor={isDarkMode ? '#E5E7EB' : '#1F2937'}
              >
                {categories.map((cat) => (
                  <Picker.Item key={cat} label={cat} value={cat} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Payment Method */}
          <View>
            <Text className={`text-sm font-medium mb-1 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
              Payment Method
            </Text>
            <View className={`border rounded-lg overflow-hidden ${
              isDarkMode 
                ? "border-gray-600 bg-gray-800" 
                : "border-gray-300 bg-white"
            }`}>
              <Picker
                selectedValue={paymentMethod}
                onValueChange={(itemValue : any) => setPaymentMethod(itemValue)}
                style={{ 
                  color: isDarkMode ? '#E5E7EB' : '#1F2937',
                  height: 50
                }}
                dropdownIconColor={isDarkMode ? '#E5E7EB' : '#1F2937'}
              >
                {paymentMethods.map((method) => (
                  <Picker.Item key={method} label={method} value={method} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Notes */}
          <View>
            <Text className={`text-sm font-medium mb-1 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
              Notes (Optional)
            </Text>
            <TextInput
              className={`w-full h-24 border rounded-lg px-4 py-2 ${
                isDarkMode 
                  ? "border-gray-600 text-gray-200 bg-gray-800" 
                  : "border-gray-300 text-gray-900 bg-white"
              }`}
              placeholder="Add notes about this transaction..."
              placeholderTextColor={isDarkMode ? "#9CA3AF" : "#6B7280"}
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            className={`mt-4 p-4 rounded-lg items-center ${
              isDarkMode ? "bg-blue-600" : "bg-blue-900"
            }`}
            onPress={handleSubmit}
          >
            <Text className="text-white text-base font-semibold">
              Add Transaction
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

export default TransactionAdder;
