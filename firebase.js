import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBRp6WRxRpVTsj6BCPp1yl6IfBbTQu7lqI",
  authDomain: "event-app-77858.firebaseapp.com",
  projectId: "event-app-77858",
  storageBucket: "event-app-77858.firebasestorage.app",
  messagingSenderId: "305729526296",
  appId: "1:305729526296:web:9d49c4694e05b0d3d4816d"
};

export const app = initializeApp(firebaseConfig);
console.log("Firebase initialized");

export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};
