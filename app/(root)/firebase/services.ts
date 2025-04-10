import { db } from './firebaseConfig';
import { 
  collection, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc, 
  query,
  where,
  getDocs,
  serverTimestamp,
  increment,
  Timestamp,
  writeBatch,
  DocumentData
} from 'firebase/firestore';
import { Account, Transaction, Category, Subcategory, Income } from './types';

// Account Services
export const AccountService = {
  async createAccount(userId: string, accountData: Omit<Account, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
    const timestamp = serverTimestamp();
    const docRef = await addDoc(collection(db, 'accounts'), {
      ...accountData,
      userId,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    return docRef.id;
  },

  async getUserAccounts(userId: string) {
    const q = query(collection(db, 'accounts'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Account[];
  },

  async updateAccountBalance(accountId: string, newBalance: number) {
    const docRef = doc(db, 'accounts', accountId);
    await updateDoc(docRef, {
      balance: newBalance,
      updatedAt: serverTimestamp()
    });
  }
};

// Transaction Services
export const TransactionService = {
  async createTransaction(userId: string, transactionData: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
    const timestamp = serverTimestamp();
    
    // Start a batch write
    const batch = writeBatch(db);
    
    // Add transaction
    const transactionRef = doc(collection(db, 'transactions'));
    batch.set(transactionRef, {
      ...transactionData,
      userId,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    
    // Update account balance
    const accountRef = doc(db, 'accounts', transactionData.accountId);
    const amount = transactionData.transactionType === 'expense' ? -transactionData.amount : transactionData.amount;
    batch.update(accountRef, {
      balance: increment(amount),
      updatedAt: timestamp
    });
    
    await batch.commit();
    return transactionRef.id;
  },

  async getUserTransactions(userId: string) {
    const q = query(collection(db, 'transactions'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[];
  },

  async getRecentTransactions(userId: string, limit: number = 5) {
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', userId),
      // Note: We'll need to add a composite index for this query
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Transaction))
      .sort((a, b) => b.date.toMillis() - a.date.toMillis())
      .slice(0, limit);
  }
};

// Category Services
export const CategoryService = {
  async createCategory(userId: string, categoryData: Omit<Category, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
    const timestamp = serverTimestamp();
    const docRef = await addDoc(collection(db, 'categories'), {
      ...categoryData,
      userId,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    return docRef.id;
  },

  async getUserCategories(userId: string) {
    console.log("[CategoryService] Fetching categories for user:", userId);
    try {
      const q = query(collection(db, 'categories'), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      const categories = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Category[];
      
      console.log("[CategoryService] Successfully fetched categories:", categories.length);
      return categories;
    } catch (error) {
      console.error("[CategoryService] Error fetching categories:", error);
      throw error;
    }
  }
};

// Income Services
export const IncomeService = {
  async createIncome(userId: string, incomeData: Omit<Income, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
    const timestamp = serverTimestamp();
    
    // Start a batch write
    const batch = writeBatch(db);
    
    // Add income
    const incomeRef = doc(collection(db, 'income'));
    batch.set(incomeRef, {
      ...incomeData,
      userId,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    
    // Update account balance
    const accountRef = doc(db, 'accounts', incomeData.accountId);
    batch.update(accountRef, {
      balance: increment(incomeData.amount),
      updatedAt: timestamp
    });
    
    await batch.commit();
    return incomeRef.id;
  },

  async getUserIncome(userId: string) {
    const q = query(collection(db, 'income'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Income[];
  }
}; 