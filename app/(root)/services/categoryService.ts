import { db } from '../firebase/firebaseConfig';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where, getDoc, writeBatch } from 'firebase/firestore';
import { auth } from '../firebase/firebaseConfig';

export interface Category {
  id: string;
  userId: string;
  name: string;
  mainCategory: string;
  icon: string;
  createdAt: Date;
  updatedAt: Date;
  order?: number;
}

export interface MainCategory {
  id: string;
  userId: string;
  name: string;
  icon: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const defaultCategories = [
  // Needs
  { name: 'Groceries', mainCategory: 'Needs' as const, icon: 'shopping-cart' },
  { name: 'Rent', mainCategory: 'Needs' as const, icon: 'home' },
  { name: 'Utilities', mainCategory: 'Needs' as const, icon: 'power-settings-new' },
  { name: 'Transport', mainCategory: 'Needs' as const, icon: 'directions-car' },
  { name: 'Healthcare', mainCategory: 'Needs' as const, icon: 'local-hospital' },
  
  // Wants
  { name: 'Entertainment', mainCategory: 'Wants' as const, icon: 'movie' },
  { name: 'Shopping', mainCategory: 'Wants' as const, icon: 'shopping-bag' },
  { name: 'Dining', mainCategory: 'Wants' as const, icon: 'restaurant' },
  { name: 'Travel', mainCategory: 'Wants' as const, icon: 'flight' },
  { name: 'Hobbies', mainCategory: 'Wants' as const, icon: 'sports-esports' },
  
  // Savings
  { name: 'Emergency Fund', mainCategory: 'Savings' as const, icon: 'account-balance' },
  { name: 'Investments', mainCategory: 'Savings' as const, icon: 'trending-up' },
  { name: 'Retirement', mainCategory: 'Savings' as const, icon: 'account-balance' },
  { name: 'Goals', mainCategory: 'Savings' as const, icon: 'flag' },
  { name: 'Education', mainCategory: 'Savings' as const, icon: 'school' }
];

const defaultMainCategories = [
  { name: 'Needs', icon: 'priority-high', order: 0 },
  { name: 'Wants', icon: 'favorite', order: 1 },
  { name: 'Savings', icon: 'account-balance', order: 2 }
];

export class CategoryService {
  static async getUserMainCategories(userId: string): Promise<MainCategory[]> {
    try {
      const mainCategoriesRef = collection(db, 'mainCategories');
      const q = query(mainCategoriesRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      const mainCategories = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate()
      })) as MainCategory[];

      if (mainCategories.length === 0) {
        const defaultMainCategoriesWithUserId = defaultMainCategories.map(category => ({
          ...category,
          userId,
          createdAt: new Date(),
          updatedAt: new Date()
        }));

        const batch = writeBatch(db);
        const createdMainCategories = [];

        for (const category of defaultMainCategoriesWithUserId) {
          const docRef = doc(collection(db, 'mainCategories'));
          batch.set(docRef, category);
          createdMainCategories.push({
            id: docRef.id,
            ...category,
            createdAt: category.createdAt,
            updatedAt: category.updatedAt
          });
        }

        await batch.commit();
        return createdMainCategories;
      }

      return mainCategories.sort((a, b) => a.order - b.order);
    } catch (error) {
      console.error('Error fetching main categories:', error);
      throw error;
    }
  }

  static async createMainCategory(mainCategory: Omit<MainCategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');

      if (!mainCategory.name.trim()) {
        throw new Error('Main category name cannot be empty');
      }

      const existingMainCategories = await this.getUserMainCategories(userId);
      const duplicateMainCategory = existingMainCategories.find(
        cat => cat.name.toLowerCase() === mainCategory.name.toLowerCase()
      );
      if (duplicateMainCategory) {
        throw new Error('A main category with this name already exists');
      }

      const mainCategoriesRef = collection(db, 'mainCategories');
      const newMainCategory = {
        ...mainCategory,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(mainCategoriesRef, newMainCategory);
      return docRef.id;
    } catch (error) {
      console.error('Error creating main category:', error);
      throw error;
    }
  }

  static async updateMainCategory(mainCategoryId: string, updates: Partial<MainCategory>): Promise<void> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');

      if (updates.name && !updates.name.trim()) {
        throw new Error('Main category name cannot be empty');
      }

      if (updates.name) {
        const existingMainCategories = await this.getUserMainCategories(userId);
        const duplicateMainCategory = existingMainCategories.find(
          cat => cat.id !== mainCategoryId && 
                cat.name.toLowerCase() === updates.name?.toLowerCase()
        );
        if (duplicateMainCategory) {
          throw new Error('A main category with this name already exists');
        }
      }

      const mainCategoryRef = doc(db, 'mainCategories', mainCategoryId);
      await updateDoc(mainCategoryRef, {
        ...updates,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating main category:', error);
      throw error;
    }
  }

  static async deleteMainCategory(mainCategoryId: string): Promise<void> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');

      const mainCategory = await this.getMainCategory(mainCategoryId);
      if (!mainCategory) {
        throw new Error('Main category not found');
      }
      if (mainCategory.userId !== userId) {
        throw new Error('You do not have permission to delete this main category');
      }

      // Check if there are any categories using this main category
      const categories = await this.getUserCategories(userId);
      const categoriesUsingMainCategory = categories.filter(
        cat => cat.mainCategory === mainCategory.name
      );
      if (categoriesUsingMainCategory.length > 0) {
        throw new Error('Cannot delete main category that has subcategories');
      }

      const mainCategoryRef = doc(db, 'mainCategories', mainCategoryId);
      await deleteDoc(mainCategoryRef);
    } catch (error) {
      console.error('Error deleting main category:', error);
      throw error;
    }
  }

  static async getMainCategory(mainCategoryId: string): Promise<MainCategory | null> {
    try {
      const mainCategoryRef = doc(db, 'mainCategories', mainCategoryId);
      const mainCategoryDoc = await getDoc(mainCategoryRef);
      
      if (!mainCategoryDoc.exists()) return null;

      return {
        id: mainCategoryDoc.id,
        ...mainCategoryDoc.data(),
        createdAt: mainCategoryDoc.data().createdAt.toDate(),
        updatedAt: mainCategoryDoc.data().updatedAt.toDate()
      } as MainCategory;
    } catch (error) {
      console.error('Error fetching main category:', error);
      throw error;
    }
  }

  static async getUserCategories(userId: string): Promise<Category[]> {
    try {
      const categoriesRef = collection(db, 'categories');
      const q = query(categoriesRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      const categories = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate()
      })) as Category[];

      // If user has no categories, create default ones
      if (categories.length === 0) {
        const defaultCategoriesWithUserId = defaultCategories.map(category => ({
          ...category,
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
          order: 0 // Default order for initial categories
        }));

        const batch = writeBatch(db);
        const createdCategories = [];

        for (const category of defaultCategoriesWithUserId) {
          const docRef = doc(collection(db, 'categories'));
          batch.set(docRef, category);
          createdCategories.push({
            id: docRef.id,
            ...category,
            createdAt: category.createdAt,
            updatedAt: category.updatedAt
          });
        }

        await batch.commit();
        return createdCategories;
      }

      // Sort categories by order and then by creation date
      return categories.sort((a, b) => {
        if (a.order !== b.order) return (a.order || 0) - (b.order || 0);
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  }

  static async createCategory(category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');

      if (!category.name.trim()) {
        throw new Error('Category name cannot be empty');
      }

      const existingCategories = await this.getUserCategories(userId);
      const duplicateCategory = existingCategories.find(
        cat => cat.name.toLowerCase() === category.name.toLowerCase()
      );
      if (duplicateCategory) {
        throw new Error('A category with this name already exists');
      }

      // Get the highest order number and add 1
      const maxOrder = Math.max(...existingCategories.map(cat => cat.order || 0), 0);
      const newOrder = maxOrder + 1;

      const categoriesRef = collection(db, 'categories');
      const newCategory = {
        ...category,
        userId,
        order: newOrder,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(categoriesRef, newCategory);
      return docRef.id;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  static async updateCategory(categoryId: string, updates: Partial<Category>): Promise<void> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');

      // Validate category name if it's being updated
      if (updates.name && !updates.name.trim()) {
        throw new Error('Category name cannot be empty');
      }

      // Check for duplicate names if name is being updated
      if (updates.name) {
        const existingCategories = await this.getUserCategories(userId);
        const duplicateCategory = existingCategories.find(
          cat => cat.id !== categoryId && 
                cat.name.toLowerCase() === updates.name?.toLowerCase()
        );
        if (duplicateCategory) {
          throw new Error('A category with this name already exists');
        }
      }

      const categoryRef = doc(db, 'categories', categoryId);
      await updateDoc(categoryRef, {
        ...updates,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  static async deleteCategory(categoryId: string): Promise<void> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');

      // Check if category exists and belongs to user
      const category = await this.getCategory(categoryId);
      if (!category) {
        throw new Error('Category not found');
      }
      if (category.userId !== userId) {
        throw new Error('You do not have permission to delete this category');
      }

      const categoryRef = doc(db, 'categories', categoryId);
      await deleteDoc(categoryRef);
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  static async getCategory(categoryId: string): Promise<Category | null> {
    try {
      const categoryRef = doc(db, 'categories', categoryId);
      const categoryDoc = await getDoc(categoryRef);
      
      if (!categoryDoc.exists()) return null;

      return {
        id: categoryDoc.id,
        ...categoryDoc.data(),
        createdAt: categoryDoc.data().createdAt.toDate(),
        updatedAt: categoryDoc.data().updatedAt.toDate()
      } as Category;
    } catch (error) {
      console.error('Error fetching category:', error);
      throw error;
    }
  }
} 