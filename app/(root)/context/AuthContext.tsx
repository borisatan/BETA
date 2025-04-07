import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase/firebaseConfig';
import { User } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { PreloadService } from '../services/preloadService';
import { AppState, AppStateStatus } from 'react-native';

type AuthContextType = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // Function to trigger preloading of dashboard data
  const preloadDashboardData = async (userId: string) => {
    console.log('Starting dashboard data preloading for user:', userId);
    try {
      // Preload with the default timeframe (month)
      await PreloadService.preloadDashboardData('month');
    } catch (error) {
      console.error('Error preloading dashboard data:', error);
    }
  };

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // When app comes to foreground, preload data if user is signed in
      if (nextAppState === 'active' && user) {
        preloadDashboardData(user.uid);
      } else if (nextAppState === 'background') {
        // Clear less critical data when app goes to background
        PreloadService.clearAllPreloadedData();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user]);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // User is signed in
          setUser(firebaseUser);
          // Store auth state
          await AsyncStorage.setItem('isAuthenticated', 'true');
          
          // Preload dashboard data in the background
          preloadDashboardData(firebaseUser.uid);
        } else {
          // No user is signed in, check if we have stored authentication
          const isAuthenticated = await AsyncStorage.getItem('isAuthenticated');
          if (!isAuthenticated) {
            // No stored authentication, clear user
            setUser(null);
            await AsyncStorage.removeItem('isAuthenticated');
          }
        }
      } catch (error) {
        console.error('Auth state change error:', error);
      } finally {
        setLoading(false);
      }
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  // Handle routing based on auth state
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const isSignInPage = segments.includes("sign-in");
    const isSignUpPage = segments.includes("sign-up");

    if (!user && !isSignInPage && !isSignUpPage) {
      // Check stored authentication before redirecting
      AsyncStorage.getItem('isAuthenticated').then((isAuthenticated) => {
        if (!isAuthenticated) {
          router.replace("/sign-in");
        }
      });
    } else if (user && (isSignInPage || isSignUpPage)) {
      router.replace("/");
    }
  }, [user, loading, segments]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 