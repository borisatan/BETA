import { db } from '../firebase/firebaseConfig';
import { collection, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { User } from '../firebase/types';
import { auth } from '../firebase/firebaseConfig';

export class UserService {
  private static COLLECTION = 'users';

  static async createUser(userId: string, email: string, displayName: string | null = null, photoURL: string | null = null): Promise<void> {
    const userRef = doc(db, this.COLLECTION, userId);
    const userData: Omit<User, 'id'> = {
      email,
      displayName,
      photoURL,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
      preferences: {
        theme: 'system',
        currency: 'USD',
        language: 'en'
      }
    };

    await setDoc(userRef, userData);
  }

  static async getUser(userId: string): Promise<User | null> {
    const userRef = doc(db, this.COLLECTION, userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() } as User;
    }
    return null;
  }

  static async updateUserPreferences(userId: string, preferences: Partial<User['preferences']>): Promise<void> {
    const userRef = doc(db, this.COLLECTION, userId);
    await updateDoc(userRef, {
      preferences,
      updatedAt: serverTimestamp()
    });
  }

  static async getCurrentUser(): Promise<User | null> {
    const userId = auth.currentUser?.uid;
    if (!userId) return null;
    return this.getUser(userId);
  }
} 