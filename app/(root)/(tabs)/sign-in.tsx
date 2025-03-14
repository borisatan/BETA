import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import icons from '@constants/icons';
import { Link } from 'expo-router';
import Constants from 'expo-constants';
import { auth } from "../firebase/firebaseConfig";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import * as Google from "expo-auth-session/providers/google";
import { FirebaseError } from "firebase/app";
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleUser, setGoogleUser] = useState<any>();
  const { isDarkMode } = useTheme();

  // Google Sign-In - Setup
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: Constants.expoConfig?.extra?.googleClientId,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleSignIn(id_token);
    }
  }, [response]);

  const handleEmailSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Toast.show({type: 'error', text1: 'Error', text2: 'Email and password cannot be empty.'});
      return;
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('User signed in:', userCredential.user);
      // Store authentication state
      await AsyncStorage.setItem('isAuthenticated', 'true');
      Toast.show({type: 'success', text1: 'Welcome Back!', text2: 'Signed in successfully.'});
    } catch (error: any) {
      if (error instanceof FirebaseError) {
        console.error('Firebase Error:', error.code, error.message);
        let errorMessage = 'An error occurred. Please try again.';

        switch (error.code) {
          case 'auth/wrong-password':
            errorMessage = 'Incorrect password.';
            break;
          case 'auth/invalid-credential':
            errorMessage = 'Wrong email or password.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Invalid email address.';
            break;
          default:
            errorMessage = 'Something went wrong. Please try again.';
            break;
        }
        Toast.show({ type: 'error', text1: 'Error', text2: errorMessage });
      } else {
        console.error('Unexpected Error: ', error);
      }
    }
  };

  const handleGoogleSignIn = async (idToken: string) => {
    try {
      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, googleCredential);
      // Store authentication state
      await AsyncStorage.setItem('isAuthenticated', 'true');
      console.log('Google Sign-In successful:', userCredential.user);
      setGoogleUser(userCredential.user);
    } catch (error) {
      console.error('Google Sign-In error:', error);
      alert('Something went wrong with Google Sign-In.');
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}
    className={isDarkMode ? "bg-[#0A0F1F]" : "bg-white"}>
      <View className="w-full max-w-md p-5">
        {/* Title */}
        <View className="items-center mb-8">
          <Text className={`text-2xl font-bold ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>Welcome back!</Text>
          <Text className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>Please sign in to your account</Text>
        </View>

        {/* Sign In Form */}
        <View className="gap-y-3">
          <TextInput
            className={`w-full h-12 border rounded-lg px-4 ${
              isDarkMode 
                ? "border-gray-600 text-gray-200 bg-transparent" 
                : "border-gray-300 text-gray-900 bg-transparent"
            }`}
            placeholder="Email address"
            placeholderTextColor={isDarkMode ? "#9CA3AF" : "#6B7280"}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            className={`w-full h-12 border rounded-lg px-4 ${
              isDarkMode 
                ? "border-gray-600 text-gray-200 bg-transparent" 
                : "border-gray-300 text-gray-900 bg-transparent"
            }`}
            placeholder="Password"
            placeholderTextColor={isDarkMode ? "#9CA3AF" : "#6B7280"}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <View className="flex-row justify-end mb-4">
            <TouchableOpacity>
              <Text className={isDarkMode ? "text-sm text-blue-400" : "text-sm text-blue-800"}>Forgot your password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            className={isDarkMode ? "bg-blue-600 p-3 rounded-lg items-center" : "bg-blue-900 p-3 rounded-lg items-center"} 
            onPress={handleEmailSignIn}
          >
            <Text className="text-white text-sm font-semibold">Sign in</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View className="flex-row items-center my-6">
          <View className={isDarkMode ? "flex-1 h-px bg-gray-600" : "flex-1 h-px bg-gray-300"} />
          <Text className={isDarkMode ? "mx-4 text-sm text-gray-400" : "mx-4 text-sm text-gray-600"}>Or continue with</Text>
          <View className={isDarkMode ? "flex-1 h-px bg-gray-600" : "flex-1 h-px bg-gray-300"} />
        </View>

        {/* Google Sign In Button */}
        <TouchableOpacity
          className={`flex-row items-center justify-center p-3 rounded-lg border ${
            isDarkMode 
              ? "bg-gray-800 border-gray-600" 
              : "bg-white border-gray-300"
          }`}
          onPress={() => promptAsync()}
        >
          <Image source={icons.google} className="w-5 h-5 mr-2" resizeMode="contain" />
          <Text className={isDarkMode ? "text-sm font-semibold text-gray-200" : "text-sm font-semibold text-gray-900"}>Sign in with Google</Text>
        </TouchableOpacity>

        {/* Sign Up Link */}
        <View className="flex-row justify-center mt-6">
          <Text className={isDarkMode ? "text-sm text-gray-400" : "text-sm text-gray-600"}>Don't have an account? </Text>
          <Link href="/sign-up" className={isDarkMode ? "text-sm font-semibold text-blue-400" : "text-sm font-semibold text-blue-900"}>Sign up</Link>
        </View>
      </View>
    </ScrollView>
  );
};

export default SignIn;