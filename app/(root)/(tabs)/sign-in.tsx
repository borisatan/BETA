import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, Alert, useColorScheme } from 'react-native';
import icons from '@constants/icons';
import { Link } from 'expo-router';

import Constants from 'expo-constants';
import { auth } from "../firebase/firebaseConfig"; // Import Firebase config
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import * as Google from "expo-auth-session/providers/google"; // Ensure this is installed
import { FirebaseError } from "firebase/app"; // Import FirebaseError

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleUser, setGoogleUser] = useState<any>(); // No clue
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  // Google Sign-In - Setup
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: Constants.expoConfig?.extra?.googleClientId, // Use client ID from app.config.js
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleSignIn(id_token); // Handle the sign-in with the id_token from Google
    }
  }, [response]);

  const handleEmailSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Email and password cannot be empty.");
      return;
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('User signed in:', userCredential.user);

      
    } catch (error) {
      if (error instanceof FirebaseError) {
        console.error('Firebase Error:', error.code, error.message);
        alert(error.message);
      } else {
        console.error('Unexpected error:', error);
      }
    }
  };

  const handleGoogleSignIn = async (idToken: string) => {
    try {
      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, googleCredential); // Firebase sign in with Google credential
      console.log('Google Sign-In successful:', userCredential.user);
      setGoogleUser(userCredential.user); // Optionally store the user data
    } catch (error) {
      console.error('Google Sign-In error:', error);
      alert('Something went wrong with Google Sign-In.');
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}
    className="bg-white dark:bg-[#0A0F1F]">
      <View className="w-full max-w-md p-5">
        {/* Title */}
        <View className="items-center mb-8">
          <Text className="text-2xl font-bold text-gray-900 dark:text-gray-200">Welcome back!</Text>
          <Text className="text-sm text-gray-600 dark:text-gray-400">Please sign in to your account</Text>
        </View>

        {/* Sign In Form */}
        <View className="gap-y-3">
          <TextInput
            className="w-full h-12 border border-gray-300 dark:border-gray-600 rounded-lg px-4 text-gray-900 dark:text-gray-200 bg-transparent"
            placeholder="Email address"
            placeholderTextColor={isDarkMode ? "#9CA3AF" : "#6B7280"}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            className="w-full h-12 border border-gray-300 dark:border-gray-600 rounded-lg px-4 text-gray-900 dark:text-gray-200 bg-transparent"
            placeholder="Password"
            placeholderTextColor={isDarkMode ? "#9CA3AF" : "#6B7280"}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <View className="flex-row justify-end mb-4">
            <TouchableOpacity>
              <Text className="text-sm text-blue-800 dark:text-blue-400">Forgot your password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity className="bg-blue-900 dark:bg-blue-600 p-3 rounded-lg items-center" onPress={handleEmailSignIn}>
            <Text className="text-white text-sm font-semibold">Sign in</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View className="flex-row items-center my-6">
          <View className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
          <Text className="mx-4 text-sm text-gray-600 dark:text-gray-400">Or continue with</Text>
          <View className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
        </View>

        {/* Google Sign In Button */}
        <TouchableOpacity
          className="flex-row items-center justify-center bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-300 dark:border-gray-600"
          onPress={() => promptAsync()}
        >
          <Image source={icons.google} className="w-5 h-5 mr-2" resizeMode="contain" />
          <Text className="text-sm font-semibold text-gray-900 dark:text-gray-200">Sign in with Google</Text>
        </TouchableOpacity>

        {/* Sign Up Link */}
        <View className="flex-row justify-center mt-6">
          <Text className="text-sm text-gray-600 dark:text-gray-400">Don't have an account? </Text>
          <Link href="/sign-up" className="text-sm font-semibold text-blue-900 dark:text-blue-400">Sign up</Link>
        </View>
      </View>
    </ScrollView>
  );
};

export default SignIn;