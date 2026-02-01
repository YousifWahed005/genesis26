import { auth, signInWithEmailAndPassword } from "./firebase.js";

var loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var email = document.getElementById("login-email").value.trim();
    var password = document.getElementById("login-password").value;

    signInWithEmailAndPassword(auth, email, password)
      .then(function (result) {
        var user = result.user;
        var name = user.displayName || "Adventurer";

        localStorage.setItem(
          "genesisSession",
          JSON.stringify({ email: email, name: name })
        );

        window.location.href = "home.html";
      })
      .catch(function (error) {
        console.error(error);
        alert(error.message);
      });
  });
}
