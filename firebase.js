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


const firebaseConfig = {
  apiKey: "AIzaSyBRp6WRxRpVTsj6BCPp1yl6IfBbTQu7lqI",
  authDomain: "event-app-77858.firebaseapp.com",
  projectId: "event-app-77858",
  storageBucket: "event-app-77858.appspot.com",
  messagingSenderId: "305729526296",
  appId: "1:305729526296:web:9d49c4694e05b0d3d4816d"
};

export const app = initializeApp(firebaseConfig);
console.log("Firebase initialized");

export const auth = getAuth(app);
export const db = getFirestore(app);

console.log(
  "If you see OAuth domain warnings, add 127.0.0.1 and localhost in Firebase Console -> Authentication -> Settings -> Authorized domains."
);

// ✅ re-export auth funcs
export {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};

// ✅ re-export firestore helpers so other files can import only from firebase.js
export { doc, getDoc, setDoc, serverTimestamp };


async function ensureProfileDoc(uid) {
  if (!uid) return;

  const profileRef = doc(db, "profiles", uid);
  const profileSnap = await getDoc(profileRef);

  if (!profileSnap.exists()) {
    const profilePayload = {
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
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user.");

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  // ⚠️ تعديل مهم: systemRole الافتراضي يبقى "user" مش "member"
  // عشان يركب مع الـ rules اللي بتستخدم user/admin/organizer
  if (!snap.exists()) {
    const payload = {
      email: user.email || "",
      name: user.displayName || "",
      systemRole: "user",
      points: 0,
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

  const data = snap.data() || {};
  await ensureProfileDoc(user.uid);

  return {
    uid: user.uid,
    email: data.email || user.email || "",
    name: data.name || user.displayName || "",
    systemRole: data.systemRole || "user"
  };
}

export async function getOrganizerData(uid) {
  if (!uid) return null;

  try {
    const orgSnap = await getDoc(doc(db, "organizers", uid));
    if (!orgSnap.exists()) return null;
    return orgSnap.data() || null;
  } catch (error) {
    if (error && error.code === "permission-denied") return null;
    throw error;
  }
}
