'use client';

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image} from 'react-native';
import icons from '@constants/icons';

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailSignIn = () => {
    // Implement email sign in logic here
  };

  const handleGoogleSignIn = () => {
    // Implement Google sign in logic here
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.formContainer}>
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Welcome back!</Text>
          <Text style={styles.subtitle}>Please sign in to your account</Text>
        </View>

        {/* Sign In Form */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="#6B7280"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#6B7280"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <View style={styles.rememberContainer}>
            {/* Remember me would go here - requires custom checkbox component */}
            <TouchableOpacity>
              <Text style={styles.forgotPassword}>Forgot your password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.signInButton} onPress={handleEmailSignIn}>
            <Text style={styles.signInButtonText}>Sign in</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>Or continue with</Text>
          <View style={styles.divider} />
        </View>

        {/* Google Sign In Button */}
        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn}>
          <Image source={icons.google} style={styles.googleIcon} resizeMode="contain" />
          <Text style={styles.googleButtonText}>Sign in with Google</Text>
        </TouchableOpacity>

        {/* Sign Up Link */}
        <View style={styles.signUpContainer}>
          <Text style={styles.signUpText}>Don't have an account? </Text>
          <TouchableOpacity>
            <Text style={styles.signUpLink}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  form: {
    gap: 16,
  },
  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 16,
  },
  rememberContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  forgotPassword: {
    fontSize: 14,
    color: '#1E3A8A',
  },
  signInButton: {
    backgroundColor: '#1E3A8A',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#D1D5DB',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#6B7280',
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row', // Align icon & text in a row
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center', // Center items vertically
    justifyContent: 'center', // Center content horizontally
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginBottom: 24,
  },
  googleButtonText: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '600',
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 8, // Add spacing between icon and text
  },

  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signUpText: {
    color: '#6B7280',
    fontSize: 14,
  },
  signUpLink: {
    color: '#1E3A8A',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SignIn;