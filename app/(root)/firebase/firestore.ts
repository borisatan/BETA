import { db } from "./firebaseConfig";
import { collection, addDoc, getDocs } from "firebase/firestore";

// Define a TypeScript type for User
interface User {
  userId: string;
  name: string;
  email: string;
  createdAt: Date;
}

// Function to add user data to Firestore
export const addUserToFirestore = async (user: User): Promise<void> => {
  try {
    await addDoc(collection(db, "users"), user);
    console.log("User added to Firestore!");
  } catch (error) {
    console.error("Error adding user to Firestore: ", error);
  }
};

// Function to fetch all users
export const getAllUsers = async (): Promise<User[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    return querySnapshot.docs.map((doc) => ({
      userId: doc.id,
      ...doc.data(),
    })) as User[];
  } catch (error) {
    console.error("Error fetching users: ", error);
    return [];
  }
};
