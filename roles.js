import { auth, db } from "./firebase.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export function requireAuth() {
  return new Promise(function (resolve) {
    onAuthStateChanged(auth, function (user) {
      resolve(user || null);
    });
  });
}

export function getCurrentUserRole(uid) {
  if (!uid) {
    return Promise.resolve(null);
  }
  return getDoc(doc(db, "users", uid)).then(function (snap) {
    if (!snap.exists()) {
      return null;
    }
    var data = snap.data() || {};
    return data.role || null;
  });
}

export function isOrganizer(role) {
  return role === "organizer" || role === "admin";
}

export function isAdmin(role) {
  return role === "admin";
}
