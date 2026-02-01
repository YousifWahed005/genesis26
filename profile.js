import("./roles.js").then(function (roles) {
  return roles.requireAuth().then(function (user) {
    if (!user) {
      window.location.href = "index.html";
    }
  });
});

var session = JSON.parse(localStorage.getItem("genesisSession") || "{}");
var email = session.email || "";
var name = session.name || "Adventurer";
var role = session.role || "Council Member";
var age = session.age || "24";

var nameInput = document.getElementById("detail-name");
var ageInput = document.getElementById("detail-age");
var avatar = document.querySelector(".avatar");

function syncProfileUI(nextName, nextAge, nextRole) {
  var profileName = document.getElementById("profile-name");
  var profileRole = document.getElementById("profile-role");
  var detailRole = document.getElementById("detail-role");

  if (profileName) {
    profileName.textContent = nextName;
  }
  if (profileRole) {
    profileRole.textContent = nextRole;
  }
  if (detailRole) {
    detailRole.textContent = nextRole;
  }
  if (nameInput) {
    nameInput.value = nextName;
  }
  if (ageInput) {
    ageInput.value = nextAge;
  }
  if (avatar) {
    avatar.textContent = nextName.charAt(0).toUpperCase();
  }
}

syncProfileUI(name, age, role);

var saveButton = document.getElementById("save-profile-btn");
if (saveButton) {
  saveButton.addEventListener("click", function () {
    var nextName = nameInput.value.trim() || "Adventurer";
    var nextAge = ageInput.value.trim() || "24";

    session.name = nextName;
    session.age = nextAge;
    localStorage.setItem("genesisSession", JSON.stringify(session));

    if (email) {
      var users = JSON.parse(localStorage.getItem("genesisUsers") || "{}");
      users[email] = users[email] || { email: email };
      users[email].name = nextName;
      users[email].age = nextAge;
      localStorage.setItem("genesisUsers", JSON.stringify(users));
    }

    syncProfileUI(nextName, nextAge, role);
  });
}

var signoutButton = document.getElementById("signout-btn");
if (signoutButton) {
  signoutButton.addEventListener("click", function () {
    import("./firebase.js").then(function (firebase) {
      firebase.signOut(firebase.auth)
        .catch(function () {})
        .then(function () {
          localStorage.removeItem("genesisSession");
          window.location.href = "index.html";
        });
    });
  });
}
