
/* ========================================================================
   Daily Objectives – App Logic (full replacement)
   ======================================================================== */

/* --------------------------- DEFAULT CONFIG ---------------------------- */

const DEFAULT_OBJECTIVES = Array.from({ length: 30 }, (_, i) => `Objective ${i + 1}`);

const DEFAULT_ACTIVITIES = [
  { label: "Cold shower", points: 2 },
  { label: "10-min breathwork", points: 1 },
  { label: "30-min run", points: 3 },
  { label: "Strength session", points: 4 },
  { label: "Long walk 60+ min", points: 2 },
  { label: "Deep clean kitchen", points: 1 },
  { label: "Call a friend", points: 1 },
  { label: "No phone 2 hrs", points: 2 },
  { label: "1h focused reading", points: 2 },
  { label: "Volunteer/help someone", points: 5 }
];

/* ----------------------------- PERSISTENCE ----------------------------- */

const LS_KEY = "daily-objectives-app-v3"; // bump to invalidate older schemas

function loadState() {
  const now = new Date();
  const raw = localStorage.getItem(LS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      // Defensive fill of any missing keys if schema changed
      return {
        today: parsed.today || now.toISOString(),
        objectives: Array.isArray(parsed.objectives) ? parsed.objectives : DEFAULT_OBJECTIVES,
        doneIds: Array.isArray(parsed.doneIds) ? parsed.doneIds : [],
        activities: Array.isArray(parsed.activities) ? parsed.activities : DEFAULT_ACTIVITIES,
        activitiesToday: Array.isArray(parsed.activitiesToday) ? parsed.activitiesToday : [],
        rollingTotal: Number.isFinite(parsed.rollingTotal) ? parsed.rollingTotal : 0,
        history: Array.isArray(parsed.history) ? parsed.history : [],
        adjustmentsToday: Array.isArray(parsed.adjustmentsToday) ? parsed.adjustmentsToday : []
      };
    } catch {
      // fall through to fresh state
    }
  }
  return {
    today: now.toISOString(),
    objectives: DEFAULT_OBJECTIVES,
    doneIds: [],
    activities: DEFAULT_ACTIVITIES,
    activitiesToday: [],
    rollingTotal: 0,
    history: [],
    adjustmentsToday: []
  };
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

let state = loadState();

/* ------------------------------ UTILITIES ------------------------------ */

function isSameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Safe DOM helper – returns element or null (never throws)
 */
function $(id) {
  return document.getElementById(id);
}

/* ---------------------------- DAY ROLLOVER ----------------------------- */

function startNewDay() {
  // Close out previous day into history
  const previous = new Date(state.today);
  const dailyTotal = state.doneIds.length;
  const adjSum = state.adjustmentsToday.reduce((s, a) => s + Number(a.amount || 0), 0);
  const actSum = state.activitiesToday.reduce((s, a) => s + Number(a.points || 0), 0);
  const net = dailyTotal - adjSum - actSum;

  if (dailyTotal !== 0 || adjSum !== 0 || actSum !== 0) {
    state.history.push({
      dateISO: previous.toISOString(),
      dailyTotal,
      adjustments: state.adjustmentsToday.slice(),
      activities: state.activitiesToday.slice(),
      net
    });
    state.rollingTotal += net;
  }

  state.today = new Date().toISOString();
  state.doneIds = [];
  state.adjustmentsToday = [];
  state.activitiesToday = [];
  saveState();

  renderAll();
  updateCounts();
}

/* ----------------------------- RENDERING ------------------------------- */

function renderAll() {
  // Header stats date
  const todayEl = $("today-date");
  if (todayEl) todayEl.textContent = new Date(state.today).toLocaleDateString();

  renderObjectives();
  renderAdjustments();
  renderActivities();
  updateCounts();
}

function renderObjectives() {
  const grid = $("button-list");
  if (!grid) return;
  grid.innerHTML = "";

  const remaining = state.objectives
    .map((label, id) => ({ id, label }))
    .filter((item) => !state.doneIds.includes(item.id));

  const emptyState = $("empty-state");
  if (emptyState) emptyState.classList.toggle("hidden", remaining.length !== 0);

  remaining.forEach((item) => {
    const card = document.createElement("div");
    card.className = "button-item";
    card.dataset.id = String(item.id);
    card.innerHTML = `<div class="label">${item.label}</div>`;
    card.addEventListener("click", () => markObjectiveDone(item.id));
    grid.appendChild(card);
  });

  const totalCount = $("total-count");
  if (totalCount) totalCount.textContent = String(state.objectives.length);
}

function renderAdjustments() {
  const adjList = $("adjustments-list");
  if (!adjList) return;
  adjList.innerHTML = "";
  state.adjustmentsToday.forEach((a, idx) => {
    const li = document.createElement("li");
    li.textContent = `${a.amount} ${a.reason ? "— " + a.reason : ""}`;
    li.title = "Tap to remove";
    li.addEventListener("click", () => {
      state.adjustmentsToday.splice(idx, 1);
      saveState();
      updateCounts();
      renderAdjustments();
    });
    adjList.appendChild(li);
  });
}

function renderActivities() {
  // Catalog
  const list = $("activities-list");
  if (list) {
    list.innerHTML = "";
    (state.activities || []).forEach((act, idx) => {
      const card = document.createElement("div");
      card.className = "button-item";
      card.innerHTML = `
        <div class="label">${act.label}</div>
        <div class="points">−${act.points} pts</div>`;
      card.addEventListener("click", () => applyActivity(idx));
      list.appendChild(card);
    });
  }

  // Applied today
  const applied = $("activities-applied-list");
  if (applied) {
    applied.innerHTML = "";
    (state.activitiesToday || []).forEach((entry, i) => {
      const li = document.createElement("li");
      const left = document.createElement("div");
      left.textContent = `${entry.label} (−${entry.points})`;
      const undo = document.createElement("button");
      undo.textContent = "Undo";
      undo.className = "undo";
      undo.addEventListener("click", () => {
        state.activitiesToday.splice(i, 1);
        saveState();
        updateCounts();
        renderActivities();
      });
      li.appendChild(left);
      li.appendChild(undo);
      applied.appendChild(li);
    });
  }
}

/* --------------------------- USER INTERACTIONS ------------------------- */

function markObjectiveDone(id) {
  if (!state.doneIds.includes(id)) {
    state.doneIds.push(id);
    saveState();
    renderObjectives();
    updateCounts();
  }
}

function applyActivity(idx) {
  const act = state.activities[idx];
  state.activitiesToday.push({
    idx,
    label: act.label,
    points: Number(act.points) || 0,
    tsISO: new Date().toISOString()
  });
  saveState();
  updateCounts();
  renderActivities();
}

function updateCounts() {
  const completed = state.doneIds.length;
  const completedEl = $("completed-count");
  if (completedEl) completedEl.textContent = String(completed);

  const adjSum = state.adjustmentsToday.reduce((s, a) => s + Number(a.amount || 0), 0);
  const actSum = state.activitiesToday.reduce((s, a) => s + Number(a.points || 0), 0);
  const dailyNet = completed - adjSum - actSum;

  const dailyScoreEl = $("daily-score");
  if (dailyScoreEl) dailyScoreEl.textContent = String(dailyNet);

  const rollingEl = $("rolling-total");
  if (rollingEl) rollingEl.textContent = String(state.rollingTotal + dailyNet);
}

/* ------------------------------- WIRING -------------------------------- */

function wireEvents() {
  // ----- Tabs -----
  const tabButtons = document.querySelectorAll(".tab-button");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.getAttribute("data-tab");
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
      const panel = document.getElementById(`tab-${tab}`);
      if (panel) panel.classList.remove("hidden");
    });
  });

  // ----- Adjustments -----
  const adjustForm = $("adjust-form");
  if (adjustForm) {
    adjustForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const amtEl = $("adjust-amount");
      const reasonEl = $("adjust-reason");
      const amt = Number(amtEl ? amtEl.value : 0);
      const reason = reasonEl ? reasonEl.value.trim() : "";
      if (!Number.isFinite(amt)) return;
      state.adjustmentsToday.push({ amount: amt, reason });
      if (amtEl) amtEl.value = "";
      if (reasonEl) reasonEl.value = "";
      saveState();
      updateCounts();
      renderAdjustments();
    });
  }

  // ----- Reset day -----
  const resetBtn = $("reset-day");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Start a new day? This logs today into history and resets buttons/activities.")) {
        startNewDay();
      }
    });
  }

  // ----- Objectives editor -----
  const objModal = $("editor-modal");
  const objEditBtn = $("edit-objectives");
  const objSaveBtn = $("save-objectives");
  const objCancelBtn = $("cancel-editor");
  const objTextarea = $("editor-text");

  if (objEditBtn && objModal && objTextarea) {
    objEditBtn.addEventListener("click", () => {
      objTextarea.value = (state.objectives || []).join("\n");
      objModal.classList.remove("hidden");
    });
  }

  if (objSaveBtn && objModal && objTextarea) {
    objSaveBtn.addEventListener("click", () => {
      const lines = objTextarea.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (lines.length === 0) {
        alert("Provide at least one objective.");
        return;
      }
      state.objectives = lines;
      // Drop completed ids that exceed new length
      state.doneIds = state.doneIds.filter((id) => id < lines.length);
      saveState();
      objModal.classList.add("hidden");
      renderObjectives();
      updateCounts();
    });
  }

  if (objCancelBtn && objModal) {
    objCancelBtn.addEventListener("click", () => objModal.classList.add("hidden"));
  }

  // ----- Activities editor -----
  const actModal = $("activities-editor-modal");
  const actEditBtn = $("edit-activities");
  const actSaveBtn = $("save-activities");
  const actCancelBtn = $("cancel-activities-editor");
  const actTextarea = $("activities-editor-text");

  if (actEditBtn && actModal && actTextarea) {
    actEditBtn.addEventListener("click", () => {
      const text = (state.activities || [])
        .map((a) => `${a.label} | ${a.points}`)
        .join("\n");
      actTextarea.value = text;
      actModal.classList.remove("hidden"); // <-- open only on click
    });
  }

  if (actSaveBtn && actModal && actTextarea) {
    actSaveBtn.addEventListener("click", () => {
      const lines = actTextarea.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const parsed = [];
      for (const line of lines) {
        const [labelRaw, pointsRaw] = line.split("|").map((x) => (x ?? "").trim());
        const label = labelRaw;
        const pts = Number(pointsRaw);
        if (!label) {
          alert(`Missing label on: "${line}"`);
          return;
        }
        if (!Number.isFinite(pts) || pts < 1 || pts > 5) {
          alert(`Points must be 1–5 on: "${line}"`);
          return;
        }
        parsed.push({ label, points: Math.round(pts) });
      }

      state.activities = parsed;
      saveState();
      actModal.classList.add("hidden");
      renderActivities();
      updateCounts();
    });
  }

  if (actCancelBtn && actModal) {
    actCancelBtn.addEventListener("click", () => actModal.classList.add("hidden"));
  }

  // ----- Export -----
  const exportBtn = $("export-data");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const data = {
        today: state.today,
        objectives: state.objectives,
        doneIds: state.doneIds,
        activities: state.activities,
        activitiesToday: state.activitiesToday,
        rollingTotal: state.rollingTotal,
        history: state.history,
        adjustmentsToday: state.adjustmentsToday
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = `daily-objectives-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // ----- Midnight roll: check once per minute -----
  setInterval(() => {
    const now = new Date();
    if (!isSameDate(new Date(state.today), now)) startNewDay();
  }, 60_000);
}

/* --------------------------- APP ENTRY POINT --------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  // Force-hide modals on first load (belt-and-braces)
  $("activities-editor-modal")?.classList.add("hidden");
  $("editor-modal")?.classList.add("hidden");

  renderAll();
  wireEvents();

  // If saved date is not today, roll to new day
  if (!isSameDate(new Date(state.today), new Date())) {
    startNewDay();
  } else {
    updateCounts();
  }
});
