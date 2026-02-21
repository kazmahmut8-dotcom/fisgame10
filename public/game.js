const socket = io("http://localhost:3000"); // replace with Replit URL later
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = innerWidth; canvas.height = innerHeight;

let myId, players = {}, planktons = [];
let camera = { x: 0, y: 0 }, mouse = { x: 0, y: 0 };
let keys = {}, inGame = false;
let stormActive = false, tideOffset = 0;

spawnBtn.onclick = () => {
  socket.emit("join", nameInput.value);
  menu.style.display = "none";
  inGame = true;
};

respawnBtn.onclick = () => {
  socket.emit("respawn");
  deathScreen.style.display = "none";
};

socket.on("init", data => { myId = data.id; players = data.players; planktons = data.planktons; });
socket.on("state", data => {
  players = data.players;
  planktons = data.planktons;
  stormActive = data.stormActive;
  tideOffset = data.tideOffset;

  const me = players[myId];
  if (me && me.dead) deathScreen.style.display = "block";

  // Leaderboard
  leaderboard.innerHTML = "<b>Top Players</b><br>";
  data.leaderboard.forEach(p => { leaderboard.innerHTML += p.name + " - " + p.xp + " XP<br>"; });
});

document.addEventListener("mousemove", e => { mouse.x = e.clientX; mouse.y = e.clientY; });
document.addEventListener("keydown", e => { keys[e.key] = true; if (e.key === " ") socket.emit("attack"); });
document.addEventListener("keyup", e => keys[e.key] = false);

function update() {
  const p = players[myId];
  if (!p || p.dead) return;

  const angle = Math.atan2(mouse.y - canvas.height / 2, mouse.x - canvas.width / 2);
  p.rotation = angle;

  if (keys["w"]) { p.x += Math.cos(angle) * 5; p.y += Math.sin(angle) * 5; }

  camera.x = p.x - canvas.width / 2;
  camera.y = p.y - canvas.height / 2;

  planktons.forEach(pl => { if (Math.hypot(p.x - pl.x, p.y - pl.y) < 40) socket.emit("eatPlankton", pl.id); });

  socket.emit("update", p);

  hpBar.style.width = p.hp * 2 + "px";
  xpBar.style.width = (p.xp % 250) * 1.2 + "px";
  oxygenBar.style.width = p.oxygen * 2 + "px";
}

function drawBiome(y) {
  const adjustedY = y + tideOffset;
  if (adjustedY < 5000) ctx.fillStyle = "#bdefff";
  else if (adjustedY < 10000) ctx.fillStyle = "#0077aa";
  else if (adjustedY < 15000) ctx.fillStyle = "#335533";
  else if (adjustedY < 20000) ctx.fillStyle = "#000022";
  else ctx.fillStyle = "#552200";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (stormActive) {
    ctx.fillStyle = "rgba(50,50,50,0.3)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function render() {
  const p = players[myId];
  if (!p || !inGame) return;

  drawBiome(p.y);

  ctx.font = "20px Arial";

  planktons.forEach(pl => ctx.fillText("🟢", pl.x - camera.x, pl.y - camera.y));

  for (let id in players) {
    const pl = players[id];
    ctx.save();
    ctx.translate(pl.x - camera.x, pl.y - camera.y);
    ctx.rotate(pl.rotation);
    ctx.fillText("🐟", 0, 0);
    ctx.restore();
    ctx.fillText(pl.name + " (" + pl.species + ") Lv." + pl.level, pl.x - camera.x - 40, pl.y - camera.y - 30);
  }
}

function loop() { update(); render(); requestAnimationFrame(loop); }
loop();
