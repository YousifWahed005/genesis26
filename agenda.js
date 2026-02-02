import { auth, db, onAuthStateChanged, getCurrentUserData, getOrganizerData } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc
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
var editingAgendaId = null;
var canEditAgenda = false;

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


