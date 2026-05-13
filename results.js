import { supabase } from "./supabaseClient.js";

const statusEl = document.getElementById("status");
const tableEl = document.getElementById("resultsTable");
const bodyEl = document.getElementById("resultsBody");

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

  for (const row of data) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${formatDate(row.created_at)}</td>
      <td class="device" title="${row.user_agent || ""}">${row.device_text || "-"}</td>
      <td>${row.solver || "-"}</td>
      <td>${row.preset || "-"}</td>
      <td>${row.bodies ?? "-"}</td>
      <td>${formatNumber(row.fps, 0)}</td>
      <td>${formatNumber(row.physics_ms, 3)}</td>
      <td>${formatNumber(row.avg_physics_ms, 3)}</td>
      <td>${formatNumber(row.physics_load, 1)}%</td>
      <td>${formatNumber(row.kinetic_energy, 2)}</td>
      <td>${formatNumber(row.total_energy, 2)}</td>
      <td>${formatNumber(row.energy_drift, 2)}%</td>
    `;

    bodyEl.appendChild(tr);
  }

  statusEl.style.display = "none";
  tableEl.style.display = "table";
}

loadResults();
