import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import icons from '@constants/icons';
import { Link, router } from 'expo-router';
import Constants from 'expo-constants';
import { auth } from "../firebase/firebaseConfig";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import * as Google from "expo-auth-session/providers/google";
import { FirebaseError } from "firebase/app";
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { UserService } from '../services/userService';

const SignUp = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const { isDarkMode } = useTheme();

    // Google Sign-In - Setup
    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        clientId: Constants.expoConfig?.extra?.googleClientId,
    });

    const handleEmailSignUp = async () => {
        if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
            Toast.show({type: 'error', text1: 'Error', text2: 'All fields are required.'});
            return;
        }

        if (password !== confirmPassword) {
            Toast.show({type: 'error', text1: 'Error', text2: 'Passwords do not match.'});
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Create user document in Firestore
            await UserService.createUser(user.uid, user.email || '', user.displayName, user.photoURL);
            
            Toast.show({type: 'success', text1: 'Welcome!', text2: 'Account created successfully.'});
            router.replace('/');
        } catch (error: any) {
            if (error instanceof FirebaseError) {
                console.error('Firebase Error:', error.code, error.message);
                let errorMessage = 'An error occurred. Please try again.';

                switch (error.code) {
                    case 'auth/email-already-in-use':
                        errorMessage = 'This email is already registered.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'Invalid email address.';
                        break;
                    case 'auth/weak-password':
                        errorMessage = 'Password should be at least 6 characters.';
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

    return (
        <ScrollView
            contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'center',
                alignItems: 'center',
                padding: 20
            }}
            className="bg-white dark:bg-[#0A0F1F]"
        >
            <View className="w-full max-w-md p-5">
                <View className="items-center mb-8">
                    <Text className="text-2xl font-bold text-gray-900 dark:text-gray-200 mb-2">Create an Account</Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400">Sign up to get started</Text>
                </View>

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
                    <TextInput
                        className="w-full h-12 border border-gray-300 dark:border-gray-600 rounded-lg px-4 text-gray-900 dark:text-gray-200 bg-transparent"
                        placeholder="Confirm Password"
                        placeholderTextColor={isDarkMode ? "#9CA3AF" : "#6B7280"}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                    />
                    <TouchableOpacity
                        className="bg-blue-900 dark:bg-blue-600 p-3 rounded-lg items-center"
                        onPress={handleEmailSignUp}
                    >
                        <Text className="text-white text-sm font-semibold">Sign up</Text>
                    </TouchableOpacity>
                </View>

                <View className="flex-row justify-center mt-6">
                    <Text className="text-gray-600 dark:text-gray-400 text-sm">Already have an account? </Text>
                    <Link href="/sign-in" className="text-blue-900 dark:text-blue-400 text-sm font-semibold">
                        Sign in
                    </Link>
                </View>
            </View>
        </ScrollView>
    );
};

export default SignUp;