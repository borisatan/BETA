import { db } from '../firebase/firebaseConfig';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { Account } from '../firebase/types';
import { auth } from '../firebase/firebaseConfig';

export class AccountService {
  private static collection = 'accounts';

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
} 