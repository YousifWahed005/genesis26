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
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

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
export const storage = getStorage(app);

console.log("If you see OAuth domain warnings, add 127.0.0.1 and localhost in Firebase Console -> Authentication -> Settings -> Authorized domains.");

export {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};

async function ensureProfileDoc(uid) {
  if (!uid) {
    return;
  }
  var profileRef = doc(db, "profiles", uid);
  var profileSnap = await getDoc(profileRef);
  if (!profileSnap.exists()) {
    var profilePayload = {
      age: "",
      funFact: "",
      photoURL: "",
      function: "unassigned",
      rank: "member",
      councilRole: "none",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(profileRef, profilePayload);
    console.log("Created profiles doc for", uid);
  }
}

export async function getCurrentUserData() {
  var user = auth.currentUser;
  if (!user) {
    throw new Error("No authenticated user.");
  }

  var userRef = doc(db, "users", user.uid);
  var snap = await getDoc(userRef);
  if (!snap.exists()) {
    var payload = {
      email: user.email || "",
      name: user.displayName || "",
      systemRole: "user",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(userRef, payload);
    await ensureProfileDoc(user.uid);
    return {
      uid: user.uid,
      email: payload.email,
      name: payload.name,
      systemRole: payload.systemRole
    };
  }

  var data = snap.data() || {};
  await ensureProfileDoc(user.uid);
  return {
    uid: user.uid,
    email: data.email || user.email || "",
    name: data.name || user.displayName || "",
    systemRole: data.systemRole || "user"
  };
}

export async function getOrganizerData(uid) {
  if (!uid) {
    return null;
  }
  var orgSnap = await getDoc(doc(db, "organizers", uid));
  if (!orgSnap.exists()) {
    return null;
  }
  return orgSnap.data() || null;
}
