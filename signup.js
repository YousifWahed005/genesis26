import { auth, db, createUserWithEmailAndPassword, updateProfile } from "./firebase.js";
import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

var signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var name = document.getElementById("signup-name").value.trim();
    var email = document.getElementById("signup-email").value.trim();
    var password = document.getElementById("signup-password").value;
    var confirm = document.getElementById("signup-confirm").value;

    if (password !== confirm) {
      alert("Passwords do not match.");
      return;
    }

    createUserWithEmailAndPassword(auth, email, password)
      .then(function (result) {
        return updateProfile(result.user, { displayName: name }).then(function () {
          return setDoc(doc(db, "users", result.user.uid), {
            name: name,
            email: email,
            role: "user",
            createdAt: serverTimestamp()
          });
        }).then(function () {
          localStorage.setItem(
            "genesisSession",
            JSON.stringify({ email: email, name: name })
          );
          window.location.href = "home.html";
        });
      })
      .catch(function (error) {
        console.error(error);
        alert(error.message);
      });
  });
}
