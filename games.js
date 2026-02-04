import { auth, db, onAuthStateChanged, getCurrentUserData } from "./firebase.js";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
  runTransaction,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

var gamesLoading = document.getElementById("games-loading");
var addTaskButton = document.getElementById("add-task-btn");
var taskGrid = document.getElementById("task-grid");
var sessionCard = document.getElementById("session-card");
var sessionUserInput = document.getElementById("session-user");
var sessionUsersList = document.getElementById("session-users");
var sessionPointsInput = document.getElementById("session-points");
var sessionReasonInput = document.getElementById("session-reason");
var sessionSubmitButton = document.getElementById("session-submit");
var sessionHint = document.getElementById("session-hint");

var taskModal = document.getElementById("task-modal");
var taskForm = document.getElementById("task-form");
var taskTitleInput = document.getElementById("task-title");
var taskPointsInput = document.getElementById("task-points");
var taskActiveInput = document.getElementById("task-active");
var taskModalTitle = document.getElementById("task-modal-title");
var taskSubmitButton = document.getElementById("task-submit");

var currentUserData = null;
var canManageGames = false;
var editingTaskId = null;
var taskCache = [];
var completionMap = {};
var userDirectory = [];

function wireTabs() {
  var tabs = document.querySelectorAll(".tab");
  var panels = document.querySelectorAll("[data-panel]");
  if (!tabs.length || !panels.length) return;

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var target = tab.getAttribute("data-tab");
      tabs.forEach(function (btn) {
        btn.classList.toggle("active", btn === tab);
      });
      panels.forEach(function (panel) {
        panel.classList.toggle("hidden", panel.getAttribute("data-panel") !== target);
      });
    });
  });
}

function openTaskModal(task) {
  if (!taskModal) return;
  editingTaskId = task ? task.id : null;
  if (taskModalTitle) {
    taskModalTitle.textContent = task ? "Edit Challenge" : "Add Challenge";
  }
  if (taskSubmitButton) {
    taskSubmitButton.textContent = task ? "Save" : "Add";
  }
  if (taskTitleInput) {
    taskTitleInput.value = task ? task.title : "";
  }
  if (taskPointsInput) {
    taskPointsInput.value = task ? task.points : 10;
  }
  if (taskActiveInput) {
    taskActiveInput.checked = task ? task.active !== false : true;
  }
  taskModal.hidden = false;
}

function closeTaskModal() {
  if (!taskModal) return;
  taskModal.hidden = true;
  editingTaskId = null;
  if (taskForm) taskForm.reset();
}

function renderTasks() {
  if (!taskGrid) return;
  taskGrid.innerHTML = "";

  if (!taskCache.length) {
    taskGrid.innerHTML =
      "<div class=\"task-card\"><p class=\"muted-text\">No challenges yet.</p></div>";
    return;
  }

  taskCache.forEach(function (task) {
    var card = document.createElement("div");
    var completed = !!completionMap[task.id];
    card.className = "task-card" + (completed ? " done" : "");

    var top = document.createElement("div");
    top.className = "task-top";

    var title = document.createElement("h3");
    title.className = "task-title";
    title.textContent = task.title || "Challenge";

    var points = document.createElement("span");
    points.className = "task-points";
    points.textContent = (task.points || 10) + " pts";

    top.appendChild(title);
    top.appendChild(points);

    var meta = document.createElement("div");
    meta.className = "task-meta";

    var checkWrap = document.createElement("label");
    checkWrap.className = "task-check";
    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = completed;
    checkbox.addEventListener("change", function () {
      toggleTaskCompletion(task, checkbox.checked);
      card.classList.toggle("done", checkbox.checked);
    });
    var checkText = document.createElement("span");
    checkText.textContent = checkbox.checked ? "Completed" : "Mark done";
    checkbox.addEventListener("change", function () {
      checkText.textContent = checkbox.checked ? "Completed" : "Mark done";
    });
    checkWrap.appendChild(checkbox);
    checkWrap.appendChild(checkText);

    meta.appendChild(checkWrap);

    if (canManageGames) {
      var actions = document.createElement("div");
      actions.className = "task-actions";

      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "task-action";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", function () {
        openTaskModal(task);
      });

      var deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "task-action danger";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", function () {
        deleteTask(task.id);
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      meta.appendChild(actions);
    }

    card.appendChild(top);
    card.appendChild(meta);
    taskGrid.appendChild(card);
  });
}

function deleteTask(taskId) {
  if (!taskId) return;
  if (!confirm("Delete this challenge?")) return;

  deleteDoc(doc(db, "gameTasks", taskId))
    .then(function () {
      return loadTasks();
    })
    .catch(function (error) {
      console.error(error);
      alert(error.message);
    });
}

function toggleTaskCompletion(task, isChecked) {
  if (!currentUserData || !task || !task.id) return;
  var points = parseInt(task.points, 10);
  if (isNaN(points)) points = 10;

  var userRef = doc(db, "users", currentUserData.uid);
  var taskRef = doc(db, "users", currentUserData.uid, "tasks", task.id);

  runTransaction(db, function (transaction) {
    return transaction.get(taskRef).then(function (taskSnap) {
      var alreadyDone = taskSnap.exists() && taskSnap.data().completed === true;
      if (isChecked && alreadyDone) {
        return;
      }
      if (!isChecked && !alreadyDone) {
        return;
      }

      transaction.set(taskRef, {
        taskId: task.id,
        title: task.title || "",
        completed: isChecked,
        updatedAt: serverTimestamp()
      }, { merge: true });

      var delta = isChecked ? points : -points;
      if (delta !== 0) {
        transaction.update(userRef, {
          points: increment(delta),
          updatedAt: serverTimestamp()
        });
      }
    });
  }).then(function () {
    completionMap[task.id] = isChecked;
  }).catch(function (error) {
    console.error(error);
    alert(error.message);
  });
}

async function loadCompletions() {
  if (!currentUserData) return;
  completionMap = {};
  var snap = await getDocs(collection(db, "users", currentUserData.uid, "tasks"));
  snap.forEach(function (docSnap) {
    var data = docSnap.data() || {};
    if (data.completed) {
      completionMap[docSnap.id] = true;
    }
  });
}

async function loadTasks() {
  var snapshot = await getDocs(collection(db, "gameTasks"));
  var tasks = [];
  snapshot.forEach(function (docSnap) {
    var data = docSnap.data() || {};
    if (data.active === false) return;
    tasks.push({
      id: docSnap.id,
      title: data.title || "",
      points: data.points || 10,
      active: data.active !== false
    });
  });

  tasks.sort(function (a, b) {
    if (a.title !== b.title) {
      return a.title.localeCompare(b.title);
    }
    return 0;
  });

  taskCache = tasks;
  renderTasks();
}

async function loadUserDirectory() {
  var usersSnap = await getDocs(collection(db, "users"));
  userDirectory = [];
  if (sessionUsersList) sessionUsersList.innerHTML = "";

  usersSnap.forEach(function (docSnap) {
    var data = docSnap.data() || {};
    var name = data.name || "";
    var email = data.email || "";
    var label = name ? (name + " (" + email + ")") : email;
    userDirectory.push({
      uid: docSnap.id,
      label: label,
      name: name,
      email: email
    });
    if (sessionUsersList) {
      var option = document.createElement("option");
      option.value = label;
      sessionUsersList.appendChild(option);
    }
  });
}

function findUserByLabel(label) {
  if (!label) return null;
  var lowered = label.toLowerCase();
  return userDirectory.find(function (user) {
    return user.label.toLowerCase() === lowered ||
      user.email.toLowerCase() === lowered ||
      (user.name && user.name.toLowerCase() === lowered);
  }) || null;
}

async function giveSessionPoints() {
  if (!canManageGames) {
    alert("Not allowed.");
    return;
  }

  var label = sessionUserInput ? sessionUserInput.value.trim() : "";
  var points = parseInt(sessionPointsInput ? sessionPointsInput.value : "0", 10);
  var reason = sessionReasonInput ? sessionReasonInput.value.trim() : "";

  if (!label) {
    alert("Pick a user.");
    return;
  }

  if (isNaN(points) || points <= 0) {
    alert("Enter points.");
    return;
  }

  var user = findUserByLabel(label);
  if (!user) {
    alert("User not found.");
    return;
  }

  await updateDoc(doc(db, "users", user.uid), {
    points: increment(points),
    updatedAt: serverTimestamp()
  });

  await addDoc(collection(db, "users", user.uid, "pointsLog"), {
    points: points,
    reason: reason,
    createdAt: serverTimestamp(),
    givenBy: currentUserData.uid,
    givenByName: currentUserData.name || currentUserData.email || ""
  });

  if (sessionHint) {
    sessionHint.textContent = "Points added to " + (user.name || user.email) + ".";
  }
  if (sessionUserInput) sessionUserInput.value = "";
  if (sessionPointsInput) sessionPointsInput.value = "10";
  if (sessionReasonInput) sessionReasonInput.value = "";
}

async function getCurrentProfileData(uid) {
  try {
    var snap = await getDoc(doc(db, "profiles", uid));
    return snap.exists() ? (snap.data() || {}) : {};
  } catch (error) {
    console.error(error);
    return {};
  }
}

async function saveTask(event) {
  event.preventDefault();
  var title = taskTitleInput ? taskTitleInput.value.trim() : "";
  var points = parseInt(taskPointsInput ? taskPointsInput.value : "10", 10);
  var active = taskActiveInput ? taskActiveInput.checked : true;

  if (!title) {
    alert("Enter a title.");
    return;
  }
  if (isNaN(points) || points <= 0) {
    alert("Enter points.");
    return;
  }

  var payload = {
    title: title,
    points: points,
    active: active,
    updatedAt: serverTimestamp(),
    updatedBy: currentUserData.uid
  };

  if (editingTaskId) {
    await updateDoc(doc(db, "gameTasks", editingTaskId), payload);
  } else {
    payload.createdAt = serverTimestamp();
    payload.createdBy = currentUserData.uid;
    await addDoc(collection(db, "gameTasks"), payload);
  }

  closeTaskModal();
  await loadTasks();
}

function hideSessionCard() {
  if (!sessionCard) return;
  sessionCard.innerHTML = "<p class=\"muted-text\">Admins / organizers / VPs only.</p>";
}

function setupTaskModalClose() {
  var nodes = document.querySelectorAll("[data-task-close]");
  nodes.forEach(function (node) {
    node.addEventListener("click", function () {
      closeTaskModal();
    });
  });
}

onAuthStateChanged(auth, function (user) {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  getCurrentUserData()
    .then(async function (data) {
      currentUserData = data;
      var profileData = await getCurrentProfileData(data.uid);
      var isVp = profileData.rank === "vp";
      canManageGames = data.systemRole === "admin" || data.systemRole === "organizer" || isVp;

      if (addTaskButton) {
        if (!canManageGames) {
          addTaskButton.remove();
        } else {
          addTaskButton.hidden = false;
          addTaskButton.addEventListener("click", function () {
            openTaskModal();
          });
        }
      }

      if (!canManageGames) {
        hideSessionCard();
      }

      setupTaskModalClose();

      if (taskForm) {
        taskForm.addEventListener("submit", saveTask);
      }

      if (sessionSubmitButton) {
        sessionSubmitButton.addEventListener("click", function () {
          giveSessionPoints().catch(function (error) {
            console.error(error);
            alert(error.message);
          });
        });
      }

      await loadCompletions();
      await loadTasks();
      await loadUserDirectory();
    })
    .catch(function (error) {
      console.error(error);
    })
    .finally(function () {
      if (gamesLoading) {
        gamesLoading.style.display = "none";
      }
    });
});

wireTabs();
