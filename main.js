import init, { NBodyEngine } from "./rust-engine/pkg/rust_engine.js";

const DEFAULTS = {
  n: 400,
  preset: "galaxy",
  iterations: 2,
  g: 30,
  dt: 0.016,
  softening: 8,
  bounce: 0.85,
  trail: 0.12,
  baseRadius: 1.6,
  glow: 0.65,
};

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const resetBtn = document.getElementById("resetBtn");
const defaultsBtn = document.getElementById("defaultsBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const installBtn = document.getElementById("installBtn");

const presetSelect = document.getElementById("presetSelect");
const bodiesInput = document.getElementById("bodiesInput");

const iterationsRange = document.getElementById("iterationsRange");
const gravityRange = document.getElementById("gravityRange");
const dtRange = document.getElementById("dtRange");
const softRange = document.getElementById("softRange");
const bounceRange = document.getElementById("bounceRange");
const trailRange = document.getElementById("trailRange");
const radiusRange = document.getElementById("radiusRange");
const glowRange = document.getElementById("glowRange");

const iterationsValue = document.getElementById("iterationsValue");
const gravityValue = document.getElementById("gravityValue");
const dtValue = document.getElementById("dtValue");
const softValue = document.getElementById("softValue");
const bounceValue = document.getElementById("bounceValue");
const trailValue = document.getElementById("trailValue");
const radiusValue = document.getElementById("radiusValue");
const glowValue = document.getElementById("glowValue");

const statusStat = document.getElementById("statusStat");
const fpsStat = document.getElementById("fpsStat");
const bodiesStat = document.getElementById("bodiesStat");
const physicsStat = document.getElementById("physicsStat");
const kineticStat = document.getElementById("kineticStat");
const totalEnergyStat = document.getElementById("totalEnergyStat");
const swStat = document.getElementById("swStat");
const presetStat = document.getElementById("presetStat");

let engine = null;
let running = false;
let rafId = null;
let deferredPrompt = null;

let fpsCounter = 0;
let fpsLastTime = performance.now();

function applyDefaultsToControls() {
  bodiesInput.value = DEFAULTS.n;
  presetSelect.value = DEFAULTS.preset;
  iterationsRange.value = DEFAULTS.iterations;
  gravityRange.value = DEFAULTS.g;
  dtRange.value = DEFAULTS.dt;
  softRange.value = DEFAULTS.softening;
  bounceRange.value = DEFAULTS.bounce;
  trailRange.value = DEFAULTS.trail;
  radiusRange.value = DEFAULTS.baseRadius;
  glowRange.value = DEFAULTS.glow;
  syncLabels();
}

function syncLabels() {
  iterationsValue.textContent = iterationsRange.value;
  gravityValue.textContent = gravityRange.value;
  dtValue.textContent = Number(dtRange.value).toFixed(3);
  softValue.textContent = softRange.value;
  bounceValue.textContent = Number(bounceRange.value).toFixed(2);
  trailValue.textContent = Number(trailRange.value).toFixed(2);
  radiusValue.textContent = Number(radiusRange.value).toFixed(1);
  glowValue.textContent = Number(glowRange.value).toFixed(2);
  presetStat.textContent = presetSelect.value;
}

function getSettings() {
  return {
    n: Math.max(10, Math.min(3000, Number(bodiesInput.value) || DEFAULTS.n)),
    preset: presetSelect.value,
    iterations: Number(iterationsRange.value),
    g: Number(gravityRange.value),
    dt: Number(dtRange.value),
    softening: Number(softRange.value),
    bounce: Number(bounceRange.value),
    trail: Number(trailRange.value),
    baseRadius: Number(radiusRange.value),
    glow: Number(glowRange.value),
  };
}

function applyPreset() {
  if (!engine) return;
  const s = getSettings();

  switch (s.preset) {
    case "collapse":
      engine.reset_collapse();
      break;
    case "explosion":
      engine.reset_explosion();
      break;
    case "two-galaxies":
      engine.reset_two_galaxies();
      break;
    case "galaxy":
    default:
      engine.reset_galaxy();
      break;
  }
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
  applyPreset();

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

function resetToDefaults() {
  stop();
  applyDefaultsToControls();
  createEngine();
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      fullscreenBtn.textContent = "Exit Fullscreen";
    } else {
      await document.exitFullscreen();
      fullscreenBtn.textContent = "Fullscreen";
    }
  } catch (err) {
    console.error(err);
  }
}

function clearCanvasHard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawBackgroundGlow(glowStrength) {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, `rgba(40, 60, 120, ${0.03 * glowStrength})`);
  gradient.addColorStop(0.5, `rgba(20, 20, 40, ${0.02 * glowStrength})`);
  gradient.addColorStop(1, `rgba(80, 40, 120, ${0.03 * glowStrength})`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function getGalaxyStyle(mass, speed, settings) {
  const massNorm = Math.min(1, mass / 7.0);
  const speedNorm = Math.min(1, speed / 6.0);

  const hue = 220 - massNorm * 175;
  const saturation = 55 + speedNorm * 35 + massNorm * 10;
  const lightness = 48 + speedNorm * 18 + massNorm * 22;
  const alpha = 0.72 + speedNorm * 0.18;

  const radius = settings.baseRadius + Math.sqrt(mass) * 0.6;
  const glowAlpha = 0.05 + massNorm * 0.12 + speedNorm * 0.08;

  return {
    fill: `hsla(${hue}, ${Math.min(100, saturation)}%, ${Math.min(90, lightness)}%, ${Math.min(1, alpha)})`,
    glow: `hsla(${hue}, ${Math.min(100, saturation)}%, ${Math.min(96, lightness + 8)}%, ${Math.min(0.35, glowAlpha * settings.glow)})`,
    radius,
    glowRadius: radius * (1.8 + settings.glow * 1.4),
  };
}

function drawFrame(forceClear = false) {
  if (!engine) return;

  const s = getSettings();
  const snapshot = engine.snapshot();

  if (forceClear || s.trail <= 0.001) {
    clearCanvasHard();
  } else {
    ctx.fillStyle = `rgba(2, 6, 23, ${Math.max(0.02, Math.min(1, s.trail))})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawBackgroundGlow(s.glow);

  for (let i = 0; i < snapshot.length; i += 4) {
    const x = snapshot[i];
    const y = snapshot[i + 1];
    const mass = snapshot[i + 2];
    const speed = snapshot[i + 3];

    const style = getGalaxyStyle(mass, speed, s);

    ctx.beginPath();
    ctx.fillStyle = style.glow;
    ctx.arc(x, y, style.glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = style.fill;
    ctx.arc(x, y, style.radius, 0, Math.PI * 2);
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
    fpsStat.textContent = String(fpsCounter);
    fpsCounter = 0;
    fpsLastTime = now;
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
    glowRange,
  ].forEach((el) => {
    el.addEventListener("input", () => {
      syncLabels();
      applyEngineParams();
      drawFrame(false);
    });
  });

  presetSelect.addEventListener("change", syncLabels);
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
  applyDefaultsToControls();
  await init();

  resizeCanvasToDisplaySize();
  createEngine();

  setupRangeListeners();
  setupInstallPrompt();

  startBtn.addEventListener("click", start);
  stopBtn.addEventListener("click", stop);
  resetBtn.addEventListener("click", resetScene);
  defaultsBtn.addEventListener("click", resetToDefaults);
  fullscreenBtn.addEventListener("click", toggleFullscreen);

  document.addEventListener("fullscreenchange", () => {
    fullscreenBtn.textContent = document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen";
    setTimeout(() => {
      resizeCanvasToDisplaySize();
      drawFrame(true);
    }, 50);
  });

  window.addEventListener("resize", () => {
    resizeCanvasToDisplaySize();
  });

  await registerSW();
  statusStat.textContent = "ready";
}

boot();
