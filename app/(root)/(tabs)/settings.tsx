import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { auth } from '../firebase/firebaseConfig';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';

const Settings = () => {
  const { isDarkMode, themePreference, setThemePreference } = useTheme();

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await auth.signOut();
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Signed out successfully'
      });
    } catch (error) {
      console.error('Error signing out:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to sign out'
      });
    }
  };

  return (
    <ScrollView 
      className={`flex-1 ${isDarkMode ? "bg-[#0A0F1F]" : "bg-white"}`}
      contentContainerStyle={{ padding: 20 }}
    >
      <View className="w-full max-w-md mx-auto">
        {/* Header */}
        <View className="items-center mb-8">
          <Text className={`text-2xl font-bold ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
            Settings
          </Text>
          <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
            Manage your preferences
          </Text>
        </View>

        {/* Profile Section */}
        <View className={`mb-6 p-4 rounded-lg border ${
          isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
        }`}>
          <View className="flex-row items-center mb-4">
            <View className={`w-16 h-16 rounded-full ${
              isDarkMode ? "bg-gray-700" : "bg-gray-200"
            } items-center justify-center mr-4`}>
              <Text className={`text-2xl ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                {auth.currentUser?.email?.[0].toUpperCase() || '?'}
              </Text>
            </View>
            <View>
              <Text className={`text-lg font-semibold ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                {auth.currentUser?.email}
              </Text>
              <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                {auth.currentUser?.uid}
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            onPress={handleSignOut}
            className={`p-3 rounded-lg items-center ${
              isDarkMode ? "bg-red-900" : "bg-red-100"
            }`}
          >
            <Text className="text-red-500 font-semibold">Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Theme Settings */}
        <View className={`mb-6 p-4 rounded-lg border ${
          isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
        }`}>
          <Text className={`text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
            Theme Preference
          </Text>
          <View className="flex-row justify-between items-center">
            <TouchableOpacity 
              onPress={() => setThemePreference('light')}
              className={`px-3 py-2 rounded-lg ${themePreference === 'light' ? 'bg-blue-900' : isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
            >
              <Text className={themePreference === 'light' ? 'text-white' : isDarkMode ? 'text-gray-300' : 'text-gray-800'}>
                Light
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setThemePreference('system')}
              className={`px-3 py-2 rounded-lg ${themePreference === 'system' ? 'bg-blue-900' : isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
            >
              <Text className={themePreference === 'system' ? 'text-white' : isDarkMode ? 'text-gray-300' : 'text-gray-800'}>
                System
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setThemePreference('dark')}
              className={`px-3 py-2 rounded-lg ${themePreference === 'dark' ? 'bg-blue-900' : isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
            >
              <Text className={themePreference === 'dark' ? 'text-white' : isDarkMode ? 'text-gray-300' : 'text-gray-800'}>
                Dark
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* App Info */}
        <View className={`p-4 rounded-lg border ${
          isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"
        }`}>
          <Text className={`text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-800"}`}>
            About FinTrack
          </Text>
          <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
            Version 1.0.0
          </Text>
          <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
            © 2024 FinTrack. All rights reserved.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

export default Settings; 