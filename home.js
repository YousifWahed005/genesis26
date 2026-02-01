import("./roles.js").then(function (roles) {
  return roles.requireAuth().then(function (user) {
    if (!user) {
      window.location.href = "index.html";
    }
  });
});

var session = JSON.parse(localStorage.getItem("genesisSession") || "{}");
var name = session.name || "Adventurer";
var nameTarget = document.getElementById("user-name");
if (nameTarget) {
  nameTarget.textContent = name;
}
