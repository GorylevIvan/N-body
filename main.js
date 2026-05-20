import init, { NBodyEngine } from "./rust-engine/pkg/rust_engine.js";
import * as THREE from "three";
import { supabase } from "./supabaseClient.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

const MAX_BODIES = 50000;
const WORLD_WIDTH = 1800;
const WORLD_HEIGHT = 1200;
const WORLD_DEPTH = 1800;

const DEFAULTS = {
  n: 400,
  preset: "galaxy",
  performancePreset: "custom",
  solver: "barnes_hut",
  iterations: 1,
  g: 30,
  dt: 0.008,
  softening: 8,
  bounce: 0.85,
  trail: 0.45,
  radiusScale: 4.5,
  glow: 1.4,
  bloom: 1.8,
  visualMode: "bright",
};

const PERFORMANCE_PRESETS = {
  light: {
    n: 300,
    solver: "barnes_hut",
    iterations: 1,
    g: 24,
    dt: 0.006,
    softening: 12,
    trail: 0.25,
    radiusScale: 3.8,
    glow: 1.0,
    bloom: 1.2,
    visualMode: "normal",
  },

  balanced: {
    n: 1000,
    solver: "barnes_hut",
    iterations: 1,
    g: 30,
    dt: 0.008,
    softening: 8,
    trail: 0.45,
    radiusScale: 4.5,
    glow: 1.4,
    bloom: 1.8,
    visualMode: "bright",
  },

  quality: {
    n: 2500,
    solver: "barnes_hut",
    iterations: 1,
    g: 34,
    dt: 0.007,
    softening: 9,
    trail: 0.55,
    radiusScale: 5.0,
    glow: 1.7,
    bloom: 2.3,
    visualMode: "cinematic",
  },

  high: {
    n: 8000,
    solver: "barnes_hut",
    iterations: 1,
    g: 26,
    dt: 0.006,
    softening: 14,
    trail: 0.0,
    radiusScale: 3.1,
    glow: 1.25,
    bloom: 1.45,
    visualMode: "bright",
  },

  stress: {
    n: 10000,
    solver: "barnes_hut",
    iterations: 10,
    g: 26,
    dt: 0.006,
    softening: 14,
    trail: 0.0,
    radiusScale: 2.8,
    glow: 1.2,
    bloom: 1.3,
    visualMode: "bright",
  },

  "direct-test": {
    n: 800,
    solver: "direct",
    iterations: 1,
    g: 26,
    dt: 0.006,
    softening: 10,
    trail: 0.25,
    radiusScale: 4.0,
    glow: 1.2,
    bloom: 1.5,
    visualMode: "normal",
  },
};

const canvas = document.getElementById("canvas");

const fpsCanvas = document.getElementById("fpsCanvas");
const fpsCtx = fpsCanvas.getContext("2d");
const cpuCanvas = document.getElementById("cpuCanvas");
const cpuCtx = cpuCanvas.getContext("2d");
const cpuLoadValue = document.getElementById("cpuLoadValue");
const energyCanvas = document.getElementById("energyCanvas");
const energyCtx = energyCanvas.getContext("2d");
const energyDriftValue = document.getElementById("energyDriftValue");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const saveResultBtn = document.getElementById("saveResultBtn");
const fullscreenStartBtn = document.getElementById("fullscreenStartBtn");
const fullscreenPauseBtn = document.getElementById("fullscreenPauseBtn");
const fullscreenResetBtn = document.getElementById("fullscreenResetBtn");

const fullscreenFpsValue = document.getElementById("fullscreenFpsValue");
const fullscreenCpuValue = document.getElementById("fullscreenCpuValue");
const fullscreenEnergyValue = document.getElementById("fullscreenEnergyValue");
const defaultsBtn = document.getElementById("defaultsBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");

const presetSelect = document.getElementById("presetSelect");
const solverSelect = document.getElementById("solverSelect");
const solverWarning = document.getElementById("solverWarning");
const bodiesInput = document.getElementById("bodiesInput");
const visualModeSelect = document.getElementById("visualModeSelect");
const performancePresetSelect = document.getElementById("performancePresetSelect");

const iterationsRange = document.getElementById("iterationsRange");
const gravityRange = document.getElementById("gravityRange");
const dtRange = document.getElementById("dtRange");
const softRange = document.getElementById("softRange");
//const bounceRange = document.getElementById("bounceRange");
const trailRange = document.getElementById("trailRange");
const radiusRange = document.getElementById("radiusRange");
const glowRange = document.getElementById("glowRange");
const bloomRange = document.getElementById("bloomRange");

const iterationsValue = document.getElementById("iterationsValue");
const gravityValue = document.getElementById("gravityValue");
const dtValue = document.getElementById("dtValue");
const softValue = document.getElementById("softValue");
//const bounceValue = document.getElementById("bounceValue");
const trailValue = document.getElementById("trailValue");
const radiusValue = document.getElementById("radiusValue");
const glowValue = document.getElementById("glowValue");
const bloomValue = document.getElementById("bloomValue");

const statusStat = document.getElementById("statusStat");
const fpsBig = document.getElementById("fpsBig");
const bodiesStat = document.getElementById("bodiesStat");
const physicsStat = document.getElementById("physicsStat");
const kineticStat = document.getElementById("kineticStat");
const totalEnergyStat = document.getElementById("totalEnergyStat");
//const swStat = document.getElementById("swStat");
const presetStat = document.getElementById("presetStat");

const solverWarningText = document.getElementById("solverWarningText");
const solverWarningClose = document.getElementById("solverWarningClose");

const solverStat = document.getElementById("solverStat");
const avgPhysicsStat = document.getElementById("avgPhysicsStat");
const energyDriftStat = document.getElementById("energyDriftStat");

const elapsedTimeStat = document.getElementById("elapsedTimeStat");

let engine = null;
let wasmExports = null;

let solverWarningDismissed = false;
let baselineTotalEnergy = null;
let physicsSamples = [];

let running = false;
let physicsRafId = null;
let renderRafId = null;

let scene;
let camera;
let renderer;
let controls;
let composer;
let renderPass;
let bloomPass;

let particleSystem;
let particleGeometry;
let particleMaterial;
let trailSystem;
let trailGeometry;
let trailMaterial;
let backgroundStars;
let particleTexture;

let particlePositions;
let particleColors;
let trailPositions;
let trailColors;
let trailAnchors;

let wasmPositions = null;
let wasmMasses = null;
let wasmSpeeds = null;

let currentBodyCount = DEFAULTS.n;

let simulationStartTime = null;
let elapsedBeforePause = 0;
let currentElapsedSeconds = 0;
let hasBenchmarkStarted = false;

let colorUpdateCounter = 0;
let statsUpdateCounter = 0;
let lastLightStatsUpdate = 0;
let lastHeavyStatsUpdate = 0;
let cachedTotalEnergy = 0;
let cachedEnergyDrift = 0;
let cachedKineticEnergy = 0;
let cachedPhysicsLoad = 0;
let cachedPhysicsMs = 0;

let fpsCounter = 0;
let fpsLastTime = performance.now();
let currentFPS = 0;

let lastFpsGraphUpdate = 0;

const fpsHistory = [];
const TARGET_FRAME_MS = 1000 / 60;
const cpuHistory = [];
const energyDriftHistory = [];

function applyDefaultsToControls() {
  bodiesInput.value = DEFAULTS.n;
  presetSelect.value = DEFAULTS.preset;
  solverSelect.value = DEFAULTS.solver;
  visualModeSelect.value = DEFAULTS.visualMode;
  performancePresetSelect.value = DEFAULTS.performancePreset;
  iterationsRange.value = DEFAULTS.iterations;
  gravityRange.value = DEFAULTS.g;
  dtRange.value = DEFAULTS.dt;
  softRange.value = DEFAULTS.softening;
  //bounceRange.value = DEFAULTS.bounce;
  trailRange.value = DEFAULTS.trail;
  radiusRange.value = DEFAULTS.radiusScale;
  glowRange.value = DEFAULTS.glow;
  bloomRange.value = DEFAULTS.bloom;

  syncLabels();
  syncCustomSelects();
  updateSolverWarning();
}

function syncLabels() {
  iterationsValue.textContent = iterationsRange.value;
  gravityValue.textContent = gravityRange.value;
  dtValue.textContent = Number(dtRange.value).toFixed(3);
  softValue.textContent = softRange.value;
  //bounceValue.textContent = Number(bounceRange.value).toFixed(2);
  trailValue.textContent = Number(trailRange.value).toFixed(2);
  radiusValue.textContent = Number(radiusRange.value).toFixed(1);
  glowValue.textContent = Number(glowRange.value).toFixed(2);
  bloomValue.textContent = Number(bloomRange.value).toFixed(2);
  presetStat.textContent = presetSelect.value;
}

function syncCustomSelects() {
  document.querySelectorAll(".custom-select").forEach((customSelect) => {
    const selectId = customSelect.dataset.selectId;
    const realSelect = document.getElementById(selectId);
    const button = customSelect.querySelector(".custom-select-btn");
    const options = customSelect.querySelectorAll(".custom-select-option");

    if (!realSelect || !button) return;

    const selectedOption = realSelect.options[realSelect.selectedIndex];
    button.textContent = selectedOption ? selectedOption.textContent : "";

    options.forEach((option) => {
      option.classList.toggle(
        "active",
        option.dataset.value === realSelect.value
      );
    });
  });
}

function updateSaveResultButtonState() {
  if (!saveResultBtn) return;

  saveResultBtn.disabled = !hasBenchmarkStarted;

  if (!hasBenchmarkStarted) {
    saveResultBtn.title = "Сначала запустите симуляцию";
    saveResultBtn.classList.add("is-disabled");
  } else {
    saveResultBtn.title = "";
    saveResultBtn.classList.remove("is-disabled");
  }
}

function updateSolverWarning() {
  if (!solverWarning) return;

  const isDirect = solverSelect.value === "direct";
  const count = clampBodiesInput(bodiesInput.value);

  if (isDirect && count >= 1500 && !solverWarningDismissed) {
    solverWarningText.textContent =
      "Для прямого метода большое число тел может снизить производительность.";
    solverWarning.style.display = "block";
  } else {
    solverWarning.style.display = "none";
  }
}

function clampBodiesInput(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULTS.n;
  return Math.max(1, Math.min(MAX_BODIES, Math.round(n)));
}

function getSettings() {
  return {
    n: clampBodiesInput(bodiesInput.value),
    preset: presetSelect.value,
    solver: solverSelect.value,
    visualMode: visualModeSelect.value,
    iterations: Number(iterationsRange.value),
    g: Number(gravityRange.value),
    dt: Number(dtRange.value),
    softening: Number(softRange.value),
    //bounce: Number(bounceRange.value),
    bounce: DEFAULTS.bounce,
    trail: Number(trailRange.value),
    radiusScale: Number(radiusRange.value),
    glow: Number(glowRange.value),
    bloom: Number(bloomRange.value),
  };
}

function createParticleTexture() {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");

  const gradient = g.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );

  gradient.addColorStop(0.0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.30, "rgba(255,255,255,0.98)");
  gradient.addColorStop(0.62, "rgba(255,255,255,0.62)");
  gradient.addColorStop(1.0, "rgba(255,255,255,0)");

  g.clearRect(0, 0, size, size);
  g.fillStyle = gradient;
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  g.fill();

  const texture = new THREE.CanvasTexture(c);
  texture.needsUpdate = true;
  return texture;
}

function createThreeScene() {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050208, 0.00085);

  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 5000);
  camera.position.set(0, 420, 520);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 40, 0);
  controls.minDistance = 80;
  controls.maxDistance = 2200;
  controls.update();

  particleTexture = createParticleTexture();

  addBackgroundStars();
  addSoftLights();
  buildParticleSystem();
  buildPostProcessing();
}

function buildPostProcessing() {
  renderPass = new RenderPass(scene, camera);

  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(1, 1),
    DEFAULTS.bloom,
    0.55,
    0.18
  );

  composer = new EffectComposer(renderer);
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
}

function addSoftLights() {
  const ambient = new THREE.AmbientLight(0xffffff, 0.42);
  scene.add(ambient);

  const light1 = new THREE.PointLight(0xffd86b, 1.10, 0, 2);
  light1.position.set(260, 180, 220);
  scene.add(light1);

  const light2 = new THREE.PointLight(0xc084ff, 1.00, 0, 2);
  light2.position.set(-240, -100, -220);
  scene.add(light2);

  const light3 = new THREE.PointLight(0xff7ad9, 0.65, 0, 2);
  light3.position.set(0, 120, 0);
  scene.add(light3);
}

function addBackgroundStars() {
  const count = 300;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const r = 1400 + Math.random() * 1000;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi);
    const z = r * Math.sin(phi) * Math.sin(theta);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const c = new THREE.Color().setHSL(0.66 + Math.random() * 0.08, 0.35, 0.72 + Math.random() * 0.16);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 2.0,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    map: particleTexture,
    alphaTest: 0.02,
  });

  backgroundStars = new THREE.Points(geometry, material);
  scene.add(backgroundStars);
}

function buildParticleSystem() {
  particlePositions = new Float32Array(MAX_BODIES * 3);
  particleColors = new Float32Array(MAX_BODIES * 3);

  trailPositions = new Float32Array(MAX_BODIES * 6);
  trailColors = new Float32Array(MAX_BODIES * 6);
  trailAnchors = new Float32Array(MAX_BODIES * 3);

  particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));
  particleGeometry.setDrawRange(0, currentBodyCount);

  particleMaterial = new THREE.PointsMaterial({
    size: Math.max(1.2, DEFAULTS.radiusScale * 1.15),
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    map: particleTexture,
    alphaTest: 0.02,
  });

  particleSystem = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particleSystem);

  trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
  trailGeometry.setAttribute("color", new THREE.BufferAttribute(trailColors, 3));
  trailGeometry.setDrawRange(0, currentBodyCount * 2);

  trailMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  trailSystem = new THREE.LineSegments(trailGeometry, trailMaterial);
  scene.add(trailSystem);
}

function shouldUseTrails(count) {
  return count <= 4000;
}

function getVisualModeConfig(mode) {
  switch (mode) {
    case "normal":
      return {
        bloomStrength: 1.1,
        bloomRadius: 0.42,
        bloomThreshold: 0.24,
        exposure: 1.0,
        particleOpacityBase: 0.88,
        particleSizeFactor: 1.0,
      };
    case "cinematic":
      return {
        bloomStrength: 2.3,
        bloomRadius: 0.72,
        bloomThreshold: 0.12,
        exposure: 1.25,
        particleOpacityBase: 1.0,
        particleSizeFactor: 1.25,
      };
    case "bright":
    default:
      return {
        bloomStrength: 1.8,
        bloomRadius: 0.55,
        bloomThreshold: 0.18,
        exposure: 1.15,
        particleOpacityBase: 0.96,
        particleSizeFactor: 1.15,
      };
  }
}

function getParticleColor(mass, speed, glowStrength) {
  const massNorm = Math.min(1, mass / 7.0);
  const speedNorm = Math.min(1, speed / 6.0);

  const hue =
    0.78
    - speedNorm * 0.64
    - massNorm * 0.06;

  const saturation =
    Math.min(1, 0.88 + speedNorm * 0.08 + massNorm * 0.04);

  const lightness =
    Math.min(
      0.95,
      0.54 + speedNorm * 0.20 + massNorm * 0.08 + glowStrength * 0.05
    );

  return new THREE.Color().setHSL(
    ((hue % 1) + 1) % 1,
    saturation,
    lightness
  );
}

function refreshWasmViews() {
  if (!engine) return;
  if (!wasmExports || !wasmExports.memory) {
    throw new Error("WASM memory is unavailable");
  }

  const mem = wasmExports.memory;

  wasmPositions = new Float32Array(
    mem.buffer,
    engine.positions_ptr(),
    engine.positions_len()
  );

  wasmMasses = new Float32Array(
    mem.buffer,
    engine.masses_ptr(),
    engine.scalars_len()
  );

  wasmSpeeds = new Float32Array(
    mem.buffer,
    engine.speeds_ptr(),
    engine.scalars_len()
  );
}

function updateVisualSettings() {
  if (!particleMaterial || !trailMaterial || !trailSystem) return;

  const s = getSettings();
  const modeCfg = getVisualModeConfig(s.visualMode);

  particleMaterial.size = Math.max(1.2, s.radiusScale * modeCfg.particleSizeFactor);
  particleMaterial.opacity = Math.min(1, modeCfg.particleOpacityBase + s.glow * 0.04);

  const useTrails = shouldUseTrails(currentBodyCount);
  trailSystem.visible = useTrails;

  if (useTrails) {
    trailMaterial.opacity = 0.08 + s.trail * 0.40;
    trailGeometry.setDrawRange(0, currentBodyCount * 2);
  } else {
    trailGeometry.setDrawRange(0, 0);
  }

  particleGeometry.setDrawRange(0, currentBodyCount);

  if (renderer) {
    renderer.toneMappingExposure = modeCfg.exposure;
  }

  if (bloomPass) {
    bloomPass.strength = s.bloom * (modeCfg.bloomStrength / DEFAULTS.bloom);
    bloomPass.radius = modeCfg.bloomRadius;
    bloomPass.threshold = modeCfg.bloomThreshold;
  }
}

function rebuildColors(glowStrength) {
  if (!wasmMasses || !wasmSpeeds) return;

  for (let i = 0; i < currentBodyCount; i++) {
    const posIndex = i * 3;
    const trailIndex = i * 6;

    const mass = wasmMasses[i];
    const speed = wasmSpeeds[i];

    const color = getParticleColor(mass, speed, glowStrength);

    particleColors[posIndex] = color.r;
    particleColors[posIndex + 1] = color.g;
    particleColors[posIndex + 2] = color.b;

    trailColors[trailIndex] = color.r * 0.65;
    trailColors[trailIndex + 1] = color.g * 0.65;
    trailColors[trailIndex + 2] = color.b * 0.65;
    trailColors[trailIndex + 3] = color.r;
    trailColors[trailIndex + 4] = color.g;
    trailColors[trailIndex + 5] = color.b;
  }

  particleGeometry.attributes.color.needsUpdate = true;
  trailGeometry.attributes.color.needsUpdate = true;
}

function copyPositionsFromSnapshot(resetTrails = false) {
  if (!wasmPositions) return;

  const useTrails = shouldUseTrails(currentBodyCount);

  for (let i = 0; i < currentBodyCount; i++) {
    const posIndex = i * 3;
    const trailIndex = i * 6;

    const x = wasmPositions[posIndex];
    const y = wasmPositions[posIndex + 1];
    const z = wasmPositions[posIndex + 2];

    particlePositions[posIndex] = x;
    particlePositions[posIndex + 1] = y;
    particlePositions[posIndex + 2] = z;

    if (useTrails) {
      if (resetTrails) {
        trailAnchors[posIndex] = x;
        trailAnchors[posIndex + 1] = y;
        trailAnchors[posIndex + 2] = z;
      } else {
        const keep = Math.max(0, Math.min(0.96, getSettings().trail * 0.92));
        trailAnchors[posIndex] = trailAnchors[posIndex] * keep + x * (1 - keep);
        trailAnchors[posIndex + 1] = trailAnchors[posIndex + 1] * keep + y * (1 - keep);
        trailAnchors[posIndex + 2] = trailAnchors[posIndex + 2] * keep + z * (1 - keep);
      }

      trailPositions[trailIndex] = trailAnchors[posIndex];
      trailPositions[trailIndex + 1] = trailAnchors[posIndex + 1];
      trailPositions[trailIndex + 2] = trailAnchors[posIndex + 2];
      trailPositions[trailIndex + 3] = x;
      trailPositions[trailIndex + 4] = y;
      trailPositions[trailIndex + 5] = z;
    }
  }

  particleGeometry.attributes.position.needsUpdate = true;

  if (useTrails) {
    trailGeometry.attributes.position.needsUpdate = true;
  }
}

function createEngine() {
  const s = getSettings();
  currentBodyCount = s.n;
  bodiesInput.value = s.n;

  engine = new NBodyEngine(currentBodyCount, WORLD_WIDTH, WORLD_HEIGHT, WORLD_DEPTH);
  engine.set_params(s.g, s.dt, s.softening, s.bounce);
  engine.set_solver_mode(s.solver);
  applyPreset();
  resetBenchmarkTracking();

  refreshWasmViews();
  copyPositionsFromSnapshot(true);
  rebuildColors(s.glow);
  updateVisualSettings();

  updateBenchmarkStats();
  bodiesStat.textContent = String(currentBodyCount);
  statusStat.textContent = "готово";
  renderScene();
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

  refreshWasmViews();
}

function applyEngineParams() {
  if (!engine) return;
  const s = getSettings();
  engine.set_params(s.g, s.dt, s.softening, s.bounce);
}

function applySolverMode() {
  if (!engine) return;
  engine.set_solver_mode(getSettings().solver);
}

function refreshPresetImmediately() {
  if (!engine) return;
  pauseSimulation();
  applyEngineParams();
  applySolverMode();
  applyPreset();
  copyPositionsFromSnapshot(true);
  rebuildColors(getSettings().glow);
  renderScene();
}

function startSimulation() {
  if (running) return;

  running = true;
  hasBenchmarkStarted = true;
  updateSaveResultButtonState();
  simulationStartTime = performance.now();

  statusStat.textContent = "работает";

  updateElapsedTimer();
  startPhysicsLoop();
}

function pauseSimulation() {

  updateElapsedTimer();
  elapsedBeforePause = currentElapsedSeconds;
  simulationStartTime = null;

  running = false;
  statusStat.textContent = "пауза";

  if (physicsRafId !== null) {
    cancelAnimationFrame(physicsRafId);
    physicsRafId = null;
  }
}

function resetSystem() {
  simulationStartTime = null;
  elapsedBeforePause = 0;
  currentElapsedSeconds = 0;
  updateElapsedTimer();
  hasBenchmarkStarted = false;
  updateSaveResultButtonState();

  pauseSimulation();
  createEngine();
}

function resetSettings() {
  pauseSimulation();
  applyDefaultsToControls();
  createEngine();
}

async function toggleFullscreen() {
  try {
    const simPanel = document.querySelector(".sim-panel");

    if (!document.fullscreenElement) {
      await simPanel.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (err) {
    console.error("Ошибка fullscreen:", err);
  }
}

function renderScene() {
  controls.update();

  if (backgroundStars) {
    backgroundStars.rotation.y += 0.00015;
  }

  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}

function startRenderLoop() {
  if (renderRafId !== null) return;

  const renderTick = () => {
    renderScene();
    renderRafId = requestAnimationFrame(renderTick);
  };

  renderTick();
}

function getFpsGraphUpdateInterval(fps) {
  if (fps < 200) return 250;
  if (fps < 500) return 500;
  if (fps < 1000) return 800;
  return 1200;
}

function drawFpsGraph() {
  const w = fpsCanvas.width;
  const h = fpsCanvas.height;

  fpsCtx.clearRect(0, 0, w, h);

  const leftPad = 28;
  const rightPad = 10;
  const topPad = 8;
  const bottomPad = 12;
  const chartW = w - leftPad - rightPad;
  const chartH = h - topPad - bottomPad;

  const bg = fpsCtx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "rgba(34, 197, 255, 0.05)");
  bg.addColorStop(0.5, "rgba(167, 139, 250, 0.03)");
  bg.addColorStop(1, "rgba(10, 8, 30, 0.0)");
  fpsCtx.fillStyle = bg;
  fpsCtx.fillRect(0, 0, w, h);

  const maxFpsValue = Math.max(...fpsHistory, 60);

  let labelStep = 20;

  if (maxFpsValue > 200 && maxFpsValue <= 500) {
    labelStep = 50;
  } else if (maxFpsValue > 500 && maxFpsValue <= 1000) {
    labelStep = 100;
  } else if (maxFpsValue > 1000) {
    labelStep = 200;
  }

  const axisMax = Math.max(60, Math.ceil(maxFpsValue / labelStep) * labelStep);

  const labelValues = [];

  for (let v = 0; v <= axisMax; v += labelStep) {
    labelValues.push(v);
  }

  const minorStep = labelStep / 2;
  const minorValues = [];

  for (let v = minorStep; v < axisMax; v += minorStep) {
    if (!labelValues.includes(v)) {
      minorValues.push(v);
    }
  }

  fpsCtx.strokeStyle = "rgba(255,255,255,0.04)";
  fpsCtx.lineWidth = 1;

  minorValues.forEach((val) => {
    const y = topPad + chartH - (val / axisMax) * chartH;
    fpsCtx.beginPath();
    fpsCtx.moveTo(leftPad, y);
    fpsCtx.lineTo(w - rightPad, y);
    fpsCtx.stroke();
  });

  fpsCtx.strokeStyle = "rgba(255,255,255,0.08)";
  fpsCtx.lineWidth = 1;

  labelValues.forEach((val) => {
    const y = topPad + chartH - (val / axisMax) * chartH;
    fpsCtx.beginPath();
    fpsCtx.moveTo(leftPad, y);
    fpsCtx.lineTo(w - rightPad, y);
    fpsCtx.stroke();
  });

  fpsCtx.fillStyle = "rgba(255,255,255,0.40)";
  fpsCtx.font = "11px Inter, system-ui, sans-serif";
  fpsCtx.textBaseline = "middle";

  labelValues.forEach((val) => {
    const y = topPad + chartH - (val / axisMax) * chartH;
    fpsCtx.fillText(String(val), 6, y);
  });

  fpsCtx.strokeStyle = "rgba(255,255,255,0.08)";
  fpsCtx.lineWidth = 1;

  labelValues.forEach((val) => {
    const y = topPad + chartH - (val / axisMax) * chartH;
    fpsCtx.beginPath();
    fpsCtx.moveTo(leftPad, y);
    fpsCtx.lineTo(w - rightPad, y);
    fpsCtx.stroke();
  });

  fpsCtx.fillStyle = "rgba(255,255,255,0.40)";
  fpsCtx.font = "11px Inter, system-ui, sans-serif";
  fpsCtx.textBaseline = "middle";

  labelValues.forEach((val) => {
    const y = topPad + chartH - (val / axisMax) * chartH;
    fpsCtx.fillText(String(val), 6, y);
  });

  for (let v = 0; v <= axisMax; v += labelStep) {
    labelValues.push(v);
  }

  if (fpsHistory.length < 2) return;

  const points = fpsHistory.map((fps, i) => {
    const x = leftPad + (i / (fpsHistory.length - 1)) * chartW;
    const y = topPad + chartH - (fps / axisMax) * chartH;
    return { x, y };
  });

  const areaGradient = fpsCtx.createLinearGradient(0, topPad, 0, h);
  areaGradient.addColorStop(0, "rgba(255, 225, 90, 0.22)");
  areaGradient.addColorStop(0.55, "rgba(180, 95, 255, 0.14)");
  areaGradient.addColorStop(1, "rgba(180, 95, 255, 0.01)");

  fpsCtx.beginPath();
  fpsCtx.moveTo(points[0].x, topPad + chartH);
  for (const p of points) fpsCtx.lineTo(p.x, p.y);
  fpsCtx.lineTo(points[points.length - 1].x, topPad + chartH);
  fpsCtx.closePath();
  fpsCtx.fillStyle = areaGradient;
  fpsCtx.fill();

  fpsCtx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i === 0) fpsCtx.moveTo(p.x, p.y);
    else fpsCtx.lineTo(p.x, p.y);
  }
  fpsCtx.strokeStyle = "rgba(255, 220, 90, 0.22)";
  fpsCtx.lineWidth = 8;
  fpsCtx.lineCap = "round";
  fpsCtx.lineJoin = "round";
  fpsCtx.stroke();

  fpsCtx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i === 0) fpsCtx.moveTo(p.x, p.y);
    else fpsCtx.lineTo(p.x, p.y);
  }

  const lineGradient = fpsCtx.createLinearGradient(leftPad, 0, w - rightPad, 0);
  lineGradient.addColorStop(0, "#ffe15a");
  lineGradient.addColorStop(0.55, "#c084fc");
  lineGradient.addColorStop(1, "#8b5cf6");

  fpsCtx.strokeStyle = lineGradient;
  fpsCtx.lineWidth = 3;
  fpsCtx.lineCap = "round";
  fpsCtx.lineJoin = "round";
  fpsCtx.stroke();

  const last = points[points.length - 1];
  fpsCtx.beginPath();
  fpsCtx.fillStyle = "#ffffff";
  fpsCtx.arc(last.x, last.y, 3, 0, Math.PI * 2);
  fpsCtx.fill();
}

function calculateCpuLoadEstimate(physicsMs) {
  if (!Number.isFinite(physicsMs) || physicsMs <= 0) return 0;

  return Math.min(999, (physicsMs / TARGET_FRAME_MS) * 100);
}

function drawCpuGraph() {
  const w = cpuCanvas.width;
  const h = cpuCanvas.height;

  cpuCtx.clearRect(0, 0, w, h);

  const leftPad = 32;
  const rightPad = 10;
  const topPad = 8;
  const bottomPad = 10;
  const chartW = w - leftPad - rightPad;
  const chartH = h - topPad - bottomPad;

  const bg = cpuCtx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "rgba(251, 191, 36, 0.05)");
  bg.addColorStop(0.55, "rgba(167, 139, 250, 0.03)");
  bg.addColorStop(1, "rgba(10, 8, 30, 0.0)");
  cpuCtx.fillStyle = bg;
  cpuCtx.fillRect(0, 0, w, h);

  const maxValue = Math.max(...cpuHistory, 100);
  let labelStep = 25;

  if (maxValue > 150 && maxValue <= 300) {
    labelStep = 50;
  } else if (maxValue > 300) {
    labelStep = 100;
  }

  const axisMax = Math.max(100, Math.ceil(maxValue / labelStep) * labelStep);

  const labelValues = [];
  for (let v = 0; v <= axisMax; v += labelStep) {
    labelValues.push(v);
  }

  cpuCtx.strokeStyle = "rgba(255,255,255,0.06)";
  cpuCtx.lineWidth = 1;

  labelValues.forEach((val) => {
    const y = topPad + chartH - (val / axisMax) * chartH;
    cpuCtx.beginPath();
    cpuCtx.moveTo(leftPad, y);
    cpuCtx.lineTo(w - rightPad, y);
    cpuCtx.stroke();
  });

  // Линия 100% — важная граница
  if (axisMax >= 100) {
    const y100 = topPad + chartH - (100 / axisMax) * chartH;
    cpuCtx.beginPath();
    cpuCtx.moveTo(leftPad, y100);
    cpuCtx.lineTo(w - rightPad, y100);
    cpuCtx.strokeStyle = "rgba(251, 191, 36, 0.28)";
    cpuCtx.lineWidth = 2;
    cpuCtx.stroke();
  }

  cpuCtx.fillStyle = "rgba(255,255,255,0.40)";
  cpuCtx.font = "10px Inter, system-ui, sans-serif";
  cpuCtx.textBaseline = "middle";

  labelValues.forEach((val) => {
    const y = topPad + chartH - (val / axisMax) * chartH;
    cpuCtx.fillText(`${val}`, 6, y);
  });

  if (cpuHistory.length < 2) return;

  const points = cpuHistory.map((load, i) => {
    const x = leftPad + (i / (cpuHistory.length - 1)) * chartW;
    const y = topPad + chartH - (load / axisMax) * chartH;
    return { x, y };
  });

  const areaGradient = cpuCtx.createLinearGradient(0, topPad, 0, h);
  areaGradient.addColorStop(0, "rgba(251, 191, 36, 0.22)");
  areaGradient.addColorStop(0.6, "rgba(251, 146, 60, 0.12)");
  areaGradient.addColorStop(1, "rgba(251, 146, 60, 0.01)");

  cpuCtx.beginPath();
  cpuCtx.moveTo(points[0].x, topPad + chartH);
  for (const p of points) cpuCtx.lineTo(p.x, p.y);
  cpuCtx.lineTo(points[points.length - 1].x, topPad + chartH);
  cpuCtx.closePath();
  cpuCtx.fillStyle = areaGradient;
  cpuCtx.fill();

  cpuCtx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i === 0) cpuCtx.moveTo(p.x, p.y);
    else cpuCtx.lineTo(p.x, p.y);
  }

  const lineGradient = cpuCtx.createLinearGradient(leftPad, 0, w - rightPad, 0);
  lineGradient.addColorStop(0, "#fbbf24");
  lineGradient.addColorStop(0.55, "#fb923c");
  lineGradient.addColorStop(1, "#f97316");

  cpuCtx.strokeStyle = lineGradient;
  cpuCtx.lineWidth = 2.5;
  cpuCtx.lineCap = "round";
  cpuCtx.lineJoin = "round";
  cpuCtx.stroke();

  const last = points[points.length - 1];
  cpuCtx.beginPath();
  cpuCtx.fillStyle = "#ffffff";
  cpuCtx.arc(last.x, last.y, 2.5, 0, Math.PI * 2);
  cpuCtx.fill();
}

function drawEnergyDriftGraph() {
  const w = energyCanvas.width;
  const h = energyCanvas.height;

  energyCtx.clearRect(0, 0, w, h);

  const leftPad = 34;
  const rightPad = 10;
  const topPad = 8;
  const bottomPad = 10;
  const chartW = w - leftPad - rightPad;
  const chartH = h - topPad - bottomPad;

  const bg = energyCtx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "rgba(196, 181, 253, 0.05)");
  bg.addColorStop(0.55, "rgba(167, 139, 250, 0.03)");
  bg.addColorStop(1, "rgba(10, 8, 30, 0.0)");
  energyCtx.fillStyle = bg;
  energyCtx.fillRect(0, 0, w, h);

  const maxValue = Math.max(...energyDriftHistory, 1);

  let labelStep = 1;

  if (maxValue > 5 && maxValue <= 20) {
    labelStep = 5;
  } else if (maxValue > 20 && maxValue <= 50) {
    labelStep = 10;
  } else if (maxValue > 50) {
    labelStep = 25;
  }

  const axisMax = Math.max(1, Math.ceil(maxValue / labelStep) * labelStep);

  const labelValues = [];
  for (let v = 0; v <= axisMax; v += labelStep) {
    labelValues.push(v);
  }

  energyCtx.strokeStyle = "rgba(255,255,255,0.06)";
  energyCtx.lineWidth = 1;

  labelValues.forEach((val) => {
    const y = topPad + chartH - (val / axisMax) * chartH;
    energyCtx.beginPath();
    energyCtx.moveTo(leftPad, y);
    energyCtx.lineTo(w - rightPad, y);
    energyCtx.stroke();
  });

  energyCtx.fillStyle = "rgba(255,255,255,0.40)";
  energyCtx.font = "10px Inter, system-ui, sans-serif";
  energyCtx.textBaseline = "middle";

  labelValues.forEach((val) => {
    const y = topPad + chartH - (val / axisMax) * chartH;
    energyCtx.fillText(`${val}`, 6, y);
  });

  if (energyDriftHistory.length < 2) return;

  const points = energyDriftHistory.map((drift, i) => {
    const x = leftPad + (i / (energyDriftHistory.length - 1)) * chartW;
    const y = topPad + chartH - (drift / axisMax) * chartH;
    return { x, y };
  });

  const areaGradient = energyCtx.createLinearGradient(0, topPad, 0, h);
  areaGradient.addColorStop(0, "rgba(196, 181, 253, 0.22)");
  areaGradient.addColorStop(0.6, "rgba(139, 92, 246, 0.12)");
  areaGradient.addColorStop(1, "rgba(139, 92, 246, 0.01)");

  energyCtx.beginPath();
  energyCtx.moveTo(points[0].x, topPad + chartH);
  for (const p of points) energyCtx.lineTo(p.x, p.y);
  energyCtx.lineTo(points[points.length - 1].x, topPad + chartH);
  energyCtx.closePath();
  energyCtx.fillStyle = areaGradient;
  energyCtx.fill();

  energyCtx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i === 0) energyCtx.moveTo(p.x, p.y);
    else energyCtx.lineTo(p.x, p.y);
  }

  const lineGradient = energyCtx.createLinearGradient(leftPad, 0, w - rightPad, 0);
  lineGradient.addColorStop(0, "#ddd6fe");
  lineGradient.addColorStop(0.55, "#a78bfa");
  lineGradient.addColorStop(1, "#8b5cf6");

  energyCtx.strokeStyle = lineGradient;
  energyCtx.lineWidth = 2.5;
  energyCtx.lineCap = "round";
  energyCtx.lineJoin = "round";
  energyCtx.stroke();

  const last = points[points.length - 1];
  energyCtx.beginPath();
  energyCtx.fillStyle = "#ffffff";
  energyCtx.arc(last.x, last.y, 2.5, 0, Math.PI * 2);
  energyCtx.fill();
}

function formatElapsedTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0.0 c";

  if (seconds < 60) {
    return `${seconds.toFixed(1)} c`;
  }

  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;

  return `${minutes} мин ${restSeconds.toFixed(1)} c`;
}

function updateElapsedTimer() {
  if (running && simulationStartTime !== null) {
    currentElapsedSeconds =
      elapsedBeforePause + (performance.now() - simulationStartTime) / 1000;
  }

  if (elapsedTimeStat) {
    elapsedTimeStat.textContent = formatElapsedTime(currentElapsedSeconds);
  }
}

function startPhysicsLoop() {
  if (physicsRafId !== null) return;

  const physicsTick = () => {
    if (!running || !engine) {
      physicsRafId = null;
      return;
    }

    const s = getSettings();

    const t0 = performance.now();
    engine.step_many(s.iterations);
    const t1 = performance.now();

    const physicsMs = t1 - t0;
    cachedPhysicsMs = physicsMs;
    physicsSamples.push(physicsMs);
    if (physicsSamples.length > 120) {
      physicsSamples.shift();
    }

    refreshWasmViews();
    copyPositionsFromSnapshot(false);

    colorUpdateCounter++;
    if (colorUpdateCounter >= 10) {
      rebuildColors(s.glow);
      colorUpdateCounter = 0;
    }

    const nowStats = performance.now();

    if (nowStats - lastLightStatsUpdate >= 180) {
      physicsStat.textContent = `${physicsMs.toFixed(3)} ms`;
      cachedKineticEnergy = engine.kinetic_energy();
      updateBenchmarkStats();
      updateElapsedTimer();
      lastLightStatsUpdate = nowStats;
    }

    const heavyStatsInterval = getHeavyStatsUpdateInterval(currentBodyCount);

    if (nowStats - lastHeavyStatsUpdate >= heavyStatsInterval) {
      cachedTotalEnergy = engine.total_energy();

      if (baselineTotalEnergy !== null && baselineTotalEnergy !== 0) {
        cachedEnergyDrift =
          Math.abs((cachedTotalEnergy - baselineTotalEnergy) / baselineTotalEnergy) * 100;
      } else {
        cachedEnergyDrift = 0;
      }

      if (energyDriftValue) {
        energyDriftValue.textContent = `${cachedEnergyDrift.toFixed(2)}%`;
      }

      if (fullscreenEnergyValue) {
        fullscreenEnergyValue.textContent = `${cachedEnergyDrift.toFixed(2)}%`;
      }

      energyDriftHistory.push(cachedEnergyDrift);
      if (energyDriftHistory.length > 120) {
        energyDriftHistory.shift();
      }

      drawEnergyDriftGraph();

      updateBenchmarkStats();
      lastHeavyStatsUpdate = nowStats;
    }

    const realFps = physicsMs > 0 ? 1000 / physicsMs : 0;
    currentFPS = realFps;

    fpsBig.textContent = `${currentFPS.toFixed(0)} FPS`;

    if (fullscreenFpsValue) {
      fullscreenFpsValue.textContent = currentFPS.toFixed(0);
    }

    const nowFpsGraph = performance.now();
    const graphInterval = getFpsGraphUpdateInterval(currentFPS);

    if (nowFpsGraph - lastFpsGraphUpdate >= graphInterval) {
      fpsHistory.push(currentFPS);

      if (fpsHistory.length > 90) {
        fpsHistory.shift();
      }

      drawFpsGraph();
      lastFpsGraphUpdate = nowFpsGraph;

      const cpuLoad = calculateCpuLoadEstimate(physicsMs);
      cachedPhysicsLoad = cpuLoad;
      cpuLoadValue.textContent = `${cpuLoad.toFixed(0)}%`;

      if (fullscreenCpuValue) {
        fullscreenCpuValue.textContent = `${cpuLoad.toFixed(0)}%`;
      }

      cpuHistory.push(cpuLoad);
      if (cpuHistory.length > 120) {
        cpuHistory.shift();
      }

      drawCpuGraph();
    }

    physicsRafId = requestAnimationFrame(physicsTick);
  };

  physicsTick();
}

function setupListeners() {
  [
    iterationsRange,
    gravityRange,
    dtRange,
    softRange,
    radiusRange,
    glowRange,
    trailRange,
    bloomRange,
  ].forEach((el) => {
    el.addEventListener("input", () => {
      markPerformancePresetAsCustom();

      syncLabels();
      applyEngineParams();
      updateVisualSettings();
      rebuildColors(getSettings().glow);
      renderScene();
    });
  });

  visualModeSelect.addEventListener("change", () => {
    markPerformancePresetAsCustom();

    updateVisualSettings();
    rebuildColors(getSettings().glow);
    renderScene();
  });

  performancePresetSelect.addEventListener("change", () => {
    applyPerformancePreset(performancePresetSelect.value);
  });

  solverSelect.addEventListener("change", () => {
    solverWarningDismissed = false;
    updateSolverWarning();
    applySolverMode();
    updateBenchmarkStats();
  });

  presetSelect.addEventListener("change", () => {
    syncLabels();
    refreshPresetImmediately();
  });

  bodiesInput.addEventListener("input", () => {
    const n = clampBodiesInput(bodiesInput.value);
    if (String(n) !== bodiesInput.value && bodiesInput.value !== "") {
      bodiesInput.value = n;
    }
    updateSolverWarning();
  });

  bodiesInput.addEventListener("change", () => {
    markPerformancePresetAsCustom();

    const n = clampBodiesInput(bodiesInput.value);
    bodiesInput.value = n;
    updateSolverWarning();
    resetSystem();
  });

  startBtn.addEventListener("click", startSimulation);
  pauseBtn.addEventListener("click", pauseSimulation);
  resetBtn.addEventListener("click", resetSystem);
  saveResultBtn.addEventListener("click", saveBenchmarkResult);
  fullscreenStartBtn.addEventListener("click", startSimulation);
  fullscreenPauseBtn.addEventListener("click", pauseSimulation);
  fullscreenResetBtn.addEventListener("click", resetSystem);
  defaultsBtn.addEventListener("click", resetSettings);
  fullscreenBtn.addEventListener("click", toggleFullscreen);

  document.addEventListener("fullscreenchange", () => {
    setTimeout(() => {
      resizeToDisplaySize();
      renderScene();
    }, 50);
  });
  
  if (solverWarningClose) {
    solverWarningClose.addEventListener("click", () => {
      solverWarningDismissed = true;
      solverWarning.style.display = "none";
    });
  }

  window.addEventListener("resize", resizeToDisplaySize);
}

function resizeToDisplaySize() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(640, Math.floor(rect.width));
  const height = Math.max(480, Math.floor(rect.height));

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  if (composer) {
    composer.setSize(width, height);
  }

  if (bloomPass) {
    bloomPass.setSize(width, height);
  }

  if (engine) {
    engine.resize_world(
      WORLD_WIDTH,
      Math.max(WORLD_HEIGHT, height * 1.1),
      WORLD_DEPTH
    );
    refreshWasmViews();
    copyPositionsFromSnapshot(false);
  }

  const fpsRect = fpsCanvas.getBoundingClientRect();
  const fpsWidth = Math.max(180, Math.floor(fpsRect.width));
  const fpsHeight = Math.max(140, Math.floor(fpsRect.height));

  if (fpsCanvas.width !== fpsWidth || fpsCanvas.height !== fpsHeight) {
    fpsCanvas.width = fpsWidth;
    fpsCanvas.height = fpsHeight;
    drawFpsGraph();
  }

  const cpuRect = cpuCanvas.getBoundingClientRect();
  const cpuWidth = Math.max(160, Math.floor(cpuRect.width));
  const cpuHeight = Math.max(70, Math.floor(cpuRect.height));

  if (cpuCanvas.width !== cpuWidth || cpuCanvas.height !== cpuHeight) {
    cpuCanvas.width = cpuWidth;
    cpuCanvas.height = cpuHeight;
    drawCpuGraph();
  }

  const energyRect = energyCanvas.getBoundingClientRect();
  const energyWidth = Math.max(160, Math.floor(energyRect.width));
  const energyHeight = Math.max(70, Math.floor(energyRect.height));

  if (energyCanvas.width !== energyWidth || energyCanvas.height !== energyHeight) {
    energyCanvas.width = energyWidth;
    energyCanvas.height = energyHeight;
    drawEnergyDriftGraph();
  }
}

function getHeavyStatsUpdateInterval(bodyCount) {
  if (bodyCount <= 500) return 700;
  if (bodyCount <= 1000) return 1200;
  if (bodyCount <= 2500) return 2200;
  if (bodyCount <= 5000) return 3500;
  return 5000;
}

function resetBenchmarkTracking() {
  physicsSamples = [];

  energyDriftHistory.length = 0;

  if (energyDriftValue) {
    energyDriftValue.textContent = "0%";
  }

  if (fullscreenEnergyValue) {
    fullscreenEnergyValue.textContent = "0%";
  }

  if (energyCanvas) {
    drawEnergyDriftGraph();
  }

  if (engine) {
    cachedKineticEnergy = engine.kinetic_energy();
    cachedTotalEnergy = engine.total_energy();
    baselineTotalEnergy = cachedTotalEnergy;
    cachedEnergyDrift = 0;
  } else {
    baselineTotalEnergy = null;
    cachedKineticEnergy = 0;
    cachedTotalEnergy = 0;
    cachedEnergyDrift = 0;
  }

  lastLightStatsUpdate = performance.now();
  lastHeavyStatsUpdate = performance.now();
}

function getAveragePhysicsMs() {
  if (!physicsSamples.length) return 0;

  const sum = physicsSamples.reduce((acc, value) => acc + value, 0);
  return sum / physicsSamples.length;
}

function getDeviceLabel() {
  const ua = navigator.userAgent;

  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";

  return "Unknown";
}

function getBrowserName() {
  const ua = navigator.userAgent;

  if (/Edg/i.test(ua)) return "Microsoft Edge";
  if (/OPR|Opera/i.test(ua)) return "Opera";
  if (/Firefox/i.test(ua)) return "Firefox";
  if (/Chrome/i.test(ua)) return "Chrome";
  if (/Safari/i.test(ua)) return "Safari";

  return "Неизвестный браузер";
}

function getOsName() {
  const ua = navigator.userAgent;

  if (/Windows/i.test(ua)) return "Windows";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Macintosh|Mac OS/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";

  return "Неизвестная ОС";
}

function getPhoneModelFromUserAgent() {
  const ua = navigator.userAgent;

  const androidMatch = ua.match(/Android\s[\d.]+;\s([^;)]+)\)/i);

  if (androidMatch && androidMatch[1]) {
    return androidMatch[1]
      .replace(/Build\/.*/i, "")
      .replace(/wv/i, "")
      .trim();
  }

  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";

  return null;
}

function getGpuInfo() {
  try {
    const canvas = document.createElement("canvas");

    const gl =
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");

    if (!gl) return "Не удалось определить";

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");

    if (debugInfo) {
      return (
        gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ||
        "Не удалось определить"
      );
    }

    return gl.getParameter(gl.RENDERER) || "Не удалось определить";
  } catch (err) {
    return "Не удалось определить";
  }
}

function getCpuInfoText() {
  const threads = navigator.hardwareConcurrency;

  if (threads) {
    return `${threads} логических потоков`;
  }

  return "Не удалось определить";
}

function getRamText() {
  const memory = navigator.deviceMemory;

  if (memory) {
    return `${memory} ГБ`;
  }

  return "Не удалось определить";
}

function getDeviceShortName() {
  const os = getOsName();
  const phoneModel = getPhoneModelFromUserAgent();

  if (phoneModel) return phoneModel;

  if (os === "Windows") return "Windows ПК";
  if (os === "macOS") return "Mac";
  if (os === "Linux") return "Linux ПК";
  if (os === "Android") return "Android-устройство";
  if (os === "iOS") return "iOS-устройство";

  return "Неизвестное устройство";
}

function getDeviceInfoForBenchmark() {
  const screenText = `${screen.width}×${screen.height}`;
  const viewportText = `${window.innerWidth}×${window.innerHeight}`;

  return {
    deviceName: getDeviceShortName(),
    os: getOsName(),
    browser: getBrowserName(),
    cpu: getCpuInfoText(),
    ram: getRamText(),
    gpu: getGpuInfo(),
    screen: screenText,
    viewport: viewportText,
    dpr: window.devicePixelRatio || 1,
    userAgent: navigator.userAgent,
  };
}

function updateBenchmarkStats() {
  const solverLabel =
    solverSelect.value === "direct" ? "Прямой" : "Barnes–Hut";

  if (solverStat) {
    solverStat.textContent = solverLabel;
  }

  if (avgPhysicsStat) {
    if (physicsSamples.length === 0) {
      avgPhysicsStat.textContent = "0 ms";
    } else {
      const avg =
        physicsSamples.reduce((sum, v) => sum + v, 0) / physicsSamples.length;
      avgPhysicsStat.textContent = `${avg.toFixed(3)} ms`;
    }
  }

  if (kineticStat) {
    kineticStat.textContent = cachedKineticEnergy.toFixed(2);
  }

  if (totalEnergyStat) {
    totalEnergyStat.textContent = cachedTotalEnergy.toFixed(2);
  }

  if (energyDriftStat) {
    energyDriftStat.textContent = `${cachedEnergyDrift.toFixed(2)}%`;
  }
}

function applyPerformancePreset(presetName) {
  if (!presetName || presetName === "custom") return;

  const preset = PERFORMANCE_PRESETS[presetName];
  if (!preset) return;

  pauseSimulation();

  bodiesInput.value = preset.n;
  solverSelect.value = preset.solver;

  iterationsRange.value = preset.iterations;
  gravityRange.value = preset.g;
  dtRange.value = preset.dt;
  softRange.value = preset.softening;
  trailRange.value = preset.trail;
  radiusRange.value = preset.radiusScale;
  glowRange.value = preset.glow;
  bloomRange.value = preset.bloom;
  visualModeSelect.value = preset.visualMode;

  solverWarningDismissed = false;

  syncLabels();
  syncCustomSelects();
  updateSolverWarning();

  createEngine();
}

function markPerformancePresetAsCustom() {
  if (performancePresetSelect) {
    performancePresetSelect.value = "custom";
  }
}

function setupCustomSelects() {
  const customSelects = document.querySelectorAll(".custom-select");

  customSelects.forEach((customSelect) => {
    const selectId = customSelect.dataset.selectId;
    const realSelect = document.getElementById(selectId);
    const button = customSelect.querySelector(".custom-select-btn");
    const options = customSelect.querySelectorAll(".custom-select-option");

    if (!realSelect || !button || options.length === 0) return;

    function syncFromRealSelect() {
      const selectedOption = realSelect.options[realSelect.selectedIndex];
      const selectedText = selectedOption ? selectedOption.textContent : "";

      button.textContent = selectedText;

      options.forEach((option) => {
        option.classList.toggle(
          "active",
          option.dataset.value === realSelect.value
        );
      });
    }

    button.addEventListener("click", (event) => {
      event.stopPropagation();

      customSelects.forEach((item) => {
        if (item !== customSelect) {
          item.classList.remove("open");
        }
      });

      customSelect.classList.toggle("open");
    });

    options.forEach((option) => {
      option.addEventListener("click", (event) => {
        event.stopPropagation();

        const newValue = option.dataset.value;
        if (realSelect.value !== newValue) {
          realSelect.value = newValue;

          realSelect.dispatchEvent(
            new Event("change", {
              bubbles: true,
            })
          );
        }

        syncFromRealSelect();
        customSelect.classList.remove("open");
      });
    });

    realSelect.addEventListener("change", syncFromRealSelect);

    syncFromRealSelect();
  });

  document.addEventListener("click", () => {
    customSelects.forEach((customSelect) => {
      customSelect.classList.remove("open");
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      customSelects.forEach((customSelect) => {
        customSelect.classList.remove("open");
      });
    }
  });
}

async function saveBenchmarkResult() {

  if (!hasBenchmarkStarted || currentElapsedSeconds <= 0) {
    const oldText = saveResultBtn.textContent;
    saveResultBtn.textContent = "Сначала старт";

    setTimeout(() => {
      saveResultBtn.textContent = oldText;
      updateSaveResultButtonState();
    }, 1400);

    return;
  }

  if (!Number.isFinite(currentFPS) || currentFPS <= 0 || cachedPhysicsMs <= 0) {
    const oldText = saveResultBtn.textContent;
    saveResultBtn.textContent = "Нет данных";

    setTimeout(() => {
      saveResultBtn.textContent = oldText;
    }, 1400);

    return;
  }

  if (!engine) return;

  const s = getSettings();

  const performancePresetLabels = {
    custom: "Пользовательский",
    light: "Лёгкий",
    balanced: "Сбалансированный",
    quality: "Качественный",
    high: "Высокая нагрузка",
    stress: "Стресс-тест",
    "direct-test": "Тест прямого метода",
  };

  const scenarioLabels = {
    galaxy: "Галактика",
    collapse: "Коллапс",
    explosion: "Взрыв",
    "two-galaxies": "Две галактики",
  };

  const visualModeLabels = {
    normal: "Обычный",
    bright: "Яркий",
    cinematic: "Кинематографичный",
  };

  const deviceInfo = getDeviceInfoForBenchmark();

  const payload = {
      
    device_text: deviceInfo.deviceName,
    device_info_json: deviceInfo,
    device_text: getDeviceLabel(),
    user_agent: navigator.userAgent,

    solver: s.solver === "direct" ? "Прямой" : "Barnes–Hut",
    preset: scenarioLabels[s.preset] || s.preset,
    performance_preset:
      performancePresetLabels[performancePresetSelect.value] ||
      performancePresetSelect.value ||
      "Пользовательский",

    bodies: currentBodyCount,

    fps: Number(currentFPS.toFixed(2)),
    elapsed_seconds: Number(currentElapsedSeconds.toFixed(2)),
    physics_ms: Number(cachedPhysicsMs.toFixed(4)),
    avg_physics_ms: Number(getAveragePhysicsMs().toFixed(4)),
    physics_load: Number(cachedPhysicsLoad.toFixed(2)),

    kinetic_energy: Number(cachedKineticEnergy.toFixed(4)),
    total_energy: Number(cachedTotalEnergy.toFixed(4)),
    energy_drift: Number(cachedEnergyDrift.toFixed(4)),

    settings_json: {
      scenario: scenarioLabels[s.preset] || s.preset,
      performancePreset:
        performancePresetLabels[performancePresetSelect.value] ||
        performancePresetSelect.value ||
        "Пользовательский",
      solver: s.solver === "direct" ? "Прямой" : "Barnes–Hut",

      bodies: s.n,
      iterations: s.iterations,
      gravity: s.g,
      timeStep: s.dt,
      softening: s.softening,
      trail: s.trail,
      radiusScale: s.radiusScale,
      glow: s.glow,
      bloom: s.bloom,
      visualMode: visualModeLabels[s.visualMode] || s.visualMode,
    },
  };

  const oldText = saveResultBtn.textContent;
  saveResultBtn.disabled = true;
  saveResultBtn.textContent = "Запись...";

  const { error } = await supabase
    .from("benchmark_results")
    .insert(payload);

  saveResultBtn.disabled = false;

  if (error) {
    console.error("Ошибка сохранения результата:", error);
    saveResultBtn.textContent = "Ошибка";
    setTimeout(() => {
      saveResultBtn.textContent = oldText;
    }, 1600);
    return;
  }

  saveResultBtn.textContent = "Сохранено";

  setTimeout(() => {
    saveResultBtn.textContent = oldText;
  }, 1600);
}

async function registerSW() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch (err) {
    console.error("Ошибка service worker:", err);
  }
}

async function boot() {
  try {
    statusStat.textContent = "инициализация...";
    fpsBig.textContent = "0 FPS";

    applyDefaultsToControls();
    syncLabels();

    await registerSW();

    createThreeScene();

    statusStat.textContent = "загрузка wasm...";
    wasmExports = await init();

    if (!wasmExports) {
      throw new Error("WASM init returned no exports");
    }

    resizeToDisplaySize();
    createEngine();
    drawFpsGraph();
    drawCpuGraph();
    drawEnergyDriftGraph();
    setupCustomSelects()
    setupListeners();
    updateSaveResultButtonState();
    startRenderLoop();

    kineticStat.textContent = engine.kinetic_energy().toFixed(2);
    totalEnergyStat.textContent = engine.total_energy().toFixed(2);
    statusStat.textContent = "готово";
  } catch (err) {
    console.error("Ошибка boot():", err);
    statusStat.textContent = "ошибка запуска";
    //swStat.textContent = "check console";
  }
}

boot();
