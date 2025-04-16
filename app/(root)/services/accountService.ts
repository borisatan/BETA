import { db } from '../firebase/firebaseConfig';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, Timestamp, arrayUnion, arrayRemove, getDoc, serverTimestamp, writeBatch, increment } from 'firebase/firestore';
import { Account, RecurringIncome } from '../firebase/types';
import { auth } from '../firebase/firebaseConfig';

export class AccountService {
  private static collection = 'accounts';
  private static MAX_RECURRING_INCOMES = 10;

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
      const accountRef = doc(db, this.collection, accountId);
      const accountDoc = await getDoc(accountRef);
      const account = accountDoc.data() as Account;

      // Check if we've reached the limit
      if (account.recurringIncomes && account.recurringIncomes.length >= this.MAX_RECURRING_INCOMES) {
        throw new Error(`Maximum of ${this.MAX_RECURRING_INCOMES} recurring incomes per account reached`);
      }

      // Generate a new ID for the recurring income
      const recurringIncomeId = doc(collection(db, '_')).id;
      const now = Timestamp.now();

      // Create the recurring income object
      const newRecurringIncome: RecurringIncome = {
        ...recurringIncome,
        id: recurringIncomeId,
        userId,
        accountId,
        createdAt: now,
        updatedAt: now
      };

      // Update the account with the new recurring income
      batch.update(accountRef, {
        recurringIncomes: arrayUnion(newRecurringIncome),
        updatedAt: now
      });

      await batch.commit();
      return recurringIncomeId;
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

      const accountRef = doc(db, this.collection, accountId);
      const accountDoc = await getDoc(accountRef);
      const account = accountDoc.data() as Account;

      if (!account.recurringIncomes) {
        throw new Error('No recurring incomes found');
      }

      // Find and update the specific recurring income
      const updatedRecurringIncomes = account.recurringIncomes.map(income => {
        if (income.id === recurringIncomeId) {
          return {
            ...income,
            ...updates,
            updatedAt: Timestamp.now()
          };
        }
        return income;
      });

      // Update the account with the modified recurring incomes array
      await updateDoc(accountRef, {
        recurringIncomes: updatedRecurringIncomes,
        updatedAt: Timestamp.now()
      });
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

      const accountRef = doc(db, this.collection, accountId);
      const accountDoc = await getDoc(accountRef);
      const account = accountDoc.data() as Account;

      if (!account.recurringIncomes) {
        throw new Error('No recurring incomes found');
      }

      // Filter out the recurring income to be deleted
      const updatedRecurringIncomes = account.recurringIncomes.filter(
        income => income.id !== recurringIncomeId
      );

      // Update the account with the filtered recurring incomes array
      await updateDoc(accountRef, {
        recurringIncomes: updatedRecurringIncomes,
        updatedAt: Timestamp.now()
      });
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

      const accountRef = doc(db, this.collection, accountId);
      const accountDoc = await getDoc(accountRef);
      const account = accountDoc.data() as Account;

      return account.recurringIncomes || [];
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

      // Get all user accounts
      const accountsQuery = query(
        collection(db, this.collection),
        where('userId', '==', userId)
      );
      const accountsSnapshot = await getDocs(accountsQuery);

      // Find the account containing this recurring income
      let targetAccount: Account | null = null;
      let targetRecurringIncome: RecurringIncome | null = null;

      for (const accountDoc of accountsSnapshot.docs) {
        const account = accountDoc.data() as Account;
        if (account.recurringIncomes) {
          const recurringIncome = account.recurringIncomes.find(ri => ri.id === recurringIncomeId);
          if (recurringIncome) {
            targetAccount = { ...account, id: accountDoc.id };
            targetRecurringIncome = recurringIncome;
            break;
          }
        }
      }

      if (!targetAccount || !targetRecurringIncome) {
        throw new Error('Recurring income not found');
      }

      const batch = writeBatch(db);

      // Create transaction for the recurring income
      const transactionRef = doc(collection(db, 'transactions'));
      const transactionData = {
        userId,
        amount: targetRecurringIncome.amount,
        description: `${targetRecurringIncome.description} (Recurring)`,
        accountId: targetAccount.id,
        categoryId: '', // You might want to create a special income category
        date: serverTimestamp(),
        transactionType: 'income',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(transactionRef, transactionData);

      // Update account balance
      batch.update(doc(db, this.collection, targetAccount.id), {
        balance: increment(targetRecurringIncome.amount),
        updatedAt: serverTimestamp()
      });

      // Calculate and update next recurrence date
      const currentDate = new Date();
      let nextDate = new Date(currentDate);

      switch (targetRecurringIncome.recurrenceType) {
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
          nextDate.setMonth(currentDate.getMonth() + (targetRecurringIncome.recurrenceInterval || 1));
          break;
      }

      // Update the recurring income with new next recurrence date
      const updatedRecurringIncomes = targetAccount.recurringIncomes!.map(income => {
        if (income.id === recurringIncomeId) {
          return {
            ...income,
            nextRecurrenceDate: Timestamp.fromDate(nextDate),
            updatedAt: Timestamp.now()
          };
        }
        return income;
      });

      batch.update(doc(db, this.collection, targetAccount.id), {
        recurringIncomes: updatedRecurringIncomes,
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
      
      // Query for all accounts with due recurring incomes
      const accountsQuery = query(
        collection(db, this.collection),
        where('userId', '==', userId)
      );
      
      const accountsSnapshot = await getDocs(accountsQuery);
      console.log(`Found ${accountsSnapshot.docs.length} accounts to check for due recurring incomes`);
      
      let processed = 0;
      let errors = 0;
      
      // Process each account's recurring incomes
      for (const accountDoc of accountsSnapshot.docs) {
        const account = accountDoc.data() as Account;
        if (!account.recurringIncomes) continue;

        for (const recurringIncome of account.recurringIncomes) {
          if (recurringIncome.nextRecurrenceDate.toDate() <= now) {
            try {
              await this.processRecurringIncome(recurringIncome.id);
              processed++;
              console.log(`Successfully processed recurring income ${recurringIncome.id} for account ${account.id}`);
            } catch (error) {
              console.error(`Error processing recurring income ${recurringIncome.id}:`, error);
              errors++;
            }
          }
        }
      }
      
      return { processed, errors };
    } catch (error) {
      console.error('Error processing due recurring incomes:', error);
      throw error;
    }
  }
} 