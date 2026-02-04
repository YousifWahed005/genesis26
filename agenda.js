import { auth, db, onAuthStateChanged, getCurrentUserData, getOrganizerData } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

var agendaList = document.getElementById("agenda-list");
var organizerTools = document.getElementById("agenda-organizer-tools");
var agendaLoading = document.getElementById("agenda-loading");
var agendaModal = document.getElementById("agenda-modal");
var agendaForm = document.getElementById("agenda-form");
var agendaTopic = document.getElementById("agenda-topic");
var agendaSpeaker = document.getElementById("agenda-speaker");
var agendaChair = document.getElementById("agenda-chair");
var agendaDay = document.getElementById("agenda-day");
var agendaStart = document.getElementById("agenda-start");
var agendaEnd = document.getElementById("agenda-end");
var agendaModalTitle = document.getElementById("agenda-modal-title");
var agendaSubmitButton = document.querySelector(".agenda-submit");
var agendaDeleteButton = document.getElementById("agenda-delete");
var agendaTotalTarget = document.getElementById("agenda-total");
var agendaUpcomingTarget = document.getElementById("agenda-upcoming");
var agendaPastTarget = document.getElementById("agenda-past");
var editingAgendaId = null;
var canEditAgenda = false;

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

function toMinutes(timeValue) {
  if (!timeValue || typeof timeValue !== "string") return null;
  var parts = timeValue.split(":");
  if (parts.length < 2) return null;
  var hours = parseInt(parts[0], 10);
  var minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return (hours * 60) + minutes;
}

function updateAgendaStats(items) {
  if (!agendaTotalTarget || !agendaUpcomingTarget || !agendaPastTarget) {
    return;
  }

  var currentDay = getCurrentAgendaDay();
  var now = new Date();
  var nowMinutes = (now.getHours() * 60) + now.getMinutes();

  var dayItems = items.filter(function (item) {
    return item.day === currentDay;
  });

  var upcomingCount = 0;
  var pastCount = 0;

  dayItems.forEach(function (item) {
    var startMinutes = toMinutes(item.startTime);
    var endMinutes = toMinutes(item.endTime);

    if (endMinutes !== null && nowMinutes > endMinutes) {
      pastCount += 1;
      return;
    }

    if (startMinutes !== null && nowMinutes < startMinutes) {
      upcomingCount += 1;
      return;
    }
  });

  agendaTotalTarget.textContent = String(dayItems.length);
  agendaUpcomingTarget.textContent = String(upcomingCount);
  agendaPastTarget.textContent = String(pastCount);
}

function renderAgenda(items) {
  if (!agendaList) {
    return;
  }

  agendaList.innerHTML = "";
  if (agendaLoading) {
    agendaLoading.style.display = "none";
  }

  if (!items.length) {
    var emptyCard = document.createElement("article");
    emptyCard.className = "agenda-card";
    emptyCard.innerHTML =
      "<div class=\"date-pill\">" +
      "<span class=\"month\">Day</span>" +
      "<span class=\"day\">-</span>" +
      "</div>" +
      "<div class=\"agenda-content\">" +
      "<div class=\"badge-row\">" +
      "<span class=\"badge muted\">No items</span>" +
      "</div>" +
      "<h3>Agenda is empty</h3>" +
      "<div class=\"agenda-details\">" +
      "<div><span class=\"label\">Info:</span> Add the first item</div>" +
      "</div>" +
      "</div>" +
      "<span class=\"chev\">&rsaquo;</span>";
    agendaList.appendChild(emptyCard);
    return;
  }

  items.forEach(function (item, index) {
    var card = document.createElement("article");
    card.className = "agenda-card";
    card.setAttribute("data-id", item.id || "");
    card.style.animationDelay = (index * 60) + "ms";

    var dayLabel = item.day ? String(item.day) : "-";

    card.innerHTML =
      "<div class=\"date-pill\">" +
      "<span class=\"month\">Day</span>" +
      "<span class=\"day\">" + dayLabel + "</span>" +
      "</div>" +
      "<div class=\"agenda-content\">" +
      "<div class=\"badge-row\">" +
      "<span class=\"badge upcoming\">Day " + dayLabel + "</span>" +
      "<span class=\"badge muted\">Session</span>" +
      "</div>" +
      "<h3>" + (item.topic || "Agenda Item") + "</h3>" +
      "<div class=\"agenda-details\">" +
      "<div><span class=\"label\">Time:</span> " + (item.startTime || "--:--") + " - " + (item.endTime || "--:--") + "</div>" +
      "<div><span class=\"label\">Speaker:</span> " + (item.speakerName || "TBD") + "</div>" +
      "<div><span class=\"label\">Chair:</span> " + (item.chair || "TBD") + "</div>" +
      "</div>" +
      "</div>" +
      "<span class=\"chev\">&rsaquo;</span>";

    if (canEditAgenda) {
      card.addEventListener("click", function () {
        openAgendaModal(item);
      });
    }

    agendaList.appendChild(card);
  });
}

function fetchAgenda() {
  var agendaQuery = query(
    collection(db, "agenda"),
    orderBy("day"),
    orderBy("startTime")
  );

  return getDocs(agendaQuery).then(function (snapshot) {
    var items = [];
    snapshot.forEach(function (docSnap) {
      var data = docSnap.data() || {};
      items.push({
        id: docSnap.id,
        speakerName: data.speakerName || "",
        topic: data.topic || "",
        chair: data.chair || "",
        day: data.day || null,
        startTime: data.startTime || "",
        endTime: data.endTime || ""
      });
    });
    updateAgendaStats(items);
    renderAgenda(items);
  });
}

function showOrganizerTools(user) {
  if (!organizerTools) {
    return;
  }

  organizerTools.hidden = false;
  organizerTools.innerHTML = "";
  canEditAgenda = true;

  var button = document.createElement("button");
  button.type = "button";
  button.className = "badge";
  button.textContent = "Add Agenda Item";

  button.addEventListener("click", function () {
    openAgendaModal();
  });

  organizerTools.appendChild(button);

  if (agendaForm) {
    agendaForm.onsubmit = function (event) {
      event.preventDefault();
      submitAgenda(user);
    };
  }

  var closes = document.querySelectorAll("[data-modal-close]");
  closes.forEach(function (node) {
    node.addEventListener("click", function () {
      closeAgendaModal();
    });
  });
}

onAuthStateChanged(auth, function (user) {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  if (agendaLoading) {
    agendaLoading.style.display = "block";
  }

  getCurrentUserData()
    .then(function (data) {
      console.log("UID:", data.uid);
      console.log("systemRole:", data.systemRole);
      if (data.systemRole === "organizer" || data.systemRole === "admin") {
        showOrganizerTools(user);
      }
      return getOrganizerData(data.uid).then(function (orgData) {
        if (orgData) {
          console.log("councilRole:", orgData.councilRole || "n/a");
        }
        return fetchAgenda();
      });
    })
    .catch(function (error) {
      console.error(error);
      alert(error.message);
    });
});

function closeAgendaModal() {
  if (!agendaModal) {
    return;
  }
  agendaModal.hidden = true;
  editingAgendaId = null;
  if (agendaForm) {
    agendaForm.reset();
  }
  if (agendaDeleteButton) {
    agendaDeleteButton.hidden = true;
    agendaDeleteButton.disabled = false;
  }
}

function openAgendaModal(item) {
  if (!agendaModal) {
    return;
  }
  if (item && item.id) {
    editingAgendaId = item.id;
    if (agendaModalTitle) {
      agendaModalTitle.textContent = "Edit Agenda Item";
    }
    if (agendaSubmitButton) {
      agendaSubmitButton.textContent = "Save";
    }
    if (agendaDeleteButton) {
      agendaDeleteButton.hidden = false;
      agendaDeleteButton.disabled = false;
    }
    if (agendaTopic) {
      agendaTopic.value = item.topic || "";
    }
    if (agendaSpeaker) {
      agendaSpeaker.value = item.speakerName || "";
    }
    if (agendaChair) {
      agendaChair.value = item.chair || "";
    }
    if (agendaDay) {
      agendaDay.value = item.day || "";
    }
    if (agendaStart) {
      agendaStart.value = item.startTime || "";
    }
    if (agendaEnd) {
      agendaEnd.value = item.endTime || "";
    }
  } else {
    editingAgendaId = null;
    if (agendaForm) {
      agendaForm.reset();
    }
    if (agendaModalTitle) {
      agendaModalTitle.textContent = "Add Agenda Item";
    }
    if (agendaSubmitButton) {
      agendaSubmitButton.textContent = "Add";
    }
    if (agendaDeleteButton) {
      agendaDeleteButton.hidden = true;
      agendaDeleteButton.disabled = false;
    }
  }
  agendaModal.hidden = false;
  if (agendaTopic) {
    agendaTopic.focus();
  }
}

function submitAgenda(user) {
  var topic = agendaTopic ? agendaTopic.value.trim() : "";
  var speakerName = agendaSpeaker ? agendaSpeaker.value.trim() : "";
  var chair = agendaChair ? agendaChair.value.trim() : "";
  var day = agendaDay ? parseInt(agendaDay.value, 10) : 0;
  var startTime = agendaStart ? agendaStart.value : "";
  var endTime = agendaEnd ? agendaEnd.value : "";

  if (!topic || !speakerName || !chair || !day || day < 1 || day > 3 || !startTime || !endTime) {
    alert("Please fill in all fields correctly.");
    return;
  }

  var payload = {
    speakerName: speakerName,
    topic: topic,
    chair: chair,
    day: day,
    startTime: startTime,
    endTime: endTime,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  };

  var writePromise;
  if (editingAgendaId) {
    writePromise = updateDoc(doc(db, "agenda", editingAgendaId), payload);
  } else {
    payload.createdAt = serverTimestamp();
    writePromise = addDoc(collection(db, "agenda"), payload);
  }

  writePromise
    .then(function () {
      closeAgendaModal();
      return fetchAgenda();
    })
    .catch(function (error) {
      console.error(error);
      alert(error.message);
    });
}

function deleteAgendaItem() {
  if (!editingAgendaId) {
    return;
  }

  if (!confirm("Delete this agenda item?")) {
    return;
  }

  if (agendaDeleteButton) {
    agendaDeleteButton.disabled = true;
  }

  deleteDoc(doc(db, "agenda", editingAgendaId))
    .then(function () {
      closeAgendaModal();
      return fetchAgenda();
    })
    .catch(function (error) {
      console.error(error);
      alert(error.message);
      if (agendaDeleteButton) {
        agendaDeleteButton.disabled = false;
      }
    });
}

if (agendaDeleteButton) {
  agendaDeleteButton.addEventListener("click", function () {
    deleteAgendaItem();
  });
}


