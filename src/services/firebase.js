import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAhwB5Fi4pQsERToK_2UrgHQ0ZHSAo0Zqs",
  authDomain: "agapay-capstone.firebaseapp.com",
  projectId: "agapay-capstone",
  storageBucket: "agapay-capstone.firebasestorage.app",
  messagingSenderId: "543856158845",
  appId: "1:543856158845:web:beb6b1640837253341e914",
};

const app = initializeApp(firebaseConfig);


export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
  