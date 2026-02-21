const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.static("../public"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const MAP_SIZE = 25000;
const MAX_LEVEL = 12;
const RESPAWN_TIME = 3000;

let players = {};
let planktons = [];

let stormActive = false;
let tideOffset = 0;
let tideDirection = 1;

/* ---------------- BIOMES ---------------- */

function getBiome(y) {
  const adjustedY = y + tideOffset;
  if (adjustedY < 5000) return "Arctic";
  if (adjustedY < 10000) return "Sea";
  if (adjustedY < 15000) return "Swamp";
  if (adjustedY < 20000) return "Deep";
  return "Volcano";
}

/* ---------------- CURRENTS ---------------- */

function getCurrentForce(x, y) {
  if (stormActive) return { x: (Math.random() - 0.5) * 3, y: (Math.random() - 0.5) * 3 };
  return { x: Math.sin(y / 500) * 0.5, y: Math.cos(x / 500) * 0.5 };
}

/* ---------------- STORM SYSTEM ---------------- */

function triggerStorm() {
  stormActive = true;
  console.log("Storm started");
  setTimeout(() => { stormActive = false; console.log("Storm ended"); }, 15000);
}
setInterval(() => { if (!stormActive) triggerStorm(); }, 60000);

/* ---------------- TIDES ---------------- */

setInterval(() => {
  tideOffset += tideDirection * 50;
  if (tideOffset > 1000 || tideOffset < -1000) tideDirection *= -1;
}, 3000);

/* ---------------- SPECIES ---------------- */

const fishSpecies = [
"Anchovy","Angelfish","Barracuda","Betta","Blue Tang","Butterflyfish","Carp","Catfish","Clownfish","Cod",
"Dolphinfish","Eel","Flounder","Goby","Goldfish","Grouper","Guppy","Halibut","Herring","Koi",
"Lionfish","Mackerel","Mahi-Mahi","Minnow","Molly","Moray Eel","Neon Tetra","Oscar","Perch","Pike",
"Piranha","Pleco","Pufferfish","Rainbowfish","Salmon","Sardine","Seahorse","Shark","Snapper","Swordfish",
"Tetra","Tilapia","Trout","Tuna","Wrasse","Yellowtail","Zebrafish","Stingray","Marlin","Anglerfish"
];

function levelFromXP(xp) { return Math.min(MAX_LEVEL, Math.floor(xp / 250) + 1); }
function speciesForLevel(level) { return fishSpecies[Math.floor((level - 1) / 12 * 50)]; }

/* ---------------- WORLD ---------------- */

for (let i = 0; i < 800; i++) {
  planktons.push({ id: i, x: Math.random() * MAP_SIZE, y: Math.random() * MAP_SIZE });
}

/* ---------------- CONNECTION ---------------- */

io.on("connection", socket => {

  socket.on("join", name => {
    players[socket.id] = {
      id: socket.id,
      name: name || "A player" + Math.floor(Math.random() * 9999),
      x: Math.random() * MAP_SIZE,
      y: Math.random() * MAP_SIZE,
      hp: 100,
      xp: 0,
      level: 1,
      species: "Anchovy",
      rotation: 0,
      oxygen: 100,
      dead: false
    };
    socket.emit("init", { id: socket.id, players, planktons });
  });

  socket.on("update", data => {
    let p = players[socket.id];
    if (!p || p.dead) return;
    p.x = data.x; p.y = data.y; p.rotation = data.rotation;
  });

  socket.on("eatPlankton", id => {
    let index = planktons.findIndex(p => p.id === id);
    if (index !== -1) {
      planktons.splice(index, 1);
      let p = players[socket.id];
      p.xp += 30;
      p.level = levelFromXP(p.xp);
      p.species = speciesForLevel(p.level);
    }
  });

  socket.on("respawn", () => {
    let p = players[socket.id];
    if (!p) return;
    p.hp = 100;
    p.dead = false;
    p.x = Math.random() * MAP_SIZE;
    p.y = Math.random() * MAP_SIZE;
    p.oxygen = 100;
  });

  socket.on("disconnect", () => { delete players[socket.id]; });
});

/* ---------------- GAME LOOP ---------------- */

setInterval(() => {
  for (let id in players) {
    let p = players[id];
    if (p.dead) continue;

    const biome = getBiome(p.y);

    /* Currents */
    const force = getCurrentForce(p.x, p.y);
    p.x += force.x; p.y += force.y;

    /* Volcano damage */
    if (biome === "Volcano") p.hp -= 0.3;

    /* Arctic cold */
    if (biome === "Arctic" && p.level < 4) p.hp -= 0.05;

    /* Deep oxygen */
    if (biome === "Deep") { p.oxygen -= 0.3; if (p.oxygen <= 0) p.hp -= 0.6; } 
    else { p.oxygen = Math.min(100, p.oxygen + 0.5); }

    /* Storm damage */
    if (stormActive) p.hp -= 0.05;

    if (p.hp <= 0) {
      p.dead = true;
      setTimeout(() => {
        p.hp = 100; p.dead = false;
        p.x = Math.random() * MAP_SIZE; p.y = Math.random() * MAP_SIZE; p.oxygen = 100;
      }, RESPAWN_TIME);
    }
  }

  const leaderboard = Object.values(players)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 5)
    .map(p => ({ name: p.name, xp: p.xp }));

  io.emit("state", { players, planktons, leaderboard, stormActive, tideOffset });
}, 1000 / 30);

server.listen(3000, () => console.log("Server running on port 3000"));
