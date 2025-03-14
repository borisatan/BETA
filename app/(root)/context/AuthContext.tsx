import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase/firebaseConfig';
import { User } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';

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

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // User is signed in
          setUser(firebaseUser);
          // Store auth state
          await AsyncStorage.setItem('isAuthenticated', 'true');
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