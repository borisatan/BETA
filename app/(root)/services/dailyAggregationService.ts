import { db } from '../firebase/firebaseConfig';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  Timestamp, 
  writeBatch,
  orderBy,
  limit,
  startAt,
  endAt
} from 'firebase/firestore';
import { DailyAggregation, Transaction } from '../firebase/types';
import { auth } from '../firebase/firebaseConfig';
import { TransactionService } from './transactionService';

export class DailyAggregationService {
  private static collection = 'dailyAggregations';

  /**
   * Updates the daily aggregation for a specific date and category
   */
  static async updateDailyAggregation(transaction: Transaction): Promise<void> {
    const userId = transaction.userId;
    const date = transaction.date;
    const categoryId = transaction.categoryId;
    const accountId = transaction.accountId;
    const amount = transaction.amount;
    const isIncome = transaction.transactionType === 'income';

    // Get the start of the day for the transaction date
    const startOfDay = new Date(date.toDate());
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    // Create batch for atomic updates
    const batch = writeBatch(db);

    // Update total aggregation (no category)
    const totalDocRef = doc(collection(db, this.collection));
    const totalDoc = await getDoc(totalDocRef);
    
    if (!totalDoc.exists()) {
      batch.set(totalDocRef, {
        userId,
        date: Timestamp.fromDate(startOfDay),
        totalIncome: isIncome ? amount : 0,
        totalExpenses: isIncome ? 0 : amount,
        netFlow: isIncome ? amount : -amount,
        transactionCount: 1,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    } else {
      const data = totalDoc.data();
      batch.update(totalDocRef, {
        totalIncome: isIncome ? data.totalIncome + amount : data.totalIncome,
        totalExpenses: isIncome ? data.totalExpenses : data.totalExpenses + amount,
        netFlow: isIncome ? data.netFlow + amount : data.netFlow - amount,
        transactionCount: data.transactionCount + 1,
        updatedAt: Timestamp.now()
      });
    }

    // Update category-specific aggregation
    if (categoryId) {
      const categoryDocRef = doc(collection(db, this.collection));
      const categoryDoc = await getDoc(categoryDocRef);
      
      if (!categoryDoc.exists()) {
        batch.set(categoryDocRef, {
          userId,
          date: Timestamp.fromDate(startOfDay),
          categoryId,
          totalIncome: isIncome ? amount : 0,
          totalExpenses: isIncome ? 0 : amount,
          netFlow: isIncome ? amount : -amount,
          transactionCount: 1,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      } else {
        const data = categoryDoc.data();
        batch.update(categoryDocRef, {
          totalIncome: isIncome ? data.totalIncome + amount : data.totalIncome,
          totalExpenses: isIncome ? data.totalExpenses : data.totalExpenses + amount,
          netFlow: isIncome ? data.netFlow + amount : data.netFlow - amount,
          transactionCount: data.transactionCount + 1,
          updatedAt: Timestamp.now()
        });
      }
    }

    await batch.commit();
  }

  /**
   * Gets daily aggregations for a date range
   */
  static async getDailyAggregations(
    userId: string,
    startDate: Date,
    endDate: Date,
    categoryId?: string
  ): Promise<DailyAggregation[]> {
    const q = query(
      collection(db, this.collection),
      where('userId', '==', userId),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      ...(categoryId ? [where('categoryId', '==', categoryId)] : []),
      orderBy('date', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as DailyAggregation[];
  }

  /**
   * Rebuilds all daily aggregations from transactions
   */
  static async rebuildAggregations(userId: string): Promise<void> {
    const batch = writeBatch(db);
    const transactions = await TransactionService.getUserTransactions(userId);
    
    // Clear existing aggregations
    const existingAggregations = await getDocs(collection(db, this.collection));
    existingAggregations.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Group transactions by date
    const transactionsByDate = transactions.reduce((acc: { [key: string]: Transaction[] }, transaction) => {
      const date = transaction.date.toDate();
      const dateKey = date.toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(transaction);
      return acc;
    }, {});

    // Create new aggregations
    for (const [dateStr, dateTransactions] of Object.entries(transactionsByDate)) {
      const date = new Date(dateStr);
      
      // Calculate totals
      const totals = dateTransactions.reduce((acc: { totalIncome: number; totalExpenses: number; netFlow: number; transactionCount: number }, t) => {
        const isIncome = t.transactionType === 'income';
        acc.totalIncome += isIncome ? t.amount : 0;
        acc.totalExpenses += isIncome ? 0 : t.amount;
        acc.netFlow += isIncome ? t.amount : -t.amount;
        acc.transactionCount++;
        return acc;
      }, { totalIncome: 0, totalExpenses: 0, netFlow: 0, transactionCount: 0 });

      // Create total aggregation
      const totalDocRef = doc(collection(db, this.collection));
      batch.set(totalDocRef, {
        userId,
        date: Timestamp.fromDate(date),
        ...totals,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Create category-specific aggregations
      const transactionsByCategory = dateTransactions.reduce((acc: { [key: string]: Transaction[] }, t) => {
        if (!acc[t.categoryId]) {
          acc[t.categoryId] = [];
        }
        acc[t.categoryId].push(t);
        return acc;
      }, {});

      for (const [catId, catTransactions] of Object.entries(transactionsByCategory)) {
        const catTotals = catTransactions.reduce((acc: { totalIncome: number; totalExpenses: number; netFlow: number; transactionCount: number }, t) => {
          const isIncome = t.transactionType === 'income';
          acc.totalIncome += isIncome ? t.amount : 0;
          acc.totalExpenses += isIncome ? 0 : t.amount;
          acc.netFlow += isIncome ? t.amount : -t.amount;
          acc.transactionCount++;
          return acc;
        }, { totalIncome: 0, totalExpenses: 0, netFlow: 0, transactionCount: 0 });

        const catDocRef = doc(collection(db, this.collection));
        batch.set(catDocRef, {
          userId,
          date: Timestamp.fromDate(date),
          categoryId: catId,
          ...catTotals,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }
    }

    await batch.commit();
  }
} 