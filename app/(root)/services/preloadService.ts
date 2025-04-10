import { auth } from '../firebase/firebaseConfig';
import { TransactionService } from './transactionService';
import { DailyAggregationService } from './dailyAggregationService';
import { CategoryService } from './categoryService';
import { Timestamp } from 'firebase/firestore';
import { Transaction, DailyAggregation } from '../firebase/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define a structure to store preloaded data
interface PreloadedData {
  transactions: {
    [timeframe: string]: {
      data: Transaction[];
      timestamp: number;
      startDate: Date;
      endDate: Date;
    }
  };
  aggregations: {
    [timeframe: string]: {
      current: DailyAggregation[];
      previous: DailyAggregation[];
      timestamp: number;
    }
  };
  categories: {
    data: any[];
    timestamp: number;
  };
  mainCategories: {
    data: any[];
    timestamp: number;
  };
}

// Define cache expiry times
const CACHE_EXPIRY = {
  TRANSACTIONS: 5 * 60 * 1000, // 5 minutes
  AGGREGATIONS: 5 * 60 * 1000, // 5 minutes
  CATEGORIES: 15 * 60 * 1000,  // 15 minutes
};

class PreloadServiceClass {
  private preloadedData: PreloadedData = {
    transactions: {},
    aggregations: {},
    categories: { data: [], timestamp: 0 },
    mainCategories: { data: [], timestamp: 0 },
  };
  
  private isPreloading = false;
  private lastTimeframe: 'week' | 'month' | '6months' | 'year' = 'month'; // Default timeframe
  private lastFetchedTransactions: Record<string, Transaction> = {};

  getLastFetchedTransaction(timeFrame: string): Transaction | null {
    return this.lastFetchedTransactions[timeFrame] || null;
  }

  setLastFetchedTransaction(timeFrame: string, transaction: Transaction) {
    this.lastFetchedTransactions[timeFrame] = transaction;
  }

  clearPreloadedData(timeFrame: string) {
    // Clear only the data for the specific timeframe
    // Don't clear categories as they are timeframe-independent
    delete this.preloadedData.transactions[timeFrame];
    delete this.preloadedData.aggregations[timeFrame];
    delete this.lastFetchedTransactions[timeFrame];
  }

  // Utility function to get date ranges based on timeFrame
  private getDateRanges(timeFrame: "week" | "month" | "6months" | "year") {
    const now = new Date();
    let currentStart: Date,
      currentEnd: Date,
      previousStart: Date,
      previousEnd: Date;

    switch (timeFrame) {
      case "week":
        currentStart = new Date(now.setDate(now.getDate() - now.getDay()));
        currentEnd = new Date(now.setDate(now.getDate() + 6));
        previousStart = new Date(
          new Date(currentStart).setDate(currentStart.getDate() - 7)
        );
        previousEnd = new Date(
          new Date(currentEnd).setDate(currentEnd.getDate() - 7)
        );
        break;
      case "month":
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "6months":
        currentStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 12, 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth() - 6, 0);
        break;
      case "year":
        currentStart = new Date(now.getFullYear(), 0, 1);
        currentEnd = new Date(now.getFullYear(), 11, 31);
        previousStart = new Date(now.getFullYear() - 1, 0, 1);
        previousEnd = new Date(now.getFullYear() - 1, 11, 31);
        break;
    }

    return { currentStart, currentEnd, previousStart, previousEnd };
  }

  /**
   * Preload dashboard data for the specified timeframe
   * @param timeframe The timeframe to preload data for
   * @param forceRefresh Whether to force refresh cached data
   */
  async preloadDashboardData(
    timeframe: 'week' | 'month' | '6months' | 'year' = 'month',
    forceRefresh = false
  ): Promise<void> {
    const userId = auth.currentUser?.uid;
    
    if (!userId || this.isPreloading) {
      // If no user or already preloading, don't proceed
      return;
    }
    
    this.isPreloading = true;
    this.lastTimeframe = timeframe;
    
    try {
      // First, preload categories as they're common for all timeframes
      await this.preloadCategories(userId, forceRefresh);
      
      // Preload the requested timeframe first (priority)
      await Promise.all([
        this.preloadTransactions(userId, timeframe, forceRefresh),
        this.preloadAggregations(userId, timeframe, forceRefresh)
      ]);
      
      console.log(`Successfully preloaded dashboard data for timeframe: ${timeframe}`);
      
      // Then, asynchronously preload data for other timeframes in the background
      if (timeframe !== 'week') {
        this.preloadTransactions(userId, 'week', forceRefresh).catch(e => 
          console.error('Background preload error (week transactions):', e));
        this.preloadAggregations(userId, 'week', forceRefresh).catch(e => 
          console.error('Background preload error (week aggregations):', e));
      }
      
      if (timeframe !== 'month') {
        this.preloadTransactions(userId, 'month', forceRefresh).catch(e => 
          console.error('Background preload error (month transactions):', e));
        this.preloadAggregations(userId, 'month', forceRefresh).catch(e => 
          console.error('Background preload error (month aggregations):', e));
      }
      
      if (timeframe !== '6months') {
        this.preloadTransactions(userId, '6months', forceRefresh).catch(e => 
          console.error('Background preload error (6months transactions):', e));
        this.preloadAggregations(userId, '6months', forceRefresh).catch(e => 
          console.error('Background preload error (6months aggregations):', e));
      }
      
      if (timeframe !== 'year') {
        this.preloadTransactions(userId, 'year', forceRefresh).catch(e => 
          console.error('Background preload error (year transactions):', e));
        this.preloadAggregations(userId, 'year', forceRefresh).catch(e => 
          console.error('Background preload error (year aggregations):', e));
      }
      
    } catch (error) {
      console.error('Error preloading dashboard data:', error);
    } finally {
      this.isPreloading = false;
    }
  }
  
  /**
   * Preload transactions for the specified timeframe
   */
  private async preloadTransactions(
    userId: string, 
    timeframe: 'week' | 'month' | '6months' | 'year',
    forceRefresh = false
  ): Promise<void> {
    const { currentStart, currentEnd } = this.getDateRanges(timeframe);
    const cacheKey = `${timeframe}-${userId}`;
    const now = Date.now();
    const cache = this.preloadedData.transactions[cacheKey];
    
    // Check if we have valid cached data
    if (
      !forceRefresh && 
      cache && 
      now - cache.timestamp < CACHE_EXPIRY.TRANSACTIONS &&
      cache.startDate.getTime() === currentStart.getTime() &&
      cache.endDate.getTime() === currentEnd.getTime()
    ) {
      console.log(`Using cached transactions for ${timeframe}`);
      return;
    }
    
    // Fetch transactions
    console.log(`Preloading transactions for ${timeframe}...`);
    try {
      const transactions = await TransactionService.getTransactionsByDateRange(
        userId,
        currentStart,
        currentEnd
      );
      
      // Store in cache
      this.preloadedData.transactions[cacheKey] = {
        data: transactions,
        timestamp: now,
        startDate: currentStart,
        endDate: currentEnd
      };
      
      console.log(`Preloaded ${transactions.length} transactions for ${timeframe}`);
    } catch (error) {
      console.error(`Error preloading transactions for ${timeframe}:`, error);
    }
  }
  
  /**
   * Preload aggregations for specified timeframe
   */
  private async preloadAggregations(
    userId: string, 
    timeframe: 'week' | 'month' | '6months' | 'year',
    forceRefresh = false
  ): Promise<void> {
    const { currentStart, currentEnd, previousStart, previousEnd } = this.getDateRanges(timeframe);
    const cacheKey = `${timeframe}-${userId}`;
    const now = Date.now();
    const cache = this.preloadedData.aggregations[cacheKey];
    
    // Check if we have valid cached data
    if (
      !forceRefresh && 
      cache && 
      now - cache.timestamp < CACHE_EXPIRY.AGGREGATIONS
    ) {
      console.log(`Using cached aggregations for ${timeframe}`);
      return;
    }
    
    // Fetch aggregations
    console.log(`Preloading aggregations for ${timeframe}...`);
    try {
      const [currentAggregations, previousAggregations] = await Promise.all([
        DailyAggregationService.getDailyAggregations(userId, currentStart, currentEnd),
        DailyAggregationService.getDailyAggregations(userId, previousStart, previousEnd)
      ]);
      
      // Store in cache
      this.preloadedData.aggregations[cacheKey] = {
        current: currentAggregations,
        previous: previousAggregations,
        timestamp: now
      };
      
      console.log(`Preloaded ${currentAggregations.length} current and ${previousAggregations.length} previous aggregations for ${timeframe}`);
    } catch (error) {
      console.error(`Error preloading aggregations for ${timeframe}:`, error);
    }
  }
  
  /**
   * Preload categories and main categories
   */
  private async preloadCategories(
    userId: string,
    forceRefresh = false
  ): Promise<void> {
    const now = Date.now();
    
    // Check if we have valid cached categories
    if (
      !forceRefresh && 
      this.preloadedData.categories.data.length > 0 &&
      now - this.preloadedData.categories.timestamp < CACHE_EXPIRY.CATEGORIES
    ) {
      console.log('[PreloadService] Using cached categories');
      return;
    }
    
    // Fetch categories
    console.log('[PreloadService] Preloading categories...');
    try {
      const [categories, mainCategories] = await Promise.all([
        CategoryService.getUserCategories(userId),
        CategoryService.getUserMainCategories(userId)
      ]);
      
      console.log('[PreloadService] Fetched categories and main categories:', {
        categoriesCount: categories.length,
        mainCategoriesCount: mainCategories.length,
        categoryIds: categories.map(c => c.id).slice(0, 5), // Log first 5 category IDs
        mainCategoryIds: mainCategories.map(c => c.id).slice(0, 5) // Log first 5 main category IDs
      });
      
      if (!categories.length || !mainCategories.length) {
        console.error('[PreloadService] Warning: Empty categories or main categories fetched');
      }
      
      // Store in cache - keep the original object structure to ensure types match when retrieved
      this.preloadedData.categories = {
        data: categories,
        timestamp: now
      };
      
      this.preloadedData.mainCategories = {
        data: mainCategories,
        timestamp: now
      };
      
      // Also store in AsyncStorage for persistence across page refreshes
      try {
        await AsyncStorage.setItem('fintrack_categories', JSON.stringify(categories));
        await AsyncStorage.setItem('fintrack_categories_timestamp', now.toString());
        await AsyncStorage.setItem('fintrack_main_categories', JSON.stringify(mainCategories));
        await AsyncStorage.setItem('fintrack_main_categories_timestamp', now.toString());
        console.log('[PreloadService] Saved categories to AsyncStorage');
      } catch (e) {
        console.error('[PreloadService] Could not save categories to AsyncStorage:', e);
      }
      
      console.log(`[PreloadService] Preloaded ${categories.length} categories and ${mainCategories.length} main categories`);
    } catch (error) {
      console.error('[PreloadService] Error preloading categories:', error);
    }
  }
  
  /**
   * Get preloaded transactions for the specified timeframe
   */
  getPreloadedTransactions(
    timeframe: 'week' | 'month' | '6months' | 'year'
  ): Transaction[] | null {
    const userId = auth.currentUser?.uid;
    if (!userId) return null;
    
    const cacheKey = `${timeframe}-${userId}`;
    const cache = this.preloadedData.transactions[cacheKey];
    const now = Date.now();
    
    if (cache && now - cache.timestamp < CACHE_EXPIRY.TRANSACTIONS) {
      return cache.data;
    }
    
    return null;
  }
  
  /**
   * Get preloaded aggregations for the specified timeframe
   */
  getPreloadedAggregations(
    timeframe: 'week' | 'month' | '6months' | 'year'
  ): { current: DailyAggregation[], previous: DailyAggregation[] } | null {
    const userId = auth.currentUser?.uid;
    if (!userId) return null;
    
    const cacheKey = `${timeframe}-${userId}`;
    const cache = this.preloadedData.aggregations[cacheKey];
    const now = Date.now();
    
    if (cache && now - cache.timestamp < CACHE_EXPIRY.AGGREGATIONS) {
      return {
        current: cache.current,
        previous: cache.previous
      };
    }
    
    return null;
  }
  
  /**
   * Get preloaded categories
   */
  async getPreloadedCategories(): Promise<any[] | null> {
    const now = Date.now();
    
    // Log the category cache details for debugging
    console.log('[PreloadService] Category cache check:', {
      cacheSize: this.preloadedData.categories.data.length,
      cacheAgeMs: now - this.preloadedData.categories.timestamp,
      cacheExpiryMs: CACHE_EXPIRY.CATEGORIES,
      isExpired: now - this.preloadedData.categories.timestamp >= CACHE_EXPIRY.CATEGORIES
    });
    
    if (
      this.preloadedData.categories.data.length > 0 &&
      now - this.preloadedData.categories.timestamp < CACHE_EXPIRY.CATEGORIES
    ) {
      console.log('[PreloadService] Using cached categories:', this.preloadedData.categories.data.length);
      return this.preloadedData.categories.data;
    }
    
    // If cache is empty or expired, try to restore from AsyncStorage
    try {
      const storedCategories = await AsyncStorage.getItem('fintrack_categories');
      const storedTimestamp = await AsyncStorage.getItem('fintrack_categories_timestamp');
      
      if (storedCategories && storedTimestamp) {
        const timestamp = parseInt(storedTimestamp, 10);
        
        // Check if stored data is still valid
        if (now - timestamp < CACHE_EXPIRY.CATEGORIES * 2) { // Double the expiry for AsyncStorage
          const parsedCategories = JSON.parse(storedCategories);
          console.log('[PreloadService] Restoring categories from AsyncStorage:', parsedCategories.length);
          
          // Update memory cache
          this.preloadedData.categories = {
            data: parsedCategories,
            timestamp
          };
          
          return parsedCategories;
        }
      }
    } catch (error) {
      console.error('[PreloadService] Error restoring categories from AsyncStorage:', error);
    }
    
    console.log('[PreloadService] No valid categories in cache');
    return null;
  }
  
  /**
   * Get preloaded main categories
   */
  async getPreloadedMainCategories(): Promise<any[] | null> {
    const now = Date.now();
    
    // Log the main category cache details for debugging
    console.log('[PreloadService] Main category cache check:', {
      cacheSize: this.preloadedData.mainCategories.data.length,
      cacheAgeMs: now - this.preloadedData.mainCategories.timestamp,
      cacheExpiryMs: CACHE_EXPIRY.CATEGORIES,
      isExpired: now - this.preloadedData.mainCategories.timestamp >= CACHE_EXPIRY.CATEGORIES
    });
    
    if (
      this.preloadedData.mainCategories.data.length > 0 &&
      now - this.preloadedData.mainCategories.timestamp < CACHE_EXPIRY.CATEGORIES
    ) {
      console.log('[PreloadService] Using cached main categories:', this.preloadedData.mainCategories.data.length);
      return this.preloadedData.mainCategories.data;
    }
    
    // If cache is empty or expired, try to restore from AsyncStorage
    try {
      const storedMainCategories = await AsyncStorage.getItem('fintrack_main_categories');
      const storedTimestamp = await AsyncStorage.getItem('fintrack_main_categories_timestamp');
      
      if (storedMainCategories && storedTimestamp) {
        const timestamp = parseInt(storedTimestamp, 10);
        
        // Check if stored data is still valid
        if (now - timestamp < CACHE_EXPIRY.CATEGORIES * 2) { // Double the expiry for AsyncStorage
          const parsedMainCategories = JSON.parse(storedMainCategories);
          console.log('[PreloadService] Restoring main categories from AsyncStorage:', parsedMainCategories.length);
          
          // Update memory cache
          this.preloadedData.mainCategories = {
            data: parsedMainCategories,
            timestamp
          };
          
          return parsedMainCategories;
        }
      }
    } catch (error) {
      console.error('[PreloadService] Error restoring main categories from AsyncStorage:', error);
    }
    
    console.log('[PreloadService] No valid main categories in cache');
    return null;
  }
  
  /**
   * Get the last timeframe that was preloaded
   */
  getLastTimeframe(): 'week' | 'month' | '6months' | 'year' {
    return this.lastTimeframe;
  }
  
  /**
   * Clear all preloaded data
   */
  clearAllPreloadedData(): void {
    this.preloadedData = {
      transactions: {},
      aggregations: {},
      categories: { data: [], timestamp: 0 },
      mainCategories: { data: [], timestamp: 0 },
    };
    console.log('Cleared all preloaded dashboard data');
  }
}

// Create a singleton instance
export const PreloadService = new PreloadServiceClass(); 