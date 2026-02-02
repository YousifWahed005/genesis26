import { auth, db, storage, onAuthStateChanged, signOut, getCurrentUserData } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

var nameInput = document.getElementById("detail-name");
var ageInput = document.getElementById("detail-age");
var funFactInput = document.getElementById("detail-funfact");
var photoInput = document.getElementById("detail-photo");
var avatar = document.querySelector(".avatar");
var profileName = document.getElementById("profile-name");
var profileRole = document.getElementById("profile-role");
var detailRole = document.getElementById("detail-role");
var emailTarget = document.getElementById("profile-email");

var organizerSection = document.getElementById("organizer-section");
var organizerStatus = document.getElementById("organizer-status");
var organizerRoleValue = document.getElementById("organizer-role");

var saveButton = document.getElementById("save-profile-btn");
var signoutButton = document.getElementById("signout-btn");

var currentUserData = null;
var currentProfileData = null;

function setRoleText(systemRole) {
  var label = systemRole === "admin" ? "Admin" : "Member";
  if (profileRole) {
    profileRole.textContent = label;
  }
  if (detailRole) {
    detailRole.textContent = label;
  }
}

function syncProfileUI(userData, profileData) {
  if (!userData) {
    return;
  }

  if (profileName) {
    profileName.textContent = userData.name || "Adventurer";
  }
  if (nameInput) {
    nameInput.value = userData.name || "";
    nameInput.readOnly = true;
    nameInput.disabled = true;
  }
  if (ageInput) {
    ageInput.value = profileData && profileData.age !== undefined ? profileData.age : "";
    ageInput.disabled = false;
  }
  if (funFactInput) {
    funFactInput.value = profileData ? (profileData.funFact || "") : "";
    funFactInput.disabled = false;
  }
  if (avatar) {
    var photoURL = profileData ? profileData.photoURL : "";
    if (photoURL) {
      avatar.classList.add("photo");
      avatar.style.backgroundImage = "url(\"" + photoURL + "\")";
      avatar.textContent = "";
    } else {
      avatar.classList.remove("photo");
      avatar.style.backgroundImage = "";
      var initials = userData.name
        ? userData.name.split(" ").map(function (part) { return part.charAt(0); }).join("").slice(0, 2).toUpperCase()
        : "A";
      avatar.textContent = initials;
    }
  }
  if (emailTarget) {
    emailTarget.textContent = userData.email || "user@email.com";
  }

  if (organizerSection) {
    organizerSection.hidden = userData.systemRole !== "admin";
  }
  if (userData.systemRole === "admin") {
    if (organizerStatus) {
      organizerStatus.textContent = userData.systemRole || "user";
    }
    if (organizerRoleValue) {
      var functionValue = profileData && profileData.function ? profileData.function : "unassigned";
      var rankValue = profileData && profileData.rank ? profileData.rank : "member";
      var councilValue = profileData && profileData.councilRole ? profileData.councilRole : "none";
      organizerRoleValue.textContent = functionValue + " | " + rankValue + " | " + councilValue;
    }
  }
  setRoleText(userData.systemRole || "member");
}

async function saveProfile() {
  if (!currentUserData) {
    return;
  }

  var rawAge = ageInput ? ageInput.value.trim() : "";
  var nextAge = rawAge || "";
  var nextFunFact = funFactInput ? funFactInput.value.trim() : "";

  try {
    var photoURL = currentProfileData ? currentProfileData.photoURL || "" : "";
    var file = photoInput && photoInput.files ? photoInput.files[0] : null;
    if (file) {
      var storageRef = ref(storage, "profiles/" + currentUserData.uid + "/photo.jpg");
      await uploadBytes(storageRef, file);
      photoURL = await getDownloadURL(storageRef);
      console.log("Uploaded profile photo", photoURL);
    }

    await setDoc(doc(db, "profiles", currentUserData.uid), {
      age: nextAge,
      funFact: nextFunFact,
      photoURL: photoURL,
      updatedAt: serverTimestamp()
    }, { merge: true });

    currentProfileData = currentProfileData || {};
    currentProfileData.age = nextAge;
    currentProfileData.funFact = nextFunFact;
    currentProfileData.photoURL = photoURL;
    syncProfileUI(currentUserData, currentProfileData);
    console.log("Profile saved for", currentUserData.uid);
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

onAuthStateChanged(auth, function (user) {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  (async function () {
    try {
      var data = await getCurrentUserData();
      console.log("UID:", data.uid);
      console.log("systemRole:", data.systemRole);
      currentUserData = data;
      var profileSnap = await getDoc(doc(db, "profiles", data.uid));
      currentProfileData = profileSnap.exists()
        ? (profileSnap.data() || {})
        : { age: "", funFact: "", photoURL: "", function: "unassigned", rank: "member", councilRole: "none" };
      console.log("Profile data loaded", currentProfileData);
      syncProfileUI(currentUserData, currentProfileData);
    } catch (error) {
      console.error(error);
    }
  })();
});

if (saveButton) {
  saveButton.addEventListener("click", function () {
    saveProfile();
  });
}

if (signoutButton) {
  signoutButton.addEventListener("click", function () {
    signOut(auth)
      .catch(function () {})
      .then(function () {
        window.location.href = "index.html";
      });
  });
}
