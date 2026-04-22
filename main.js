import init, { NBodyEngine } from "./rust-engine/pkg/rust_engine.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

const MAX_BODIES = 50000;
const WORLD_WIDTH = 1800;
const WORLD_HEIGHT = 900;
const WORLD_DEPTH = 1800;

const DEFAULTS = {
  n: 400,
  preset: "galaxy",
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

const canvas = document.getElementById("canvas");

const fpsCanvas = document.getElementById("fpsCanvas");
const fpsCtx = fpsCanvas.getContext("2d");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const defaultsBtn = document.getElementById("defaultsBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");

const presetSelect = document.getElementById("presetSelect");
const solverSelect = document.getElementById("solverSelect");
const solverWarning = document.getElementById("solverWarning");
const bodiesInput = document.getElementById("bodiesInput");
const visualModeSelect = document.getElementById("visualModeSelect");

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

let colorUpdateCounter = 0;
let statsUpdateCounter = 0;
let lastLightStatsUpdate = 0;
let lastHeavyStatsUpdate = 0;
let cachedTotalEnergy = 0;
let cachedEnergyDrift = 0;
let cachedKineticEnergy = 0;

let fpsCounter = 0;
let fpsLastTime = performance.now();
let currentFPS = 0;
const fpsHistory = [];

function applyDefaultsToControls() {
  bodiesInput.value = DEFAULTS.n;
  presetSelect.value = DEFAULTS.preset;
  solverSelect.value = DEFAULTS.solver;
  visualModeSelect.value = DEFAULTS.visualMode;

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
  if (!engine) createEngine();
  if (running) return;

  running = true;
  statusStat.textContent = "запущено";
  startPhysicsLoop();
}

function pauseSimulation() {
  running = false;
  statusStat.textContent = "пауза";

  if (physicsRafId !== null) {
    cancelAnimationFrame(physicsRafId);
    physicsRafId = null;
  }
}

function resetSystem() {
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
  const axisMax = Math.max(60, Math.ceil(maxFpsValue / 20) * 20);

  const labelStep = axisMax <= 100 ? 20 : 30;
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
      lastLightStatsUpdate = nowStats;
    }

    if (nowStats - lastHeavyStatsUpdate >= 5000) {
      cachedTotalEnergy = engine.total_energy();

      if (baselineTotalEnergy !== null && baselineTotalEnergy !== 0) {
        cachedEnergyDrift =
          Math.abs((cachedTotalEnergy - baselineTotalEnergy) / baselineTotalEnergy) * 100;
      } else {
        cachedEnergyDrift = 0;
      }

      updateBenchmarkStats();
      lastHeavyStatsUpdate = nowStats;
    }

    fpsCounter++;
    const now = performance.now();

    if (now - fpsLastTime >= 1000) {
      currentFPS = fpsCounter;
      fpsBig.textContent = `${currentFPS} FPS`;

      fpsHistory.push(currentFPS);
      if (fpsHistory.length > 80) fpsHistory.shift();

      drawFpsGraph();

      fpsCounter = 0;
      fpsLastTime = now;
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
    //bounceRange,
    radiusRange,
    glowRange,
    trailRange,
    bloomRange,
  ].forEach((el) => {
    el.addEventListener("input", () => {
      syncLabels();
      applyEngineParams();
      updateVisualSettings();
      rebuildColors(getSettings().glow);
      renderScene();
    });
  });

  visualModeSelect.addEventListener("change", () => {
    updateVisualSettings();
    rebuildColors(getSettings().glow);
    renderScene();
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
    const n = clampBodiesInput(bodiesInput.value);
    bodiesInput.value = n;
    updateSolverWarning();
    resetSystem();
  });

  startBtn.addEventListener("click", startSimulation);
  pauseBtn.addEventListener("click", pauseSimulation);
  resetBtn.addEventListener("click", resetSystem);
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
}

function resetBenchmarkTracking() {
  physicsSamples = [];

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
    setupListeners();
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
