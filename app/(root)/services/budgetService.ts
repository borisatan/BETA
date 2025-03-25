import { db } from '../firebase/firebaseConfig';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, Timestamp, writeBatch, arrayUnion, arrayRemove } from 'firebase/firestore';
import { auth } from '../firebase/firebaseConfig';

export interface Budget {
  id: string;
  userId: string;
  name: string;
  amount: number;
  categories: {
    categoryId: string;
    allocated: number;
    spent: number;
  }[];
  startDate: Timestamp;
  endDate: Timestamp;
  isRecurring: boolean;
  recurrenceType?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  recurrenceInterval?: number;
  nextRenewalDate?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  budgetType: 'category' | 'simple';
}

export class BudgetService {
  private static collection = 'budgets';

  static async createBudget(budget: Omit<Budget, 'id'>): Promise<string> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const docRef = await addDoc(collection(db, this.collection), {
        ...budget,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating budget:', error);
      throw error;
    }
  }

  static async getUserBudgets(userId: string): Promise<Budget[]> {
    try {
      const q = query(
        collection(db, this.collection),
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Budget[];
    } catch (error) {
      console.error('Error fetching user budgets:', error);
      throw error;
    }
  }

  static async updateBudget(id: string, updates: Partial<Budget>): Promise<void> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const docRef = doc(db, this.collection, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating budget:', error);
      throw error;
    }
  }

  static async deleteBudget(id: string): Promise<void> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const docRef = doc(db, this.collection, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting budget:', error);
      throw error;
    }
  }

  static async updateBudgetSpending(budgetId: string, categoryId: string, amount: number): Promise<void> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const docRef = doc(db, this.collection, budgetId);
      const batch = writeBatch(db);

      // Update the spent amount for the specific category
      batch.update(docRef, {
        'categories': arrayRemove(
          { categoryId: categoryId }
        )
      });

      batch.update(docRef, {
        'categories': arrayUnion(
          { categoryId: categoryId, spent: amount }
        ),
        updatedAt: Timestamp.now()
      });

      await batch.commit();
    } catch (error) {
      console.error('Error updating budget spending:', error);
      throw error;
    }
  }

  static async getCurrentBudgets(userId: string): Promise<Budget[]> {
    try {
      const now = Timestamp.now();
      const q = query(
        collection(db, this.collection),
        where('userId', '==', userId),
        where('startDate', '<=', now),
        where('endDate', '>=', now)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Budget[];
    } catch (error) {
      console.error('Error fetching current budgets:', error);
      throw error;
    }
  }

  static async getBudgetsByDateRange(userId: string, startDate: Timestamp, endDate: Timestamp): Promise<Budget[]> {
    try {
      const q = query(
        collection(db, this.collection),
        where('userId', '==', userId),
        where('startDate', '>=', startDate),
        where('endDate', '<=', endDate)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Budget[];
    } catch (error) {
      console.error('Error fetching budgets by date range:', error);
      throw error;
    }
  }

  static async processRecurringBudgets(): Promise<void> {
    try {
      const now = Timestamp.now();
      const q = query(
        collection(db, this.collection),
        where('isRecurring', '==', true),
        where('nextRenewalDate', '<=', now)
      );
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);

      for (const doc of querySnapshot.docs) {
        const budget = doc.data() as Budget;
        const nextDate = new Date();

        // Calculate next renewal date based on recurrence type
        switch (budget.recurrenceType) {
          case 'daily':
            nextDate.setDate(nextDate.getDate() + 1);
            break;
          case 'weekly':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
          case 'biweekly':
            nextDate.setDate(nextDate.getDate() + 14);
            break;
          case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
          case 'custom':
            nextDate.setMonth(nextDate.getMonth() + (budget.recurrenceInterval || 1));
            break;
        }

        // Reset spent amounts and update next renewal date
        const updatedCategories = budget.categories.map(cat => ({
          ...cat,
          spent: 0
        }));

        batch.update(doc.ref, {
          categories: updatedCategories,
          nextRenewalDate: Timestamp.fromDate(nextDate),
          updatedAt: Timestamp.now()
        });
      }

      await batch.commit();
    } catch (error) {
      console.error('Error processing recurring budgets:', error);
      throw error;
    }
  }
} 