import { db } from '../firebase/firebaseConfig';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where, getDoc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth } from '../firebase/firebaseConfig';
import { Category, Subcategory } from '../firebase/types';

const defaultCategories = [
  { name: 'Needs', icon: 'priority-high', order: 0 },
  { name: 'Wants', icon: 'favorite', order: 1 },
  { name: 'Savings', icon: 'account-balance', order: 2 }
];

const defaultSubcategories = [
  // Needs subcategories
  { name: 'Groceries', categoryId: '', icon: 'shopping-cart', order: 0 },
  { name: 'Rent', categoryId: '', icon: 'home', order: 1 },
  { name: 'Utilities', categoryId: '', icon: 'power-settings-new', order: 2 },
  { name: 'Transport', categoryId: '', icon: 'directions-car', order: 3 },
  { name: 'Healthcare', categoryId: '', icon: 'local-hospital', order: 4 },
  
  // Wants subcategories
  { name: 'Entertainment', categoryId: '', icon: 'movie', order: 0 },
  { name: 'Shopping', categoryId: '', icon: 'shopping-bag', order: 1 },
  { name: 'Dining', categoryId: '', icon: 'restaurant', order: 2 },
  { name: 'Travel', categoryId: '', icon: 'flight', order: 3 },
  { name: 'Hobbies', categoryId: '', icon: 'sports-esports', order: 4 },
  
  // Savings subcategories
  { name: 'Emergency Fund', categoryId: '', icon: 'account-balance', order: 0 },
  { name: 'Investments', categoryId: '', icon: 'trending-up', order: 1 },
  { name: 'Retirement', categoryId: '', icon: 'account-balance', order: 2 },
  { name: 'Goals', categoryId: '', icon: 'flag', order: 3 },
  { name: 'Education', categoryId: '', icon: 'school', order: 4 }
];

export class CategoryService {
  static async getUserCategories(userId: string): Promise<Category[]> {
    try {
      const categoriesRef = collection(db, 'categories');
      const q = query(categoriesRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      const categories = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt as Timestamp,
        updatedAt: doc.data().updatedAt as Timestamp
      })) as Category[];

      if (categories.length === 0) {
        const defaultCategoriesWithUserId = defaultCategories.map(category => ({
          ...category,
          userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }));

        const batch = writeBatch(db);
        const createdCategories: Category[] = [];

        for (const category of defaultCategoriesWithUserId) {
          const docRef = doc(collection(db, 'categories'));
          batch.set(docRef, category);
          // We'll fetch these categories after the batch commit to get the actual timestamps
          createdCategories.push({
            id: docRef.id,
            ...category,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          } as Category);
        }

        await batch.commit();
        
        // Fetch the newly created categories to get the actual server timestamps
        const newCategoriesRef = collection(db, 'categories');
        const newQ = query(newCategoriesRef, where('userId', '==', userId));
        const newQuerySnapshot = await getDocs(newQ);
        
        return newQuerySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt as Timestamp,
          updatedAt: doc.data().updatedAt as Timestamp
        })) as Category[];
      }

      return categories.sort((a, b) => a.order - b.order);
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  }

  static async createCategory(category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'categories'), {
        ...category,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  static async updateCategory(categoryId: string, updates: Partial<Category>): Promise<void> {
    try {
      const categoryRef = doc(db, 'categories', categoryId);
      await updateDoc(categoryRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  static async deleteCategory(categoryId: string): Promise<void> {
    try {
      // First, delete all subcategories under this category
      const subcategories = await this.getSubcategoriesByCategory(categoryId);
      const batch = writeBatch(db);

      for (const subcategory of subcategories) {
        batch.delete(doc(db, 'subcategories', subcategory.id));
      }

      // Then delete the category
      batch.delete(doc(db, 'categories', categoryId));
      await batch.commit();
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  static async getCategory(categoryId: string): Promise<Category | null> {
    try {
      const categoryRef = doc(db, 'categories', categoryId);
      const categoryDoc = await getDoc(categoryRef);
      
      if (categoryDoc.exists()) {
        return {
          id: categoryDoc.id,
          ...categoryDoc.data(),
          createdAt: categoryDoc.data().createdAt as Timestamp,
          updatedAt: categoryDoc.data().updatedAt as Timestamp
        } as Category;
      }
      return null;
    } catch (error) {
      console.error('Error fetching category:', error);
      throw error;
    }
  }

  // Subcategory methods
  static async getUserSubcategories(userId: string): Promise<Subcategory[]> {
    try {
      const subcategoriesRef = collection(db, 'subcategories');
      const q = query(subcategoriesRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      const subcategories = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt as Timestamp,
        updatedAt: doc.data().updatedAt as Timestamp
      })) as Subcategory[];

      if (subcategories.length === 0) {
        // Get or create default categories first
        const categories = await this.getUserCategories(userId);
        const needsCategory = categories.find(c => c.name === 'Needs');
        const wantsCategory = categories.find(c => c.name === 'Wants');
        const savingsCategory = categories.find(c => c.name === 'Savings');

        if (!needsCategory || !wantsCategory || !savingsCategory) {
          throw new Error('Default categories not found');
        }

        const defaultSubcategoriesWithIds = defaultSubcategories.map(subcategory => {
          let categoryId = '';
          if (subcategory.name === 'Groceries' || subcategory.name === 'Rent' || 
              subcategory.name === 'Utilities' || subcategory.name === 'Transport' || 
              subcategory.name === 'Healthcare') {
            categoryId = needsCategory.id;
          } else if (subcategory.name === 'Entertainment' || subcategory.name === 'Shopping' || 
                    subcategory.name === 'Dining' || subcategory.name === 'Travel' || 
                    subcategory.name === 'Hobbies') {
            categoryId = wantsCategory.id;
          } else {
            categoryId = savingsCategory.id;
          }

          return {
            ...subcategory,
            categoryId,
            userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
        });

        const batch = writeBatch(db);
        const createdSubcategories: Subcategory[] = [];

        for (const subcategory of defaultSubcategoriesWithIds) {
          const docRef = doc(collection(db, 'subcategories'));
          batch.set(docRef, subcategory);
          // We'll fetch these subcategories after the batch commit to get the actual timestamps
          createdSubcategories.push({
            id: docRef.id,
            ...subcategory,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          } as Subcategory);
        }

        await batch.commit();
        
        // Fetch the newly created subcategories to get the actual server timestamps
        const newSubcategoriesRef = collection(db, 'subcategories');
        const newQ = query(newSubcategoriesRef, where('userId', '==', userId));
        const newQuerySnapshot = await getDocs(newQ);
        
        return newQuerySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt as Timestamp,
          updatedAt: doc.data().updatedAt as Timestamp
        })) as Subcategory[];
      }

      return subcategories;
    } catch (error) {
      console.error('Error fetching subcategories:', error);
      throw error;
    }
  }

  static async getSubcategoriesByCategory(categoryId: string): Promise<Subcategory[]> {
    try {
      const subcategoriesRef = collection(db, 'subcategories');
      const q = query(subcategoriesRef, where('categoryId', '==', categoryId));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt as Timestamp,
        updatedAt: doc.data().updatedAt as Timestamp
      })) as Subcategory[];
    } catch (error) {
      console.error('Error fetching subcategories by category:', error);
      throw error;
    }
  }

  static async createSubcategory(subcategory: Omit<Subcategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'subcategories'), {
        ...subcategory,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating subcategory:', error);
      throw error;
    }
  }

  static async updateSubcategory(subcategoryId: string, updates: Partial<Subcategory>): Promise<void> {
    try {
      const subcategoryRef = doc(db, 'subcategories', subcategoryId);
      await updateDoc(subcategoryRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating subcategory:', error);
      throw error;
    }
  }

  static async deleteSubcategory(subcategoryId: string): Promise<void> {
    try {
      const subcategoryRef = doc(db, 'subcategories', subcategoryId);
      await deleteDoc(subcategoryRef);
    } catch (error) {
      console.error('Error deleting subcategory:', error);
      throw error;
    }
  }

  static async getSubcategory(subcategoryId: string): Promise<Subcategory | null> {
    try {
      const subcategoryRef = doc(db, 'subcategories', subcategoryId);
      const subcategoryDoc = await getDoc(subcategoryRef);
      
      if (subcategoryDoc.exists()) {
        return {
          id: subcategoryDoc.id,
          ...subcategoryDoc.data(),
          createdAt: subcategoryDoc.data().createdAt as Timestamp,
          updatedAt: subcategoryDoc.data().updatedAt as Timestamp
        } as Subcategory;
      }
      return null;
    } catch (error) {
      console.error('Error fetching subcategory:', error);
      throw error;
    }
  }
} 