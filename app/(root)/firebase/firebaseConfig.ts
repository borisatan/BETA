// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import Constants from 'expo-constants';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional


  
const firebaseConfig = {
    apiKey: Constants.expoConfig?.extra?.firebase.apiKey,
    authDomain: Constants.expoConfig?.extra?.firebase.authDomain,
    projectId: Constants.expoConfig?.extra?.firebase.projectId,
    storageBucket: Constants.expoConfig?.extra?.firebase.storageBucket,
    messagingSenderId: Constants.expoConfig?.extra?.firebase.messagingSenderId,
    appId: Constants.expoConfig?.extra?.firebase.appId,
    measurementId: Constants.expoConfig?.extra?.firebase.measurementId
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
const auth = getAuth(app);

const db = getFirestore(app);

export { app, auth, db };