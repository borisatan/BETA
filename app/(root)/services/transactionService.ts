import { db } from '../firebase/firebaseConfig';
import { collection, addDoc, getDocs, query, where, orderBy, limit as firestoreLimit, doc, updateDoc, deleteDoc, Timestamp, increment, serverTimestamp, writeBatch, getDoc } from 'firebase/firestore';
import { Transaction } from '../firebase/types';
import { AccountService } from './accountService';
import { auth } from '../firebase/firebaseConfig';
import { DailyAggregationService } from './dailyAggregationService';

export class TransactionService {
  private static collection = 'transactions';

  static async createTransaction(transaction: Omit<Transaction, 'id'>): Promise<void> {
    const transactionRef = await addDoc(collection(db, this.collection), {
      ...transaction,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Update account balance based on transaction type
    const accountRef = doc(db, 'accounts', transaction.accountId);
    const amount = transaction.transactionType === 'expense' ? -transaction.amount : transaction.amount;
    
    await updateDoc(accountRef, { 
      balance: increment(amount),
      updatedAt: serverTimestamp()
    });

    // Update daily aggregation
    await DailyAggregationService.updateDailyAggregation({
      id: transactionRef.id,
      ...transaction,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  }

  static async getUserTransactions(userId: string): Promise<Transaction[]> {
    const q = query(
      collection(db, this.collection),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Transaction[];
  }

  // New method to fetch transactions by date range
  static async getTransactionsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Transaction[]> {
    try {
      // Create query with date range filters
      const q = query(
        collection(db, this.collection),
        where('userId', '==', userId),
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate)),
        orderBy('date', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
    } catch (error) {
      console.error('Error fetching transactions by date range:', error);
      throw error;
    }
  }

  static async getAccountTransactions(accountId: string): Promise<Transaction[]> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const q = query(
        collection(db, this.collection),
        where('accountId', '==', accountId),
        where('userId', '==', userId),
        orderBy('date', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
    } catch (error) {
      console.error('Error fetching account transactions:', error);
      throw error;
    }
  }

  static async getRecentTransactions(userId: string, limitCount: number = 5): Promise<Transaction[]> {
    try {
      const q = query(
        collection(db, this.collection),
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        firestoreLimit(limitCount)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Transaction));
    } catch (error) {
      console.error('Error fetching recent transactions:', error);
      throw error;
    }
  }

  static async updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
    const docRef = doc(db, this.collection, id);
    const currentDoc = await getDoc(docRef);
    
    if (!currentDoc.exists()) {
      throw new Error('Transaction not found');
    }

    const currentData = currentDoc.data() as Transaction;
    const batch = writeBatch(db);

    // Update transaction
    batch.update(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    // If amount or type changed, update account balance
    if (updates.amount || updates.transactionType) {
      const oldAmount = currentData.transactionType === 'expense' ? -currentData.amount : currentData.amount;
      const newAmount = updates.transactionType === 'expense' ? -updates.amount! : updates.amount!;
      const difference = newAmount - oldAmount;

      const accountRef = doc(db, 'accounts', currentData.accountId);
      batch.update(accountRef, {
        balance: increment(difference),
        updatedAt: serverTimestamp()
      });
    }

    await batch.commit();

    // Rebuild daily aggregations for the affected date
    if (updates.date || updates.amount || updates.transactionType || updates.categoryId) {
      const userId = auth.currentUser?.uid;
      if (userId) {
        await DailyAggregationService.rebuildAggregations(userId);
      }
    }
  }

  static async deleteTransaction(id: string): Promise<void> {
    const docRef = doc(db, this.collection, id);
    const currentDoc = await getDoc(docRef);
    
    if (!currentDoc.exists()) {
      throw new Error('Transaction not found');
    }

    const currentData = currentDoc.data() as Transaction;
    const batch = writeBatch(db);

    // Delete transaction
    batch.delete(docRef);

    // Update account balance
    const accountRef = doc(db, 'accounts', currentData.accountId);
    const amount = currentData.transactionType === 'expense' ? currentData.amount : -currentData.amount;
    batch.update(accountRef, {
      balance: increment(amount),
      updatedAt: serverTimestamp()
    });

    await batch.commit();

    // Rebuild daily aggregations for the affected date
    const userId = auth.currentUser?.uid;
    if (userId) {
      await DailyAggregationService.rebuildAggregations(userId);
    }
  }
} 