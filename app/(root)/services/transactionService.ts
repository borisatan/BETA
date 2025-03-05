import { db } from '../firebase/firebaseConfig';
import { collection, addDoc, getDocs, query, where, orderBy, limit as firestoreLimit, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { Transaction } from '../firebase/types';

export class TransactionService {
  private static collection = 'transactions';

  static async createTransaction(transaction: Omit<Transaction, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.collection), {
        ...transaction,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }

  static async getUserTransactions(userId: string): Promise<Transaction[]> {
    try {
      const q = query(
        collection(db, this.collection),
        where('userId', '==', userId),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Transaction));
    } catch (error) {
      console.error('Error fetching user transactions:', error);
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
    try {
      const docRef = doc(db, this.collection, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  }

  static async deleteTransaction(id: string): Promise<void> {
    try {
      const docRef = doc(db, this.collection, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  }
} 