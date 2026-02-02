import { auth, onAuthStateChanged, getCurrentUserData, getOrganizerData } from "./firebase.js";

var homeLoading = document.getElementById("home-loading");
var nameTarget = document.getElementById("user-name");

onAuthStateChanged(auth, function (user) {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  getCurrentUserData()
    .then(function (data) {
      console.log("UID:", data.uid);
      console.log("systemRole:", data.systemRole);
      if (nameTarget) {
        nameTarget.textContent = data.name || "Adventurer";
      }
      if (homeLoading) {
        homeLoading.style.display = "none";
      }
      return getOrganizerData(data.uid);
    })
    .then(function (orgData) {
      if (orgData) {
        console.log("councilRole:", orgData.councilRole || "n/a");
      }
    })
    .catch(function (error) {
      console.error(error);
    });
});

var sections = document.querySelectorAll(".home-section");
sections.forEach(function (section, index) {
  section.style.animationDelay = (index * 80) + "ms";
});
