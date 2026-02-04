import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  getCurrentUserData,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "./firebase.js";
import { uploadProfilePhoto } from "./storage.js";

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
var processedPhotoFile = null;
var cropModal = document.getElementById("photo-crop-modal");
var cropCloseBackdrop = document.getElementById("photo-crop-close");
var cropCloseButton = document.getElementById("photo-crop-close-btn");
var cropCancelButton = document.getElementById("photo-crop-cancel");
var cropSaveButton = document.getElementById("photo-crop-save");
var cropCanvas = document.getElementById("photo-crop-canvas");
var cropZoomInput = document.getElementById("photo-crop-zoom");
var cropImage = null;
var cropImageUrl = "";
var cropScale = 1;
var cropBaseScale = 1;
var cropOffsetX = 0;
var cropOffsetY = 0;
var cropDragging = false;
var cropDragStartX = 0;
var cropDragStartY = 0;
var cropStartOffsetX = 0;
var cropStartOffsetY = 0;

function ensureCropModal() {
  if (cropModal && cropModal.querySelector(".profile-crop-card")) {
    return;
  }

  var modal = document.createElement("div");
  modal.className = "profile-crop-modal";
  modal.id = "photo-crop-modal";
  modal.hidden = true;
  modal.innerHTML =
    "<div class=\"profile-crop-backdrop\" id=\"photo-crop-close\"></div>" +
    "<div class=\"profile-crop-card\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"photo-crop-title\">" +
    "<div class=\"profile-crop-header\">" +
    "<h3 id=\"photo-crop-title\">Crop Photo</h3>" +
    "<button type=\"button\" class=\"profile-crop-close\" id=\"photo-crop-close-btn\">&times;</button>" +
    "</div>" +
    "<div class=\"profile-crop-body\">" +
    "<div class=\"profile-crop-frame\">" +
    "<canvas id=\"photo-crop-canvas\" width=\"260\" height=\"260\"></canvas>" +
    "</div>" +
    "<label class=\"profile-crop-zoom\">" +
    "<span>Zoom</span>" +
    "<input id=\"photo-crop-zoom\" type=\"range\" min=\"1\" max=\"3\" step=\"0.01\" value=\"1\" />" +
    "</label>" +
    "</div>" +
    "<div class=\"profile-crop-actions\">" +
    "<button type=\"button\" class=\"profile-crop-btn\" id=\"photo-crop-cancel\">Cancel</button>" +
    "<button type=\"button\" class=\"profile-crop-btn primary\" id=\"photo-crop-save\">Use Photo</button>" +
    "</div>" +
    "</div>";
  document.body.appendChild(modal);

  cropModal = document.getElementById("photo-crop-modal");
  cropCloseBackdrop = document.getElementById("photo-crop-close");
  cropCloseButton = document.getElementById("photo-crop-close-btn");
  cropCancelButton = document.getElementById("photo-crop-cancel");
  cropSaveButton = document.getElementById("photo-crop-save");
  cropCanvas = document.getElementById("photo-crop-canvas");
  cropZoomInput = document.getElementById("photo-crop-zoom");
}

ensureCropModal();

function buildPhotoUrl(url, updatedAt) {
  if (!url) return url;
  var version = "";
  if (updatedAt && typeof updatedAt.toMillis === "function") {
    version = String(updatedAt.toMillis());
  } else if (updatedAt instanceof Date) {
    version = String(updatedAt.getTime());
  } else if (typeof updatedAt === "number") {
    version = String(updatedAt);
  }
  if (!version) return url;
  return url + (url.indexOf("?") === -1 ? "?v=" : "&v=") + version;
}

// 25MB
var MAX_PHOTO_BYTES = 25 * 1024 * 1024;

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
      var cacheBusted = buildPhotoUrl(photoURL, profileData.photoUpdatedAt || profileData.updatedAt);
      avatar.classList.add("photo");
      avatar.style.backgroundImage = "url(\"" + cacheBusted + "\")";
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
    var isStaff = (userData.systemRole === "admin" || userData.systemRole === "organizer");
    if (!isStaff) {
      organizerSection.remove();
    } else {
      organizerSection.hidden = false;
    }
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function closeCropper() {
  if (!cropModal) return;
  cropModal.hidden = true;
  cropDragging = false;
  if (cropImageUrl) {
    URL.revokeObjectURL(cropImageUrl);
    cropImageUrl = "";
  }
  cropImage = null;
}

function openCropper(file) {
  if (!cropModal || !cropCanvas || !cropZoomInput) return;

  cropModal.hidden = false;
  cropZoomInput.value = "1";

  cropImage = new Image();
  cropImageUrl = URL.createObjectURL(file);
  cropImage.onload = function () {
    var canvasSize = cropCanvas.width;
    cropBaseScale = Math.max(canvasSize / cropImage.width, canvasSize / cropImage.height);
    cropScale = cropBaseScale;
    cropOffsetX = (canvasSize - (cropImage.width * cropScale)) / 2;
    cropOffsetY = (canvasSize - (cropImage.height * cropScale)) / 2;
    renderCropCanvas();
  };
  cropImage.onerror = function () {
    closeCropper();
    alert("Failed to load image.");
  };
  cropImage.src = cropImageUrl;
}

function clampCropOffsets() {
  if (!cropCanvas || !cropImage) return;
  var canvasSize = cropCanvas.width;
  var scaledWidth = cropImage.width * cropScale;
  var scaledHeight = cropImage.height * cropScale;

  var minX = canvasSize - scaledWidth;
  var minY = canvasSize - scaledHeight;
  var maxX = 0;
  var maxY = 0;

  cropOffsetX = clamp(cropOffsetX, minX, maxX);
  cropOffsetY = clamp(cropOffsetY, minY, maxY);
}

function renderCropCanvas() {
  if (!cropCanvas || !cropImage) return;
  var ctx = cropCanvas.getContext("2d");
  if (!ctx) return;

  clampCropOffsets();

  ctx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
  ctx.drawImage(
    cropImage,
    cropOffsetX,
    cropOffsetY,
    cropImage.width * cropScale,
    cropImage.height * cropScale
  );
}

function handleCropPointerDown(event) {
  if (!cropImage) return;
  cropDragging = true;
  var point = event.touches ? event.touches[0] : event;
  cropDragStartX = point.clientX;
  cropDragStartY = point.clientY;
  cropStartOffsetX = cropOffsetX;
  cropStartOffsetY = cropOffsetY;
  event.preventDefault();
}

function handleCropPointerMove(event) {
  if (!cropDragging) return;
  var point = event.touches ? event.touches[0] : event;
  var dx = point.clientX - cropDragStartX;
  var dy = point.clientY - cropDragStartY;
  cropOffsetX = cropStartOffsetX + dx;
  cropOffsetY = cropStartOffsetY + dy;
  renderCropCanvas();
  event.preventDefault();
}

function handleCropPointerUp() {
  cropDragging = false;
}

function updateCropZoom() {
  if (!cropCanvas || !cropImage || !cropZoomInput) return;
  var nextZoom = parseFloat(cropZoomInput.value || "1");
  var prevScale = cropScale;
  cropScale = cropBaseScale * nextZoom;

  var center = cropCanvas.width / 2;
  cropOffsetX = (cropOffsetX - center) * (cropScale / prevScale) + center;
  cropOffsetY = (cropOffsetY - center) * (cropScale / prevScale) + center;
  renderCropCanvas();
}

function saveCroppedPhoto() {
  if (!cropCanvas || !cropImage) return;
  var outputSize = 512;
  var outputCanvas = document.createElement("canvas");
  outputCanvas.width = outputSize;
  outputCanvas.height = outputSize;
  var ctx = outputCanvas.getContext("2d");
  if (!ctx) {
    alert("Canvas not supported.");
    return;
  }

  var scaleRatio = outputSize / cropCanvas.width;
  ctx.drawImage(
    cropImage,
    cropOffsetX * scaleRatio,
    cropOffsetY * scaleRatio,
    cropImage.width * cropScale * scaleRatio,
    cropImage.height * cropScale * scaleRatio
  );

  outputCanvas.toBlob(function (blob) {
    if (!blob) {
      alert("Failed to process image.");
      return;
    }
    processedPhotoFile = new File([blob], "profile.png", { type: "image/png" });
    previewPhoto(processedPhotoFile);
    closeCropper();
  }, "image/png");
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
    var file = processedPhotoFile || (photoInput && photoInput.files ? photoInput.files[0] : null);
    var nextAge = ageInput ? ageInput.value.trim() : "";
    var nextFunFact = funFactInput ? funFactInput.value.trim() : "";

    if (file) {
      var originalFile = photoInput && photoInput.files ? photoInput.files[0] : null;
      var validationError = validatePhotoFile(originalFile || file);
      if (validationError) {
        alert(validationError);
        return;
      }

      photoURL = await uploadProfilePhoto(file, currentUserData.uid);
      console.log("Uploaded profile photo", photoURL);
    }

    // ✅ خزّن الرابط بس في Firestore
    var profilePayload = {
      photoURL: photoURL,
      age: nextAge,
      funFact: nextFunFact,
      displayName: currentUserData ? (currentUserData.name || "") : "",
      updatedAt: serverTimestamp()
    };
    if (file) {
      profilePayload.photoUpdatedAt = serverTimestamp();
    }

    await setDoc(
      doc(db, "profiles", currentUserData.uid),
      profilePayload,
      { merge: true }
    );

    currentProfileData = currentProfileData || {};
    currentProfileData.photoURL = photoURL;
    currentProfileData.age = nextAge;
    currentProfileData.funFact = nextFunFact;
    processedPhotoFile = null;

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
      processedPhotoFile = null;
      return;
    }

    if (file) {
      processedPhotoFile = null;
      openCropper(file);
    }
  });
}

if (cropCanvas) {
  cropCanvas.addEventListener("mousedown", handleCropPointerDown);
  cropCanvas.addEventListener("touchstart", handleCropPointerDown, { passive: false });
}

window.addEventListener("mousemove", handleCropPointerMove);
window.addEventListener("touchmove", handleCropPointerMove, { passive: false });
window.addEventListener("mouseup", handleCropPointerUp);
window.addEventListener("touchend", handleCropPointerUp);

if (cropZoomInput) {
  cropZoomInput.addEventListener("input", updateCropZoom);
}

if (cropSaveButton) {
  cropSaveButton.addEventListener("click", function () {
    saveCroppedPhoto();
  });
}

if (cropCancelButton) {
  cropCancelButton.addEventListener("click", function () {
    closeCropper();
  });
}

if (cropCloseButton) {
  cropCloseButton.addEventListener("click", function () {
    closeCropper();
  });
}

if (cropCloseBackdrop) {
  cropCloseBackdrop.addEventListener("click", function () {
    closeCropper();
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
