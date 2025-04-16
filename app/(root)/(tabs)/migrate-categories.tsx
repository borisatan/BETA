import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useColorScheme } from 'nativewind';
import Toast from 'react-native-toast-message';
import { migrateCategories, cleanupCategoryMigration } from '../scripts/migrateCategories';
import { MaterialIcons } from '@expo/vector-icons';

const MigrateCategories = () => {
  const { colorScheme } = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  
  const [isMigrating, setIsMigrating] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [migrationCompleted, setMigrationCompleted] = useState(false);
  const [cleanupCompleted, setCleanupCompleted] = useState(false);
  
  const handleRunMigration = async () => {
    setIsMigrating(true);
    try {
      const result = await migrateCategories();
      if (result.success) {
        setMigrationCompleted(true);
        Toast.show({
          type: 'success',
          text1: 'Migration Successful',
          text2: 'Categories have been migrated successfully!'
        });
      } else {
        throw new Error(result.error instanceof Error ? result.error.message : 'Unknown error during migration');
      }
    } catch (error) {
      console.error('Migration error:', error);
      Toast.show({
        type: 'error',
        text1: 'Migration Failed',
        text2: error instanceof Error ? error.message : 'An error occurred during migration'
      });
    } finally {
      setIsMigrating(false);
    }
  };
  
  const handleRunCleanup = async () => {
    setIsCleaning(true);
    try {
      const result = await cleanupCategoryMigration();
      if (result.success) {
        setCleanupCompleted(true);
        Toast.show({
          type: 'success',
          text1: 'Cleanup Successful',
          text2: 'Category cleanup completed successfully!'
        });
      } else {
        throw new Error(result.error instanceof Error ? result.error.message : 'Unknown error during cleanup');
      }
    } catch (error) {
      console.error('Cleanup error:', error);
      Toast.show({
        type: 'error',
        text1: 'Cleanup Failed',
        text2: error instanceof Error ? error.message : 'An error occurred during cleanup'
      });
    } finally {
      setIsCleaning(false);
    }
  };
  
  return (
    <ScrollView>
      <View className={`flex-1 p-4 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <Text className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Category Migration Tool
        </Text>
        
        <View className={`p-4 rounded-lg mb-6 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <Text className={`mb-2 font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
            What does this do?
          </Text>
          <Text className={`mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            This tool updates your categories to use our new data structure. It's a one-time process that will:
          </Text>
          <View className="mb-1 flex-row">
            <MaterialIcons name="check-circle" size={18} color={isDarkMode ? "#4CAF50" : "#2E7D32"} style={{marginRight: 8}} />
            <Text className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Migrate your existing categories</Text>
          </View>
          <View className="mb-1 flex-row">
            <MaterialIcons name="check-circle" size={18} color={isDarkMode ? "#4CAF50" : "#2E7D32"} style={{marginRight: 8}} />
            <Text className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Combine any duplicate categories</Text>
          </View>
          <View className="mb-1 flex-row">
            <MaterialIcons name="check-circle" size={18} color={isDarkMode ? "#4CAF50" : "#2E7D32"} style={{marginRight: 8}} />
            <Text className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Update the data structure for better performance</Text>
          </View>
        </View>

        <View className={`mb-6 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <Text className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Step 1: Run Migration
          </Text>
          <Text className={`mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            This will update your categories to the new schema. This may take a few moments.
          </Text>

          <TouchableOpacity
            onPress={handleRunMigration}
            disabled={isMigrating || migrationCompleted}
            className={`p-4 rounded-lg mb-2 ${
              migrationCompleted 
                ? (isDarkMode ? 'bg-green-700' : 'bg-green-500')
                : (isMigrating 
                  ? (isDarkMode ? 'bg-gray-600' : 'bg-gray-400') 
                  : (isDarkMode ? 'bg-blue-600' : 'bg-blue-500'))
            }`}
          >
            {isMigrating ? (
              <View className="flex-row justify-center items-center">
                <ActivityIndicator color="white" size="small" />
                <Text className="text-white text-center font-semibold ml-2">Migrating...</Text>
              </View>
            ) : migrationCompleted ? (
              <View className="flex-row justify-center items-center">
                <MaterialIcons name="check-circle" size={20} color="white" />
                <Text className="text-white text-center font-semibold ml-2">Migration Complete</Text>
              </View>
            ) : (
              <Text className="text-white text-center font-semibold">Run Migration</Text>
            )}
          </TouchableOpacity>
        </View>

        <View className={`mb-4 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <Text className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Step 2: Run Cleanup
          </Text>
          <Text className={`mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            After migration is complete, this will clean up any leftover fields and finalize the process.
          </Text>

          <TouchableOpacity
            onPress={handleRunCleanup}
            disabled={isCleaning || cleanupCompleted || !migrationCompleted}
            className={`p-4 rounded-lg ${
              cleanupCompleted 
                ? (isDarkMode ? 'bg-green-700' : 'bg-green-500')
                : (isCleaning 
                  ? (isDarkMode ? 'bg-gray-600' : 'bg-gray-400') 
                  : (!migrationCompleted
                    ? (isDarkMode ? 'bg-gray-700' : 'bg-gray-300')
                    : (isDarkMode ? 'bg-blue-600' : 'bg-blue-500')))
            }`}
          >
            {isCleaning ? (
              <View className="flex-row justify-center items-center">
                <ActivityIndicator color="white" size="small" />
                <Text className="text-white text-center font-semibold ml-2">Cleaning up...</Text>
              </View>
            ) : cleanupCompleted ? (
              <View className="flex-row justify-center items-center">
                <MaterialIcons name="check-circle" size={20} color="white" />
                <Text className="text-white text-center font-semibold ml-2">Cleanup Complete</Text>
              </View>
            ) : (
              <Text className={`text-center font-semibold ${!migrationCompleted ? 'text-gray-400' : 'text-white'}`}>
                Run Cleanup
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {cleanupCompleted && (
          <View className={`p-4 rounded-lg mt-4 ${isDarkMode ? 'bg-green-800' : 'bg-green-100'}`}>
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="check-circle" size={24} color={isDarkMode ? "#4CAF50" : "#2E7D32"} />
              <Text className={`ml-2 font-bold ${isDarkMode ? 'text-green-300' : 'text-green-800'}`}>
                All Done!
              </Text>
            </View>
            <Text className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Your categories have been successfully migrated to the new schema. You can now continue using the app as normal.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default MigrateCategories; 