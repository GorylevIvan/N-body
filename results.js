import { supabase } from "./supabaseClient.js";

const statusEl = document.getElementById("status");
const tableEl = document.getElementById("resultsTable");
const bodyEl = document.getElementById("resultsBody");

const deviceModal = document.getElementById("deviceModal");
const deviceModalBody = document.getElementById("deviceModalBody");
const closeDeviceModal = document.getElementById("closeDeviceModal");

const settingsModal = document.getElementById("settingsModal");
const settingsModalBody = document.getElementById("settingsModalBody");
const closeSettingsModal = document.getElementById("closeSettingsModal");
const sortSelect = document.getElementById("sortSelect");
const averageByDeviceBtn = document.getElementById("averageByDeviceBtn");

let currentRows = [];
let showAverageByDevice = false;

function formatDate(value) {
  if (!value) return "-";

  return new Date(value).toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMeasurementsCount(count) {
  const n = Math.abs(Number(count));
  const lastDigit = n % 10;
  const lastTwoDigits = n % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${count} замеров`;
  }

  if (lastDigit === 1) {
    return `${count} замер`;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${count} замера`;
  }

  return `${count} замеров`;
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return Number(value).toFixed(digits);
}

function average(values) {
  const validValues = values
    .map(Number)
    .filter((value) => Number.isFinite(value));

  if (!validValues.length) return null;

  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function getDeviceKey(row) {
  const info = row.device_info_json || {};

  return [
    info.deviceName || row.device_text || "Неизвестное устройство",
    info.os || "",
    info.browser || "",
    info.cpu || "",
    info.ram || "",
    info.gpu || "",
  ].join(" | ");
}

function getCommonValue(rows, fieldName) {
  const values = rows
    .map((row) => row[fieldName])
    .filter((value) => value !== null && value !== undefined && value !== "");

  if (!values.length) return "-";

  const first = values[0];
  const allSame = values.every((value) => value === first);

  return allSame ? first : "Смешанные";
}

function buildAveragesByDevice(rows) {
  const groups = new Map();

  rows.forEach((row) => {
    const key = getDeviceKey(row);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(row);
  });

  return Array.from(groups.values()).map((items) => {
    const first = items[0];
    const firstInfo = first.device_info_json || {};

    return {
      id: `avg-${getDeviceKey(first)}`,
      created_at: null,

      device_text:
        firstInfo.deviceName ||
        first.device_text ||
        "Неизвестное устройство",

      device_info_json: first.device_info_json || null,

      solver: getCommonValue(items, "solver"),
      preset: getCommonValue(items, "preset"),
      performance_preset: getCommonValue(items, "performance_preset"),

      bodies: getCommonValue(items, "bodies"),

      fps: average(items.map((item) => item.fps)),
      elapsed_seconds: average(items.map((item) => item.elapsed_seconds)),
      physics_ms: average(items.map((item) => item.physics_ms)),
      avg_physics_ms: average(items.map((item) => item.avg_physics_ms)),
      physics_load: average(items.map((item) => item.physics_load)),
      energy_drift: average(items.map((item) => item.energy_drift)),
      kinetic_energy: average(items.map((item) => item.kinetic_energy)),
      total_energy: average(items.map((item) => item.total_energy)),

      settings_json: null,
      user_agent: first.user_agent || "",

      isAverageRow: true,
      tests_count: items.length,
    };
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeSettings(row) {
  const settings = row.settings_json || {};

  return {
    "Сценарий": settings.scenario || row.preset || "-",
    "Пресет нагрузки": settings.performancePreset || row.performance_preset || "-",
    "Алгоритм": settings.solver || row.solver || "-",
    "Количество тел": settings.bodies ?? row.bodies ?? "-",
    "Итераций за кадр": settings.iterations ?? "-",
    "Сила притяжения": settings.gravity ?? "-",
    "Шаг времени": settings.timeStep ?? "-",
    "Смягчение гравитации": settings.softening ?? "-",
    "Длина следа": settings.trail ?? "-",
    "Размер частиц": settings.radiusScale ?? "-",
    "Яркость свечения": settings.glow ?? "-",
    "Интенсивность свечения": settings.bloom ?? "-",
    "Режим отображения": settings.visualMode ?? "-",
  };
}

function normalizeDeviceInfo(row) {
  const info = row.device_info_json || {};

  return {
    "Устройство": info.deviceName || row.device_text || "-",
    "Операционная система": info.os || "-",
    "Браузер": info.browser || "-",
    "CPU / потоки": info.cpu || "-",
    "RAM": info.ram || "-",
    "GPU рендера": info.gpu || "-",
    "Разрешение экрана": info.screen || "-",
    "Размер окна": info.viewport || "-",
    "DPR": info.dpr ?? "-",
  };
}

function openDeviceModal(row) {
  const info = normalizeDeviceInfo(row);

  deviceModalBody.innerHTML = Object.entries(info)
    .map(([key, value]) => {
      return `
        <div class="settings-detail-row">
          <span>${escapeHtml(key)}</span>
          <span>${escapeHtml(value)}</span>
        </div>
      `;
    })
    .join("");

  deviceModal.hidden = false;
}

function closeDeviceInfoModal() {
  deviceModal.hidden = true;
}

if (closeDeviceModal) {
  closeDeviceModal.addEventListener("click", closeDeviceInfoModal);
}

if (deviceModal) {
  deviceModal.addEventListener("click", (event) => {
    if (event.target === deviceModal) {
      closeDeviceInfoModal();
    }
  });
}

function openSettingsModal(row) {
  const settings = normalizeSettings(row);

  settingsModalBody.innerHTML = Object.entries(settings)
    .map(([key, value]) => {
      return `
        <div class="settings-detail-row">
          <span>${escapeHtml(key)}</span>
          <span>${escapeHtml(value)}</span>
        </div>
      `;
    })
    .join("");

  settingsModal.hidden = false;
}

function closeModal() {
  settingsModal.hidden = true;
}

closeSettingsModal.addEventListener("click", closeModal);

settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) {
    closeModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  if (settingsModal && !settingsModal.hidden) {
    closeModal();
  }

  if (deviceModal && !deviceModal.hidden) {
    closeDeviceInfoModal();
  }
});

function getSortConfig() {
  const value = sortSelect?.value || "created_at_desc";

  const [field, direction] = value.endsWith("_asc")
    ? [value.replace("_asc", ""), "asc"]
    : [value.replace("_desc", ""), "desc"];

  return {
    field,
    ascending: direction === "asc",
  };
}

function renderRows(rows) {
  bodyEl.innerHTML = "";

  rows.forEach((row, index) => {
    const tr = document.createElement("tr");

    if (row.isAverageRow) {
      tr.classList.add("average-row");
    }

    const deviceDetailsButton = row.isAverageRow
      ? formatMeasurementsCount(row.tests_count)
      : `
        <button class="device-details-btn" type="button" data-device-index="${index}">
          Подробнее
        </button>
      `;

    const settingsDetailsButton = row.isAverageRow
      ? formatMeasurementsCount(row.tests_count)
      : `
        <button class="details-btn" type="button" data-index="${index}">
          Подробнее
        </button>
      `;

    tr.innerHTML = `
      <td>${row.isAverageRow ? "Среднее" : formatDate(row.created_at)}</td>

      <td>
        <div class="device-cell">
          <span class="device-name" title="${escapeHtml(row.device_text || "-")}">
            ${escapeHtml(row.device_text || "-")}
          </span>

          ${deviceDetailsButton}
        </div>
      </td>

      <td>${escapeHtml(row.solver || "-")}</td>
      <td>${escapeHtml(row.preset || "-")}</td>
      <td>${escapeHtml(row.performance_preset || "-")}</td>
      <td>${row.bodies ?? "-"}</td>
      <td>${formatNumber(row.fps, 0)}</td>
      <td>${formatNumber(row.elapsed_seconds, 1)}</td>
      <td>${formatNumber(row.physics_ms, 3)}</td>
      <td>${formatNumber(row.avg_physics_ms, 3)}</td>
      <td>${formatNumber(row.physics_load, 1)}%</td>
      <td>${formatNumber(row.energy_drift, 2)}%</td>
      <td>${formatNumber(row.kinetic_energy, 2)}</td>
      <td>${formatNumber(row.total_energy, 2)}</td>
      <td>${settingsDetailsButton}</td>
    `;

    bodyEl.appendChild(tr);
  });

  bodyEl.querySelectorAll(".details-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      openSettingsModal(rows[index]);
    });
  });

  bodyEl.querySelectorAll(".device-details-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.deviceIndex);
      openDeviceModal(rows[index]);
    });
  });

  statusEl.style.display = "none";
  tableEl.style.display = "table";
}

async function loadResults() {
  statusEl.style.display = "block";
  tableEl.style.display = "none";
  statusEl.textContent = "Загрузка результатов...";

  const sort = getSortConfig();

  const { data, error } = await supabase
    .from("benchmark_results")
    .select("*")
    .order(sort.field, { ascending: sort.ascending })
    .limit(200);

  if (error) {
    console.error("Ошибка загрузки результатов:", error);
    statusEl.textContent = "Не удалось загрузить результаты.";
    return;
  }

  if (!data || data.length === 0) {
    statusEl.textContent = "Пока нет сохранённых результатов.";
    return;
  }

  currentRows = data;

  const rowsToRender = showAverageByDevice
    ? buildAveragesByDevice(currentRows)
    : currentRows;

  renderRows(rowsToRender);
}

sortSelect?.addEventListener("change", loadResults);

averageByDeviceBtn?.addEventListener("click", () => {
  showAverageByDevice = !showAverageByDevice;

  averageByDeviceBtn.classList.toggle("active", showAverageByDevice);
  averageByDeviceBtn.textContent = showAverageByDevice
    ? "Показать все результаты"
    : "Среднее по устройствам";

  const rowsToRender = showAverageByDevice
    ? buildAveragesByDevice(currentRows)
    : currentRows;

  renderRows(rowsToRender);
});

loadResults();
