import { db } from '../firebase/firebaseConfig';
import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { auth } from '../firebase/firebaseConfig';

export async function fixTransactionCategories() {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.error('No user logged in');
      return;
    }

    console.log('Starting to fix transaction categories...');

    // Get all main categories first
    const mainCategoriesRef = collection(db, 'mainCategories');
    const mainCategoriesQuery = query(mainCategoriesRef, where('userId', '==', userId));
    const mainCategoriesSnapshot = await getDocs(mainCategoriesQuery);
    
    // Create a map of main category names to their IDs
    const mainCategoryMap = new Map();

    console.log('Processing main categories:');
    mainCategoriesSnapshot.forEach(doc => {
      const mainCategory = doc.data();
      console.log(`- Main Category: ${mainCategory.name} (ID: ${doc.id})`);
      mainCategoryMap.set(mainCategory.name, doc.id);
    });

    // Get all categories
    const categoriesRef = collection(db, 'categories');
    const categoriesQuery = query(categoriesRef, where('userId', '==', userId));
    const categoriesSnapshot = await getDocs(categoriesQuery);
    
    // Create a map of category IDs to their data
    const categoryMap = new Map();
    // Create a map of category names to their IDs
    const categoryNameToIdMap = new Map();

    console.log('\nProcessing categories:');
    categoriesSnapshot.forEach(doc => {
      const category = doc.data();
      console.log(`- Category: ${category.name} (ID: ${doc.id})`);
      console.log(`  Main Category: ${category.mainCategory || 'None (Main Category)'}`);
      
      categoryMap.set(doc.id, {
        ...category,
        id: doc.id
      });

      // Map category name to its ID
      categoryNameToIdMap.set(category.name, doc.id);
    });

    // Get all transactions
    const transactionsRef = collection(db, 'transactions');
    const transactionsQuery = query(transactionsRef, where('userId', '==', userId));
    const transactionsSnapshot = await getDocs(transactionsQuery);

    console.log(`\nFound ${transactionsSnapshot.size} transactions`);

    let updatedCount = 0;
    let errorCount = 0;

    // Process each transaction
    for (const transactionDoc of transactionsSnapshot.docs) {
      const transaction = transactionDoc.data();
      console.log(`\nProcessing transaction ${transactionDoc.id}:`);
      console.log(`- Current categoryId: ${transaction.categoryId}`);
      
      // Get the category ID from the name
      const categoryId = categoryNameToIdMap.get(transaction.categoryId);
      if (!categoryId) {
        console.log(`Skipping transaction ${transactionDoc.id} - category name not found: ${transaction.categoryId}`);
        console.log('Available category names:', Array.from(categoryNameToIdMap.keys()));
        continue;
      }

      const subcategory = categoryMap.get(categoryId);
      if (!subcategory) {
        console.error(`Category not found for transaction: ${transactionDoc.id}`);
        errorCount++;
        continue;
      }

      console.log(`- Subcategory: ${subcategory.name}`);
      console.log(`- Main Category: ${subcategory.mainCategory}`);

      // Get the main category ID using the main category name
      const mainCategoryName = subcategory.mainCategory;
      if (!mainCategoryName) {
        console.error(`No main category specified for subcategory: ${subcategory.name}`);
        errorCount++;
        continue;
      }

      const mainCategoryId = mainCategoryMap.get(mainCategoryName);
      if (!mainCategoryId) {
        console.error(`Main category not found: ${mainCategoryName}`);
        console.log('Available main categories:', Array.from(mainCategoryMap.keys()));
        errorCount++;
        continue;
      }

      // Update the transaction
      try {
        await updateDoc(doc(db, 'transactions', transactionDoc.id), {
          categoryId: mainCategoryId,
          subcategoryId: categoryId
        });
        updatedCount++;
        console.log(`Updated transaction ${transactionDoc.id}:`);
        console.log(`- Old categoryId: ${transaction.categoryId}`);
        console.log(`- New categoryId: ${mainCategoryId}`);
        console.log(`- New subcategoryId: ${categoryId}`);
      } catch (error) {
        console.error(`Error updating transaction ${transactionDoc.id}:`, error);
        errorCount++;
      }
    }

    console.log(`\nFix completed:`);
    console.log(`Transactions updated: ${updatedCount}`);
    console.log(`Errors encountered: ${errorCount}`);

    return {
      updatedCount,
      errorCount
    };

  } catch (error) {
    console.error('Error fixing transaction categories:', error);
    throw error;
  }
}

// Run the fix
fixTransactionCategories(); 