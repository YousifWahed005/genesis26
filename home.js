import { auth, db, onAuthStateChanged, getCurrentUserData, getOrganizerData } from "./firebase.js";
import {
  collection,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

var homeLoading = document.getElementById("home-loading");
var nameTarget = document.getElementById("user-name");
var sessionStatus = document.getElementById("home-session-status");
var sessionTag = document.getElementById("home-session-tag");
var sessionType = document.getElementById("home-session-type");
var sessionTitle = document.getElementById("home-session-title");
var sessionDesc = document.getElementById("home-session-desc");
var sessionTime = document.getElementById("home-session-time");
var sessionLocation = document.getElementById("home-session-location");
var progressText = document.getElementById("home-progress-text");
var progressFill = document.getElementById("home-progress-fill");
var taskList = document.getElementById("home-task-list");
var leaderboardTarget = document.getElementById("home-leaderboard");

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

function toMinutes(timeValue) {
  if (!timeValue || typeof timeValue !== "string") return null;
  var parts = timeValue.split(":");
  if (parts.length < 2) return null;
  var hours = parseInt(parts[0], 10);
  var minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return (hours * 60) + minutes;
}

function getCurrentAgendaDay() {
  var urlParams = new URLSearchParams(window.location.search || "");
  var fromQuery = parseInt(urlParams.get("day"), 10);
  if (!isNaN(fromQuery) && fromQuery >= 1 && fromQuery <= 3) {
    return fromQuery;
  }

  var fromStorage = parseInt(localStorage.getItem("agendaDay"), 10);
  if (!isNaN(fromStorage) && fromStorage >= 1 && fromStorage <= 3) {
    return fromStorage;
  }

  return 1;
}

function pickNearestAgenda(items) {
  if (!items.length) return null;

  var now = new Date();
  var nowMinutes = (now.getHours() * 60) + now.getMinutes();
  var currentDay = getCurrentAgendaDay();

  var sorted = items.slice().sort(function (a, b) {
    if (a.day !== b.day) return a.day - b.day;
    var aStart = toMinutes(a.startTime) || 0;
    var bStart = toMinutes(b.startTime) || 0;
    return aStart - bStart;
  });

  var todayItems = sorted.filter(function (item) {
    return item.day === currentDay;
  });

  var liveItem = todayItems.find(function (item) {
    var start = toMinutes(item.startTime);
    var end = toMinutes(item.endTime);
    if (start === null || end === null) return false;
    return nowMinutes >= start && nowMinutes <= end;
  });

  if (liveItem) {
    return { item: liveItem, status: "Live" };
  }

  var upcomingToday = todayItems.find(function (item) {
    var start = toMinutes(item.startTime);
    if (start === null) return false;
    return start > nowMinutes;
  });

  if (upcomingToday) {
    return { item: upcomingToday, status: "Upcoming" };
  }

  var nextDayItem = sorted.find(function (item) {
    return item.day > currentDay;
  });

  if (nextDayItem) {
    return { item: nextDayItem, status: "Upcoming" };
  }

  return { item: sorted[0], status: "Upcoming" };
}

function renderSessionCard(pick) {
  if (!sessionTitle) return;

  if (!pick || !pick.item) {
    if (sessionStatus) sessionStatus.textContent = "Soon";
    if (sessionTag) sessionTag.textContent = "No Agenda";
    if (sessionType) sessionType.textContent = "Agenda";
    sessionTitle.textContent = "No sessions yet";
    sessionDesc.textContent = "Add agenda items to see them here.";
    if (sessionTime) sessionTime.textContent = "--:--";
    if (sessionLocation) sessionLocation.textContent = "Day --";
    return;
  }

  var item = pick.item;
  var status = pick.status || "Upcoming";

  if (sessionStatus) sessionStatus.textContent = status;
  if (sessionTag) {
    sessionTag.textContent = status === "Live" ? "Happening Now" : "Up Next";
  }
  if (sessionType) sessionType.textContent = "Agenda";
  if (sessionTitle) sessionTitle.textContent = item.topic || "Agenda Item";
  if (sessionDesc) {
    var speaker = item.speakerName ? ("Speaker: " + item.speakerName) : "";
    var chair = item.chair ? ("Chair: " + item.chair) : "";
    sessionDesc.textContent = (speaker && chair) ? (speaker + " • " + chair) : (speaker || chair || "Agenda session details");
  }
  if (sessionTime) {
    sessionTime.textContent = (item.startTime || "--:--") + " - " + (item.endTime || "--:--");
  }
  if (sessionLocation) {
    sessionLocation.textContent = "Day " + (item.day || "--");
  }
}

function renderTasks(tasks, completedMap) {
  if (!taskList || !progressText || !progressFill) return;

  taskList.innerHTML = "";
  var doneCount = 0;

  tasks.forEach(function (task) {
    var isDone = !!completedMap[task.id];
    if (isDone) doneCount += 1;

    var li = document.createElement("li");
    li.className = "task" + (isDone ? " done" : "");
    li.textContent = task.title || "Task";
    taskList.appendChild(li);
  });

  var total = tasks.length;
  progressText.textContent = doneCount + "/" + total + " Completed";
  var percent = total ? Math.round((doneCount / total) * 100) : 0;
  progressFill.style.width = percent + "%";

  if (!tasks.length) {
    var empty = document.createElement("li");
    empty.className = "task";
    empty.textContent = "No tasks yet";
    taskList.appendChild(empty);
  }
}

function renderLeaderboard(rows, currentUid) {
  if (!leaderboardTarget) return;
  leaderboardTarget.innerHTML = "";

  if (!rows.length) {
    leaderboardTarget.innerHTML =
      "<div class=\"leader-row\">" +
      "<div class=\"leader-left\">" +
      "<div class=\"avatar\">?</div>" +
      "<div><div class=\"leader-name\">No scores yet</div><div class=\"leader-rank\">Rank --</div></div>" +
      "</div>" +
      "<div class=\"leader-points\"><div class=\"points\">0</div><div class=\"label\">Points</div></div>" +
      "</div>";
    return;
  }

  rows.forEach(function (row, index) {
    var leaderRow = document.createElement("div");
    leaderRow.className = "leader-row" + (row.uid === currentUid ? " highlight" : "");

    var leaderLeft = document.createElement("div");
    leaderLeft.className = "leader-left";

    var avatar = document.createElement("div");
    avatar.className = "avatar";
    if (row.photoURL) {
      avatar.classList.add("photo");
      var cacheBusted = buildPhotoUrl(row.photoURL, row.photoUpdatedAt || row.updatedAt);
      avatar.style.backgroundImage = "url(\"" + cacheBusted + "\")";
      avatar.textContent = "";
    } else {
      avatar.textContent = row.initials || "?";
    }

    var infoWrap = document.createElement("div");
    var nameEl = document.createElement("div");
    nameEl.className = "leader-name";
    nameEl.textContent = row.name || "Member";
    var rankEl = document.createElement("div");
    rankEl.className = "leader-rank";
    rankEl.textContent = "Rank #" + (index + 1);
    infoWrap.appendChild(nameEl);
    infoWrap.appendChild(rankEl);

    leaderLeft.appendChild(avatar);
    leaderLeft.appendChild(infoWrap);

    var pointsWrap = document.createElement("div");
    pointsWrap.className = "leader-points";
    pointsWrap.innerHTML =
      "<div class=\"points\">" + row.points + "</div>" +
      "<div class=\"label\">Points</div>";

    leaderRow.appendChild(leaderLeft);
    leaderRow.appendChild(pointsWrap);
    leaderboardTarget.appendChild(leaderRow);
  });
}

async function loadAgendaCard() {
  try {
    var snapshot = await getDocs(collection(db, "agenda"));
    var items = [];
    snapshot.forEach(function (docSnap) {
      var data = docSnap.data() || {};
      items.push({
        id: docSnap.id,
        topic: data.topic || "",
        speakerName: data.speakerName || "",
        chair: data.chair || "",
        day: data.day || 0,
        startTime: data.startTime || "",
        endTime: data.endTime || ""
      });
    });
    var pick = pickNearestAgenda(items);
    renderSessionCard(pick);
  } catch (error) {
    console.error(error);
    renderSessionCard(null);
  }
}

async function loadTasks(userData) {
  var tasks = [];
  try {
    var tasksSnapshot = await getDocs(collection(db, "gameTasks"));
    tasksSnapshot.forEach(function (docSnap) {
      var data = docSnap.data() || {};
      if (data.active === false) return;
      tasks.push({
        id: docSnap.id,
        title: data.title || "Task",
        order: data.order || 0
      });
    });
  } catch (error) {
    console.error(error);
  }

  tasks.sort(function (a, b) {
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  });

  tasks = tasks.slice(0, 4);

  var completedMap = {};
  try {
    var userTasksSnap = await getDocs(collection(db, "users", userData.uid, "tasks"));
    userTasksSnap.forEach(function (docSnap) {
      var data = docSnap.data() || {};
      var taskId = data.taskId || docSnap.id;
      if (data.completed) {
        completedMap[taskId] = true;
      }
    });
  } catch (error) {
    console.error(error);
  }

  renderTasks(tasks, completedMap);
}

async function loadLeaderboard(userData) {
  try {
    var usersSnap = await getDocs(collection(db, "users"));
    var profilesSnap = await getDocs(collection(db, "profiles"));
    var profileMap = {};
    profilesSnap.forEach(function (docSnap) {
      profileMap[docSnap.id] = docSnap.data() || {};
    });

    var rows = [];
    usersSnap.forEach(function (docSnap) {
      var data = docSnap.data() || {};
      var profile = profileMap[docSnap.id] || {};
      var name = data.name || data.email || "Member";
      var initials = name
        .split(" ")
        .map(function (part) { return part.charAt(0); })
        .join("")
        .slice(0, 2)
        .toUpperCase();

      rows.push({
        uid: docSnap.id,
        name: name,
        points: data.points || 0,
        photoURL: profile.photoURL || "",
        photoUpdatedAt: profile.photoUpdatedAt || null,
        updatedAt: profile.updatedAt || null,
        initials: initials
      });
    });

    rows.sort(function (a, b) {
      return b.points - a.points;
    });

    renderLeaderboard(rows.slice(0, 5), userData.uid);
  } catch (error) {
    console.error(error);
    try {
      var profileSnap = await getDoc(doc(db, "profiles", userData.uid));
      var profileData = profileSnap.exists() ? (profileSnap.data() || {}) : {};
      var nameFallback = userData.name || userData.email || "Member";
      var initialsFallback = nameFallback
        .split(" ")
        .map(function (part) { return part.charAt(0); })
        .join("")
        .slice(0, 2)
        .toUpperCase();

      renderLeaderboard([{
        uid: userData.uid,
        name: nameFallback,
        points: userData.points || 0,
        photoURL: profileData.photoURL || "",
        initials: initialsFallback
      }], userData.uid);
    } catch (innerError) {
      console.error(innerError);
      renderLeaderboard([], userData.uid);
    }
  }
}

async function loadHomeData(userData) {
  await Promise.all([
    loadAgendaCard(),
    loadTasks(userData),
    loadLeaderboard(userData)
  ]);
}

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
      return Promise.all([
        getOrganizerData(data.uid),
        loadHomeData(data)
      ]);
    })
    .catch(function (error) {
      console.error(error);
    })
    .finally(function () {
      if (homeLoading) {
        homeLoading.style.display = "none";
      }
    });
});

var sections = document.querySelectorAll(".home-section");
sections.forEach(function (section, index) {
  section.style.animationDelay = (index * 80) + "ms";
});
