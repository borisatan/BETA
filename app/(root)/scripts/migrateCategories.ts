import { db } from '../firebase/firebaseConfig';
import { collection, getDocs, doc, updateDoc, writeBatch, deleteDoc, query, where } from 'firebase/firestore';
import { Category, MainCategory } from '../firebase/types';
import { auth } from '../firebase/firebaseConfig';

export async function migrateCategories() {
  console.log('Starting category migration...');
  
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, error: new Error('User not authenticated') };
    }
    
    const userId = currentUser.uid;
    
    // Step 1: Convert categories
    await migrateCategoryCollection('categories', userId);
    
    // Step 2: Convert main categories
    await migrateCategoryCollection('mainCategories', userId);
    
    console.log('Category migration completed successfully!');
    return { success: true };
  } catch (error) {
    console.error('Error during category migration:', error);
    return { success: false, error };
  }
}

async function migrateCategoryCollection(collectionName: string, userId: string) {
  console.log(`Processing collection: ${collectionName} for user: ${userId}...`);
  
  // Get all documents in the collection that belong to the current user
  const q = query(collection(db, collectionName), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    console.log(`No documents found in ${collectionName} collection for this user.`);
    return;
  }
  
  console.log(`Found ${snapshot.docs.length} documents to migrate.`);
  
  // Create a map to group categories by name and icon
  const categoryGroups = new Map<string, any[]>();
  
  // Group categories by name and icon
  snapshot.docs.forEach(docSnapshot => {
    const data = docSnapshot.data();
    // Skip documents that already use the new schema
    if (data.userIds) {
      console.log(`Document ${docSnapshot.id} already using new schema, skipping.`);
      return;
    }
    
    const key = `${data.name}_${data.icon}`;
    if (!categoryGroups.has(key)) {
      categoryGroups.set(key, []);
    }
    categoryGroups.get(key)?.push({
      id: docSnapshot.id,
      ...data
    });
  });
  
  console.log(`Grouped into ${categoryGroups.size} unique categories.`);
  
  // Process each group of categories
  for (const [key, categories] of categoryGroups.entries()) {
    // Skip groups with just one category (no duplicates)
    if (categories.length === 1) {
      // Convert single category to use userIds array
      const category = categories[0];
      const docRef = doc(db, collectionName, category.id);
      
      const updateData = {
        userIds: [userId],
      };
      
      // Remove the userId field
      await updateDoc(docRef, {
        ...updateData,
        userId: null // Set to null to be cleaned up later
      });
      
      console.log(`Converted single category: ${category.name} (${category.id})`);
      continue;
    }
    
    // For groups with multiple categories, merge them
    if (categories.length > 1) {
      const batch = writeBatch(db);
      
      // Keep the first category and update it to include all userIds
      const primaryCategory = categories[0];
      const docRef = doc(db, collectionName, primaryCategory.id);
      
      // Update the primary category with the merged userIds
      batch.update(docRef, {
        userIds: [userId],
        userId: null // Set to null to be cleaned up later
      });
      
      // Delete all other duplicate categories
      for (let i = 1; i < categories.length; i++) {
        const duplicateDocRef = doc(db, collectionName, categories[i].id);
        batch.delete(duplicateDocRef);
        console.log(`Marked duplicate category for deletion: ${categories[i].name} (${categories[i].id})`);
      }
      
      await batch.commit();
      console.log(`Merged ${categories.length} duplicate categories for: ${primaryCategory.name}`);
    }
  }
  
  console.log(`Migration completed for ${collectionName} collection.`);
}

// For one-time cleanup of leftover userId fields
export async function cleanupCategoryMigration() {
  console.log('Starting cleanup of migrated categories...');
  
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, error: new Error('User not authenticated') };
    }
    
    const userId = currentUser.uid;
    
    // Clean up categories
    await cleanupCollection('categories', userId);
    
    // Clean up main categories
    await cleanupCollection('mainCategories', userId);
    
    console.log('Category cleanup completed successfully!');
    return { success: true };
  } catch (error) {
    console.error('Error during category cleanup:', error);
    return { success: false, error };
  }
}

async function cleanupCollection(collectionName: string, userId: string) {
  console.log(`Cleaning up collection: ${collectionName} for user: ${userId}...`);
  
  // Get all documents in the collection that have userIds containing the current user
  const q = query(collection(db, collectionName), where('userIds', 'array-contains', userId));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    console.log(`No documents found in ${collectionName} collection for this user.`);
    return;
  }
  
  console.log(`Found ${snapshot.docs.length} documents to check.`);
  
  // Process in batches to avoid hitting Firestore limits
  const batch = writeBatch(db);
  let batchCount = 0;
  
  for (const docSnapshot of snapshot.docs) {
    const data = docSnapshot.data();
    
    // Check if this document has both userId and userIds fields
    if (data.userId !== null && data.userId !== undefined && data.userIds) {
      batch.update(docSnapshot.ref, {
        userId: null // Remove the userId field
      });
      
      batchCount++;
      console.log(`Scheduled cleanup for document: ${docSnapshot.id}`);
      
      // Commit the batch every 500 operations to stay within Firestore limits
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`Committed batch of ${batchCount} cleanup operations.`);
        batchCount = 0;
      }
    }
  }
  
  // Commit any remaining operations
  if (batchCount > 0) {
    await batch.commit();
    console.log(`Committed final batch of ${batchCount} cleanup operations.`);
  }
  
  console.log(`Cleanup completed for ${collectionName} collection.`);
} 