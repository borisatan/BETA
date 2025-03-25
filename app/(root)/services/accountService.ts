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

      // Create recurring income document
      const recurringIncomeRef = await addDoc(collection(db, this.recurringIncomeCollection), {
        ...recurringIncome,
        userId,
        accountId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Add recurring income reference to account
      const accountRef = doc(db, this.collection, accountId);
      await updateDoc(accountRef, {
        recurringIncomes: arrayUnion({
          id: recurringIncomeRef.id,
          ...recurringIncome,
          userId,
          accountId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        })
      });

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
} 