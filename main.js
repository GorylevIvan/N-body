import init, { NBodyEngine } from "./rust-engine/pkg/rust_engine.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const resetBtn = document.getElementById("resetBtn");
const installBtn = document.getElementById("installBtn");

const bodiesInput = document.getElementById("bodiesInput");
const spawnMode = document.getElementById("spawnMode");

const iterationsRange = document.getElementById("iterationsRange");
const gravityRange = document.getElementById("gravityRange");
const dtRange = document.getElementById("dtRange");
const softRange = document.getElementById("softRange");
const bounceRange = document.getElementById("bounceRange");
const trailRange = document.getElementById("trailRange");
const radiusRange = document.getElementById("radiusRange");

const iterationsValue = document.getElementById("iterationsValue");
const gravityValue = document.getElementById("gravityValue");
const dtValue = document.getElementById("dtValue");
const softValue = document.getElementById("softValue");
const bounceValue = document.getElementById("bounceValue");
const trailValue = document.getElementById("trailValue");
const radiusValue = document.getElementById("radiusValue");

const statusStat = document.getElementById("statusStat");
const fpsStat = document.getElementById("fpsStat");
const bodiesStat = document.getElementById("bodiesStat");
const physicsStat = document.getElementById("physicsStat");
const kineticStat = document.getElementById("kineticStat");
const totalEnergyStat = document.getElementById("totalEnergyStat");
const swStat = document.getElementById("swStat");
const modeStat = document.getElementById("modeStat");

let engine = null;
let running = false;
let rafId = null;
let deferredPrompt = null;

let fpsCounter = 0;
let fpsLastTime = performance.now();
let currentFPS = 0;

function syncLabels() {
  iterationsValue.textContent = iterationsRange.value;
  gravityValue.textContent = gravityRange.value;
  dtValue.textContent = Number(dtRange.value).toFixed(3);
  softValue.textContent = softRange.value;
  bounceValue.textContent = Number(bounceRange.value).toFixed(2);
  trailValue.textContent = Number(trailRange.value).toFixed(2);
  radiusValue.textContent = Number(radiusRange.value).toFixed(1);
  modeStat.textContent = spawnMode.value;
}

function getSettings() {
  return {
    n: Math.max(10, Math.min(3000, Number(bodiesInput.value) || 400)),
    mode: spawnMode.value,
    iterations: Number(iterationsRange.value),
    g: Number(gravityRange.value),
    dt: Number(dtRange.value),
    softening: Number(softRange.value),
    bounce: Number(bounceRange.value),
    trail: Number(trailRange.value),
    baseRadius: Number(radiusRange.value),
  };
}

function applyEngineParams() {
  if (!engine) return;
  const s = getSettings();
  engine.set_params(s.g, s.dt, s.softening, s.bounce);
}

function createEngine() {
  const s = getSettings();
  engine = new NBodyEngine(s.n, canvas.width, canvas.height);
  engine.set_params(s.g, s.dt, s.softening, s.bounce);

  if (s.mode === "random") {
    engine.reset_random();
  } else {
    engine.reset_disk();
  }

  bodiesStat.textContent = String(s.n);
  statusStat.textContent = "ready";
  drawFrame(true);
}

function stop() {
  running = false;
  statusStat.textContent = "stopped";
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function start() {
  if (!engine) createEngine();
  if (running) return;
  running = true;
  statusStat.textContent = "running";
  loop();
}

function resetScene() {
  stop();
  createEngine();
}

function clearCanvasHard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawFrame(forceClear = false) {
  if (!engine) return;

  const s = getSettings();
  const snapshot = engine.snapshot();

  if (forceClear || s.trail <= 0.001) {
    clearCanvasHard();
  } else {
    const alpha = Math.max(0.02, Math.min(1, s.trail));
    ctx.fillStyle = `rgba(2, 6, 23, ${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  for (let i = 0; i < snapshot.length; i += 4) {
    const x = snapshot[i];
    const y = snapshot[i + 1];
    const mass = snapshot[i + 2];
    const speed = snapshot[i + 3];

    const radius = s.baseRadius + Math.sqrt(mass) * 0.55;
    const hue = Math.max(180, 240 - Math.min(180, speed * 28));
    const lightness = 65 + Math.min(20, mass * 2.2);

    ctx.beginPath();
    ctx.fillStyle = `hsl(${hue}, 90%, ${lightness}%)`;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  kineticStat.textContent = engine.kinetic_energy().toFixed(2);
  totalEnergyStat.textContent = engine.total_energy().toFixed(2);
}

function loop() {
  if (!running || !engine) return;

  const s = getSettings();

  const t0 = performance.now();
  engine.step_many(s.iterations);
  const t1 = performance.now();

  drawFrame(false);

  physicsStat.textContent = `${(t1 - t0).toFixed(3)} ms`;

  fpsCounter++;
  const now = performance.now();
  if (now - fpsLastTime >= 1000) {
    currentFPS = fpsCounter;
    fpsCounter = 0;
    fpsLastTime = now;
    fpsStat.textContent = String(currentFPS);
  }

  rafId = requestAnimationFrame(loop);
}

function setupRangeListeners() {
  [
    iterationsRange,
    gravityRange,
    dtRange,
    softRange,
    bounceRange,
    trailRange,
    radiusRange,
  ].forEach((el) => {
    el.addEventListener("input", () => {
      syncLabels();
      applyEngineParams();
    });
  });

  spawnMode.addEventListener("change", syncLabels);
}

function resizeCanvasToDisplaySize() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(600, Math.floor(rect.width));
  const height = Math.floor(width * 0.7);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;

    if (engine) {
      engine.resize_world(canvas.width, canvas.height);
      drawFrame(true);
    }
  }
}

async function registerSW() {
  if (!("serviceWorker" in navigator)) {
    swStat.textContent = "unsupported";
    return;
  }

  try {
    const reg = await navigator.serviceWorker.register("./sw.js");
    swStat.textContent = reg.active ? "active" : "registered";
  } catch (err) {
    console.error(err);
    swStat.textContent = "error";
  }
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installBtn.hidden = false;
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });
}

async function boot() {
  statusStat.textContent = "loading wasm...";
  syncLabels();
  await init();

  resizeCanvasToDisplaySize();
  createEngine();

  setupRangeListeners();
  setupInstallPrompt();

  startBtn.addEventListener("click", start);
  stopBtn.addEventListener("click", stop);
  resetBtn.addEventListener("click", resetScene);

  window.addEventListener("resize", () => {
    resizeCanvasToDisplaySize();
  });

  await registerSW();

  statusStat.textContent = "ready";
}

boot();