import { auth, db } from "./firebase.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

console.log("council.js start");

function wireTabs() {
  var tabs = document.querySelectorAll(".tab");
  var panels = document.querySelectorAll("[data-panel]");
  if (!tabs.length || !panels.length) {
    return;
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var target = tab.getAttribute("data-tab");
      tabs.forEach(function (btn) {
        btn.classList.toggle("active", btn === tab);
      });
      panels.forEach(function (panel) {
        panel.classList.toggle("hidden", panel.getAttribute("data-panel") !== target);
      });
      updateMemberCount();
    });
  });

  updateMemberCount();
}

function renderUsers(users) {
  var container = document.getElementById("admin-users");
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!users.length) {
    container.innerHTML =
      "<article class=\"member-card\">" +
      "<div class=\"avatar\">!</div>" +
      "<h3>No users found</h3>" +
      "<p>Check Firestore</p>" +
      "</article>";
    return;
  }

  users.forEach(function (user) {
    var card = document.createElement("article");
    card.className = "member-card";

    var initials = "?";
    if (user.name) {
      initials = user.name.split(" ").map(function (part) {
        return part.charAt(0);
      }).join("").slice(0, 2).toUpperCase();
    } else if (user.email) {
      initials = user.email.charAt(0).toUpperCase();
    }

    card.innerHTML =
      "<div class=\"avatar\">" + initials + "</div>" +
      "<h3>" + (user.name || "Unnamed") + "</h3>" +
      "<p>" + (user.email || "No email") + "</p>" +
      "<p>Role: " + (user.role || "user") + "</p>";

    var organizerButton = document.createElement("button");
    organizerButton.className = "tab";
    organizerButton.type = "button";
    organizerButton.textContent = "Make Organizer";
    organizerButton.addEventListener("click", function () {
      updateUserRole(user.id, "organizer");
    });

    var userButton = document.createElement("button");
    userButton.className = "tab";
    userButton.type = "button";
    userButton.textContent = "Make User";
    userButton.addEventListener("click", function () {
      updateUserRole(user.id, "user");
    });

    var deleteButton = document.createElement("button");
    deleteButton.className = "tab admin-danger";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete Account";
    deleteButton.addEventListener("click", function () {
      deleteUserDoc(user.id);
    });

    card.appendChild(organizerButton);
    card.appendChild(userButton);
    card.appendChild(deleteButton);
    container.appendChild(card);
  });

  updateMemberCount();
}

function updateMemberCount() {
  var pill = document.querySelector(".pill-count");
  var activeTab = document.querySelector(".tab.active");
  if (!pill || !activeTab) {
    return;
  }

  var target = activeTab.getAttribute("data-tab");
  var panel = document.querySelector("[data-panel=\"" + target + "\"]");
  if (!panel) {
    return;
  }

  var count = panel.querySelectorAll(".member-card").length;
  pill.textContent = count + " Members";
}

function fetchUsers() {
  return getDocs(collection(db, "users")).then(function (snapshot) {
    var users = [];
    snapshot.forEach(function (docSnap) {
      users.push({
        id: docSnap.id,
        name: docSnap.data().name || "",
        email: docSnap.data().email || "",
        role: docSnap.data().role || "user"
      });
    });
    renderUsers(users);
  });
}

function updateUserRole(uid, role) {
  if (!uid) {
    return;
  }
  updateDoc(doc(db, "users", uid), { role: role })
    .then(function () {
      console.log("Role updated for", uid, "->", role);
      return fetchUsers();
    })
    .catch(function (error) {
      console.error(error);
      alert(error.message);
    });
}

function deleteUserDoc(uid) {
  if (!uid) {
    return;
  }
  if (!window.confirm("Delete this account? This cannot be undone.")) {
    return;
  }
  deleteDoc(doc(db, "users", uid))
    .then(function () {
      console.log("User doc deleted for", uid);
      return fetchUsers();
    })
    .catch(function (error) {
      console.error(error);
      alert(error.message);
    });
}

async function guardAndInit(user) {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  console.log("Council guard uid =", user.uid);

  try {
    var snap = await getDoc(doc(db, "users", user.uid));
    var data = snap.exists() ? snap.data() : {};
    var role = data.role || "user";

    console.log("Council role =", role);

    if (role !== "admin") {
      window.location.href = "home.html";
      return;
    }

    console.log("Admin access granted ✅");
    wireTabs();
    await fetchUsers();
  } catch (error) {
    console.error(error);
  }
}

onAuthStateChanged(auth, function (user) {
  guardAndInit(user);
});
