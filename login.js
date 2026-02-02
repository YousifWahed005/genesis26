import { auth, signInWithEmailAndPassword, getCurrentUserData } from "./firebase.js";

var loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var email = document.getElementById("login-email").value.trim();
    var password = document.getElementById("login-password").value;

    signInWithEmailAndPassword(auth, email, password)
      .then(function () {
        return getCurrentUserData()
          .then(function (data) {
            console.log("UID:", data.uid);
            console.log("systemRole:", data.systemRole);
          })
          .catch(function (error) {
            console.error(error);
          })
          .then(function () {
            window.location.href = "loading.html";
          });
      })
      .catch(function (error) {
        console.error(error);
        alert(error.message);
      });
  });
}
