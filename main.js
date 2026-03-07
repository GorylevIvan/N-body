import init, { NBodyEngine } from "./rust-engine/pkg/rust_engine.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const resetBtn = document.getElementById("resetBtn");
const bodiesSelect = document.getElementById("bodiesSelect");
const iterSelect = document.getElementById("iterSelect");

const statusEl = document.getElementById("status");
const bodiesStatEl = document.getElementById("bodiesStat");
const fpsStatEl = document.getElementById("fpsStat");
const physicsStatEl = document.getElementById("physicsStat");
const energyStatEl = document.getElementById("energyStat");
const swStatEl = document.getElementById("swStat");

let engine = null;
let running = false;
let frameId = null;
let lastFpsTime = performance.now();
let frames = 0;
let currentFps = 0;

function createEngine() {
  const n = Number(bodiesSelect.value);
  engine = new NBodyEngine(n, canvas.width, canvas.height);
  engine.set_params(35.0, 0.016, 6.0);
  bodiesStatEl.textContent = String(n);
  statusEl.textContent = "ready";
}

function drawBodies(positions) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < positions.length; i += 2) {
    const x = positions[i];
    const y = positions[i + 1];

    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function animate() {
  if (!running || !engine) return;

  const iterations = Number(iterSelect.value);

  const t0 = performance.now();
  engine.step_many(iterations);
  const t1 = performance.now();

  const positions = engine.positions();
  drawBodies(positions);

  physicsStatEl.textContent = (t1 - t0).toFixed(3);
  energyStatEl.textContent = engine.total_kinetic_energy().toFixed(3);

  frames++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    currentFps = frames;
    frames = 0;
    lastFpsTime = now;
    fpsStatEl.textContent = String(currentFps);
  }

  frameId = requestAnimationFrame(animate);
}

function start() {
  if (!engine) createEngine();
  if (running) return;
  running = true;
  statusEl.textContent = "running";
  animate();
}

function stop() {
  running = false;
  statusEl.textContent = "stopped";
  if (frameId !== null) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }
}

function reset() {
  stop();
  createEngine();
  drawBodies(engine.positions());
}

startBtn.addEventListener("click", start);
stopBtn.addEventListener("click", stop);
resetBtn.addEventListener("click", reset);

bodiesSelect.addEventListener("change", () => {
  reset();
});

async function registerSW() {
  if (!("serviceWorker" in navigator)) {
    swStatEl.textContent = "unsupported";
    return;
  }

  try {
    const reg = await navigator.serviceWorker.register("./sw.js");
    swStatEl.textContent = reg.active ? "active" : "registered";
  } catch (err) {
    console.error(err);
    swStatEl.textContent = "error";
  }
}

async function boot() {
  statusEl.textContent = "loading wasm...";
  await init();
  createEngine();
  drawBodies(engine.positions());
  statusEl.textContent = "ready";
  await registerSW();
}

boot();