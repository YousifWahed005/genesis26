import { auth, db, onAuthStateChanged, getCurrentUserData } from "./firebase.js";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log("council.js start");

var adminTools = document.getElementById("admin-tools");
var adminUsersPanel = document.getElementById("admin-users");

var FUNCTION_OPTIONS = ["unassigned", "IGV", "OGV", "IGTE", "B2C", "OGTA", "TM"];
var RANK_OPTIONS = ["member", "mm", "vp"];
var COUNCIL_OPTIONS = ["none", "oc", "vp"];
var ROLE_OPTIONS = ["user", "organizer", "admin"];

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

function updateMemberCount() {
  var pill = document.querySelector(".pill-count");
  var activeTab = document.querySelector(".tab.active");
  if (!pill || !activeTab) {
    return;
  }

  var target = activeTab.getAttribute("data-tab");
  var count = 0;
  var panel = document.querySelector("[data-panel=\"" + target + "\"]");
  if (panel) {
    count = panel.querySelectorAll(".member-card").length;
  }
  pill.textContent = count + " Members";
}

function createCouncilCard(member) {
  var card = document.createElement("article");
  card.className = "member-card";

  var avatar = document.createElement("div");
  avatar.className = "avatar";

  if (member.photoURL) {
    avatar.classList.add("photo");
    avatar.style.backgroundImage = "url(\"" + member.photoURL + "\")";
    avatar.textContent = "";
  } else {
    avatar.textContent = member.initials || "?";
  }

  var name = document.createElement("h3");
  name.textContent = member.displayName || "Member";

  var ageLine = document.createElement("p");
  var ageLabel = member.age !== undefined && member.age !== "" ? member.age : "--";
  ageLine.textContent = "Age: " + ageLabel;

  var funFact = document.createElement("p");
  funFact.textContent = member.funFact || "Fun fact coming soon";

  card.appendChild(avatar);
  card.appendChild(name);
  card.appendChild(ageLine);
  card.appendChild(funFact);

  return card;
}

function renderCouncilMembers(vps, organizers) {
  var vpList = document.getElementById("vp-list");
  var orgList = document.getElementById("org-list");
  if (!vpList || !orgList) {
    return;
  }

  vpList.innerHTML = "";
  orgList.innerHTML = "";

  vps.forEach(function (member) {
    vpList.appendChild(createCouncilCard(member));
  });

  organizers.forEach(function (member) {
    orgList.appendChild(createCouncilCard(member));
  });

  updateMemberCount();
}

async function fetchUserMap() {
  var snapshot = await getDocs(collection(db, "users"));
  var map = {};
  snapshot.forEach(function (docSnap) {
    map[docSnap.id] = docSnap.data() || {};
  });
  return map;
}

async function buildMembersForCouncilRole(role, userMap) {
  var members = [];
  var profileQuery = query(collection(db, "profiles"), where("councilRole", "==", role));
  var snapshot = await getDocs(profileQuery);
  snapshot.forEach(function (profileSnap) {
    var profileData = profileSnap.data() || {};
    var uid = profileSnap.id;
    var userData = userMap[uid] || {};
    var displayName = userData.name || userData.email || "Member";
    var initials = displayName
      .split(" ")
      .map(function (part) { return part.charAt(0); })
      .join("")
      .slice(0, 2)
      .toUpperCase();

    members.push({
      uid: uid,
      displayName: displayName,
      photoURL: profileData.photoURL || "",
      age: profileData.age,
      funFact: profileData.funFact || "",
      initials: initials
    });
  });
  return members;
}

async function loadCouncilMembers(userMap) {
  var vps = await buildMembersForCouncilRole("vp", userMap);
  var organizers = await buildMembersForCouncilRole("oc", userMap);
  console.log("Council members loaded", { organizers: organizers.length, vps: vps.length });
  renderCouncilMembers(vps, organizers);
}

function createSelect(options, value) {
  var select = document.createElement("select");
  select.className = "tab";
  options.forEach(function (optionValue) {
    var option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue;
    if (optionValue === value) {
      option.selected = true;
    }
    select.appendChild(option);
  });
  return select;
}

function renderAdminUsers(users, profiles) {
  if (!adminUsersPanel) {
    return;
  }

  adminUsersPanel.innerHTML = "";
  if (!users.length) {
    adminUsersPanel.innerHTML =
      "<article class=\"member-card\">" +
      "<div class=\"avatar\">!</div>" +
      "<h3>No users found</h3>" +
      "<p>Check Firestore</p>" +
      "</article>";
    updateMemberCount();
    return;
  }

  users.forEach(function (user) {
    var profileData = profiles[user.uid] || {};
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
      "<p>" + (user.email || "No email") + "</p>";

    var functionSelect = createSelect(FUNCTION_OPTIONS, profileData.function || "unassigned");
    var rankSelect = createSelect(RANK_OPTIONS, profileData.rank || "member");
    var councilSelect = createSelect(COUNCIL_OPTIONS, profileData.councilRole || "none");
    var roleSelect = createSelect(ROLE_OPTIONS, user.systemRole || "user");

    var assignButton = document.createElement("button");
    assignButton.className = "tab";
    assignButton.type = "button";
    assignButton.textContent = "Save";
    assignButton.addEventListener("click", function () {
      updateAdminAssignments(user.uid, functionSelect.value, rankSelect.value, councilSelect.value, roleSelect.value);
    });

    card.appendChild(functionSelect);
    card.appendChild(rankSelect);
    card.appendChild(councilSelect);
    card.appendChild(roleSelect);
    card.appendChild(assignButton);
    adminUsersPanel.appendChild(card);
  });

  updateMemberCount();
}

async function fetchProfilesMap() {
  var snapshot = await getDocs(collection(db, "profiles"));
  var map = {};
  snapshot.forEach(function (docSnap) {
    map[docSnap.id] = docSnap.data() || {};
  });
  return map;
}

async function updateAdminAssignments(uid, nextFunction, nextRank, nextCouncilRole, nextSystemRole) {
  if (!uid) {
    return;
  }
  try {
    await setDoc(doc(db, "profiles", uid), {
      function: nextFunction,
      rank: nextRank,
      councilRole: nextCouncilRole,
      updatedAt: serverTimestamp()
    }, { merge: true });

    await setDoc(doc(db, "users", uid), {
      systemRole: nextSystemRole,
      updatedAt: serverTimestamp()
    }, { merge: true });

    console.log("Admin updated", uid, {
      function: nextFunction,
      rank: nextRank,
      councilRole: nextCouncilRole,
      systemRole: nextSystemRole
    });

    await refreshCouncilData();
  } catch (error) {
    console.error("Admin update failed", error);
    alert(error.message);
  }
}

async function refreshCouncilData() {
  var userMap = await fetchUserMap();
  await loadCouncilMembers(userMap);
  if (adminTools && !adminTools.classList.contains("hidden")) {
    var profilesMap = await fetchProfilesMap();
    var usersList = Object.keys(userMap).map(function (uid) {
      var data = userMap[uid] || {};
      return {
        uid: uid,
        name: data.name || "",
        email: data.email || "",
        systemRole: data.systemRole || "user"
      };
    });
    renderAdminUsers(usersList, profilesMap);
  }
}

function hideAdminPanel() {
  var adminTab = document.querySelector(".tab[data-tab=\"admin\"]");
  if (adminTab) {
    adminTab.remove();
  }
  if (adminTools) {
    adminTools.remove();
  }
  var adminPanel = document.querySelector("[data-panel=\"admin\"]");
  if (adminPanel) {
    adminPanel.remove();
  }

  var activeTab = document.querySelector(".tab.active");
  if (!activeTab) {
    var firstTab = document.querySelector(".tab");
    if (firstTab) {
      firstTab.classList.add("active");
    }
  }
}

async function guardAndInit(user) {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  console.log("Council guard uid =", user.uid);

  try {
    var data = await getCurrentUserData();
    console.log("UID:", data.uid);
    console.log("systemRole:", data.systemRole);
    console.log("Admin access:", data.systemRole === "admin");

    wireTabs();
    await refreshCouncilData();

    if (data.systemRole !== "admin") {
      hideAdminPanel();
      console.log("Admin access not granted - hiding admin panel");
      return;
    }

    console.log("Admin access granted");
  } catch (error) {
    console.error(error);
  }
}

onAuthStateChanged(auth, function (user) {
  guardAndInit(user);
});
