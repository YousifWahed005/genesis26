import {
  auth,
  db,
  storage,
  onAuthStateChanged,
  signOut,
  getCurrentUserData,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL
} from "./firebase.js";

console.log("PROFILE.JS NEW VERSION");

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
var currentPreviewUrl = "";

// 5MB
var MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function setRoleText(systemRole) {
  var label =
    systemRole === "admin" ? "Admin" :
    systemRole === "organizer" ? "Organizer" :
    "Member";

  if (profileRole) profileRole.textContent = label;
  if (detailRole) detailRole.textContent = label;
}

function syncProfileUI(userData, profileData) {
  if (!userData) return;

  if (profileName) profileName.textContent = userData.name || "Adventurer";

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

  // ⚠️ دي كانت عندك admin فقط. لو عايزها للـ organizer كمان عدل الشرط.
  if (organizerSection) {
    organizerSection.hidden = (userData.systemRole !== "admin" && userData.systemRole !== "organizer");
  }

  if (userData.systemRole === "admin" || userData.systemRole === "organizer") {
    if (organizerStatus) organizerStatus.textContent = userData.systemRole || "user";

    if (organizerRoleValue) {
      var functionValue = profileData && profileData.function ? profileData.function : "unassigned";
      var rankValue = profileData && profileData.rank ? profileData.rank : "member";
      var councilValue = profileData && profileData.councilRole ? profileData.councilRole : "none";
      organizerRoleValue.textContent = functionValue + " | " + rankValue + " | " + councilValue;
    }
  }

  setRoleText(userData.systemRole || "member");
}

function previewPhoto(file) {
  if (!avatar) return;

  if (currentPreviewUrl) {
    URL.revokeObjectURL(currentPreviewUrl);
    currentPreviewUrl = "";
  }

  currentPreviewUrl = URL.createObjectURL(file);
  avatar.classList.add("photo");
  avatar.style.backgroundImage = "url(\"" + currentPreviewUrl + "\")";
  avatar.textContent = "";
}

function validatePhotoFile(file) {
  if (!file) return null;

  if (!file.type || file.type.indexOf("image/") !== 0) {
    return "Please choose an image file.";
  }

  if (file.size > MAX_PHOTO_BYTES) {
    return "Image is too large. Max size is 5MB.";
  }

  return null;
}

async function saveProfile() {
  if (!currentUserData) return;

  try {
    var photoURL = currentProfileData ? (currentProfileData.photoURL || "") : "";
    var file = photoInput && photoInput.files ? photoInput.files[0] : null;

    if (file) {
      var validationError = validatePhotoFile(file);
      if (validationError) {
        alert(validationError);
        return;
      }

      // ✅ path واضح وثابت
      var storageRef = ref(storage, "profiles/" + currentUserData.uid + "/photo.jpg");

      await uploadBytes(storageRef, file, { contentType: file.type });

      photoURL = await getDownloadURL(storageRef);
      console.log("Uploaded profile photo", photoURL);
    }

    // ✅ خزّن الرابط بس في Firestore
    await setDoc(
      doc(db, "profiles", currentUserData.uid),
      {
        photoURL: photoURL,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    currentProfileData = currentProfileData || {};
    currentProfileData.photoURL = photoURL;

    syncProfileUI(currentUserData, currentProfileData);
    console.log("Profile saved for", currentUserData.uid);
  } catch (error) {
    console.error(error);
    alert(error.message || String(error));
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

if (photoInput) {
  photoInput.addEventListener("change", function () {
    var file = photoInput.files ? photoInput.files[0] : null;
    var validationError = validatePhotoFile(file);

    if (validationError) {
      alert(validationError);
      photoInput.value = "";
      return;
    }

    if (file) previewPhoto(file);
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
