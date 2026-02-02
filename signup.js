import { auth, db, createUserWithEmailAndPassword, updateProfile } from "./firebase.js";
import {
  doc,
  getDoc,
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

    (async function () {
      try {
        var result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: name });

        var userRef = doc(db, "users", result.user.uid);
        var userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            name: name,
            email: email,
            systemRole: "user",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          console.log("Created users doc for", result.user.uid);
        } else {
          console.log("users doc already exists for", result.user.uid);
        }

        var profileRef = doc(db, "profiles", result.user.uid);
        var profileSnap = await getDoc(profileRef);
        if (!profileSnap.exists()) {
          await setDoc(profileRef, {
            age: "",
            funFact: "",
            photoURL: "",
            function: "unassigned",
            rank: "member",
            councilRole: "none",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          console.log("Created profiles doc for", result.user.uid);
        } else {
          console.log("profiles doc already exists for", result.user.uid);
        }

        window.location.href = "home.html";
      } catch (error) {
        console.error(error);
        alert(error.message);
      }
    })();
  });
}
