import { db } from '../firebase/firebaseConfig';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, Timestamp, arrayUnion, arrayRemove, getDoc, serverTimestamp, writeBatch, increment } from 'firebase/firestore';
import { Account, RecurringIncome } from '../firebase/types';
import { auth } from '../firebase/firebaseConfig';

export class AccountService {
  private static collection = 'accounts';
  private static recurringIncomeCollection = 'recurringIncomes';

  static async createAccount(account: Omit<Account, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.collection), {
        ...account,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  }

  static async getUserAccounts(userId: string): Promise<Account[]> {
    try {
      const q = query(
        collection(db, this.collection),
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Account));
    } catch (error) {
      console.error('Error fetching user accounts:', error);
      throw error;
    }
  }

  static async updateAccount(id: string, updates: Partial<Account>): Promise<void> {
    try {
      const docRef = doc(db, this.collection, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating account:', error);
      throw error;
    }
  }

  static async deleteAccount(id: string): Promise<void> {
    try {
      const docRef = doc(db, this.collection, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }

  static async addRecurringIncome(accountId: string, recurringIncome: Omit<RecurringIncome, 'id' | 'userId' | 'accountId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const batch = writeBatch(db);

      // Create recurring income document
      const recurringIncomeRef = doc(collection(db, this.recurringIncomeCollection));
      const now = Timestamp.now();
      const recurringIncomeData = {
        ...recurringIncome,
        userId,
        accountId,
        createdAt: now,
        updatedAt: now
      };
      batch.set(recurringIncomeRef, recurringIncomeData);

      // Create initial transaction for the recurring income
      const transactionRef = doc(collection(db, 'transactions'));
      const transactionData = {
        userId,
        amount: recurringIncome.amount,
        description: `${recurringIncome.description} (Recurring)`,
        accountId,
        categoryId: '', // You might want to create a special income category
        date: now,
        transactionType: 'income',
        createdAt: now,
        updatedAt: now
      };
      batch.set(transactionRef, transactionData);

      // Update account balance and add recurring income reference
      const accountRef = doc(db, this.collection, accountId);
      batch.update(accountRef, {
        balance: increment(recurringIncome.amount),
        recurringIncomes: arrayUnion({
          id: recurringIncomeRef.id,
          ...recurringIncomeData
        }),
        updatedAt: now
      });

      await batch.commit();
      return recurringIncomeRef.id;
    } catch (error) {
      console.error('Error adding recurring income:', error);
      throw error;
    }
  }

  static async updateRecurringIncome(accountId: string, recurringIncomeId: string, updates: Partial<RecurringIncome>): Promise<void> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Update recurring income document
      const recurringIncomeRef = doc(db, this.recurringIncomeCollection, recurringIncomeId);
      await updateDoc(recurringIncomeRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });

      // Update recurring income in account's array
      const accountRef = doc(db, this.collection, accountId);
      const accountDoc = await getDoc(accountRef);
      const account = accountDoc.data() as Account;
      
      if (account.recurringIncomes) {
        const updatedRecurringIncomes = account.recurringIncomes.map(income => 
          income.id === recurringIncomeId 
            ? { ...income, ...updates, updatedAt: Timestamp.now() }
            : income
        );

        await updateDoc(accountRef, {
          recurringIncomes: updatedRecurringIncomes
        });
      }
    } catch (error) {
      console.error('Error updating recurring income:', error);
      throw error;
    }
  }

  static async deleteRecurringIncome(accountId: string, recurringIncomeId: string): Promise<void> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Delete recurring income document
      const recurringIncomeRef = doc(db, this.recurringIncomeCollection, recurringIncomeId);
      await deleteDoc(recurringIncomeRef);

      // Remove recurring income from account's array
      const accountRef = doc(db, this.collection, accountId);
      const accountDoc = await getDoc(accountRef);
      const account = accountDoc.data() as Account;
      
      if (account.recurringIncomes) {
        const updatedRecurringIncomes = account.recurringIncomes.filter(
          income => income.id !== recurringIncomeId
        );

        await updateDoc(accountRef, {
          recurringIncomes: updatedRecurringIncomes
        });
      }
    } catch (error) {
      console.error('Error deleting recurring income:', error);
      throw error;
    }
  }

  static async getAccountRecurringIncomes(accountId: string): Promise<RecurringIncome[]> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const q = query(
        collection(db, this.recurringIncomeCollection),
        where('accountId', '==', accountId),
        where('userId', '==', userId)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RecurringIncome[];
    } catch (error) {
      console.error('Error fetching account recurring incomes:', error);
      throw error;
    }
  }

  static async addIncome(accountId: string, income: { amount: number; description: string }): Promise<void> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const accountRef = doc(db, this.collection, accountId);
      const accountDoc = await getDoc(accountRef);
      const account = accountDoc.data() as Account;

      // Create transaction for the income
      const transactionData = {
        userId,
        amount: income.amount,
        description: income.description,
        accountId,
        categoryId: '', // You might want to create a special income category
        date: serverTimestamp(),
        transactionType: 'income',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Create transaction and update account balance in a batch
      const batch = writeBatch(db);
      
      // Add transaction
      const transactionRef = doc(collection(db, 'transactions'));
      batch.set(transactionRef, transactionData);
      
      // Update account balance
      batch.update(accountRef, {
        balance: increment(income.amount),
        updatedAt: serverTimestamp()
      });

      await batch.commit();
    } catch (error) {
      console.error('Error adding income:', error);
      throw error;
    }
  }

  static async processRecurringIncome(recurringIncomeId: string): Promise<void> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get the recurring income
      const recurringIncomeRef = doc(db, this.recurringIncomeCollection, recurringIncomeId);
      const recurringIncomeDoc = await getDoc(recurringIncomeRef);
      if (!recurringIncomeDoc.exists()) {
        throw new Error('Recurring income not found');
      }

      const recurringIncome = recurringIncomeDoc.data() as RecurringIncome;
      const batch = writeBatch(db);

      // Create transaction for the recurring income
      const transactionRef = doc(collection(db, 'transactions'));
      const transactionData = {
        userId,
        amount: recurringIncome.amount,
        description: `${recurringIncome.description} (Recurring)`,
        accountId: recurringIncome.accountId,
        categoryId: '', // You might want to create a special income category
        date: serverTimestamp(),
        transactionType: 'income',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(transactionRef, transactionData);

      // Update account balance
      const accountRef = doc(db, this.collection, recurringIncome.accountId);
      batch.update(accountRef, {
        balance: increment(recurringIncome.amount),
        updatedAt: serverTimestamp()
      });

      // Calculate and update next recurrence date
      const currentDate = new Date();
      let nextDate = new Date(currentDate);

      switch (recurringIncome.recurrenceType) {
        case 'daily':
          nextDate.setDate(currentDate.getDate() + 1);
          break;
        case 'weekly':
          nextDate.setDate(currentDate.getDate() + 7);
          break;
        case 'biweekly':
          nextDate.setDate(currentDate.getDate() + 14);
          break;
        case 'monthly':
          nextDate.setMonth(currentDate.getMonth() + 1);
          break;
        case 'custom':
          nextDate.setMonth(currentDate.getMonth() + (recurringIncome.recurrenceInterval || 1));
          break;
      }

      // Update the recurring income with new next recurrence date
      batch.update(recurringIncomeRef, {
        nextRecurrenceDate: Timestamp.fromDate(nextDate),
        updatedAt: serverTimestamp()
      });

      await batch.commit();
    } catch (error) {
      console.error('Error processing recurring income:', error);
      throw error;
    }
  }

  static async processAllDueRecurringIncomes(userId: string): Promise<{ processed: number, errors: number }> {
    try {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get the current date
      const now = new Date();
      const currentTimestamp = Timestamp.fromDate(now);
      
      // Query for all recurring incomes that are due (nextRecurrenceDate <= now)
      const q = query(
        collection(db, this.recurringIncomeCollection),
        where('userId', '==', userId),
        where('nextRecurrenceDate', '<=', currentTimestamp)
      );
      
      const querySnapshot = await getDocs(q);
      console.log(`Found ${querySnapshot.docs.length} recurring incomes due for processing`);
      
      let processed = 0;
      let errors = 0;
      
      // Process each due recurring income
      for (const doc of querySnapshot.docs) {
        try {
          const recurringIncome = { id: doc.id, ...doc.data() } as RecurringIncome;
          
          // Use the existing processRecurringIncome method to handle the income
          await this.processRecurringIncome(recurringIncome.id);
          processed++;
          
          console.log(`Successfully processed recurring income ${recurringIncome.id} for account ${recurringIncome.accountId}`);
        } catch (error) {
          console.error(`Error processing recurring income ${doc.id}:`, error);
          errors++;
        }
      }
      
      return { processed, errors };
    } catch (error) {
      console.error('Error processing due recurring incomes:', error);
      throw error;
    }
  }
} 