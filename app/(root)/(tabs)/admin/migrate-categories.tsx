import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function AdminMigrateCategories() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the main migration page
    router.replace('/migrate-categories');
  }, []);
  
  // Return empty component while redirecting
  return null;
} 