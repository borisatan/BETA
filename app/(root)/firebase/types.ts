import { Timestamp } from 'firebase/firestore';

// Base types for timestamps
interface Timestamps {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Account extends Timestamps {
  id: string;
  userId: string;
  name: string;
  balance: number;
  type: 'Checking' | 'Savings' | 'Cash' | 'Card';
  currency: string;
  recurringIncomes?: RecurringIncome[];
}

export interface Transaction extends Timestamps {
  id: string;
  userId: string;
  amount: number;
  date: Timestamp;
  description: string;
  accountId: string;
  categoryId: string;
  subcategoryId: string;
  transactionType: 'expense' | 'income' | 'transfer';
  paymentMethod: string;
  notes?: string;
}

export interface Category extends Timestamps {
  id: string;
  userId: string;
  name: string;
  description: string;
}

export interface Subcategory extends Timestamps {
  id: string;
  userId: string;
  name: string;
  categoryId: string;
}

export interface Income extends Timestamps {
  id: string;
  userId: string;
  amount: number;
  source: string;
  dateReceived: Timestamp;
  accountId: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    currency: string;
    language: string;
  };
}

export interface RecurringIncome extends Timestamps {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  description: string;
  recurrenceType: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  recurrenceInterval: number;
  nextRecurrenceDate: Timestamp;
} 