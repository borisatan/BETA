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