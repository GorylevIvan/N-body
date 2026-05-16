import { supabase } from "./supabaseClient.js";

const statusEl = document.getElementById("status");
const tableEl = document.getElementById("resultsTable");
const bodyEl = document.getElementById("resultsBody");

const settingsModal = document.getElementById("settingsModal");
const settingsModalBody = document.getElementById("settingsModalBody");
const closeSettingsModal = document.getElementById("closeSettingsModal");

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

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return Number(value).toFixed(digits);
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
  if (event.key === "Escape" && !settingsModal.hidden) {
    closeModal();
  }
});

async function loadResults() {
  statusEl.textContent = "Загрузка результатов...";

  const { data, error } = await supabase
    .from("benchmark_results")
    .select("*")
    .order("created_at", { ascending: false })
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

  bodyEl.innerHTML = "";

  data.forEach((row, index) => {
    const tr = document.createElement("tr");

    const performancePreset = row.performance_preset || "-";

    tr.innerHTML = `
      <td>${formatDate(row.created_at)}</td>
      <td class="device" title="${escapeHtml(row.user_agent || "")}">
        ${escapeHtml(row.device_text || "-")}
      </td>
      <td>${escapeHtml(row.solver || "-")}</td>
      <td>${escapeHtml(row.preset || "-")}</td>
      <td>${escapeHtml(performancePreset)}</td>
      <td>${row.bodies ?? "-"}</td>
      <td>${formatNumber(row.fps, 0)}</td>
      <td>${formatNumber(row.physics_ms, 3)}</td>
      <td>${formatNumber(row.avg_physics_ms, 3)}</td>
      <td>${formatNumber(row.physics_load, 1)}%</td>
      <td>${formatNumber(row.energy_drift, 2)}%</td>
      <td>${formatNumber(row.kinetic_energy, 2)}</td>
      <td>${formatNumber(row.total_energy, 2)}</td>  
      <td>
        <button class="details-btn" type="button" data-index="${index}">
          Подробнее
        </button>
      </td>
    `;

    bodyEl.appendChild(tr);
  });

  bodyEl.querySelectorAll(".details-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      openSettingsModal(data[index]);
    });
  });

  statusEl.style.display = "none";
  tableEl.style.display = "table";
}

loadResults();
