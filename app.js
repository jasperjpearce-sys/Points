
// -------- CONFIG --------
const DEFAULT_OBJECTIVES = Array.from({length: 30}, (_, i) => `Objective ${i+1}`);

// NEW: default activities with points (1–5)
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

// -------- STATE --------
const LS_KEY = 'daily-objectives-app-v3'; // bump to v3 for new structure
const state = loadState();

// -------- INIT --------
document.addEventListener('DOMContentLoaded', () => {
  renderAll();
  wireEvents();
  if (!isSameDate(new Date(state.today), new Date())) startNewDay();
  updateCounts();
});

// -------- LOAD / SAVE --------
function loadState() {
  const now = new Date();
  const raw = localStorage.getItem(LS_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  return {
    today: now.toISOString(),
    objectives: DEFAULT_OBJECTIVES,
    doneIds: [],                     // completed objective ids today
    // NEW
    activities: DEFAULT_ACTIVITIES,  // catalog of activities {label, points}
    activitiesToday: [],             // entries: {idx, label, points, tsISO}
    rollingTotal: 0,
    history: [],                     // [{dateISO, dailyTotal, adjustments[], activities[], net}]
    adjustmentsToday: []             // [{amount, reason}]
  };
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

// -------- UTIL --------
function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

// -------- DAY ROLLOVER --------
function startNewDay() {
  // Close out previous day into history
  const previous = new Date(state.today);
  const dailyTotal = state.doneIds.length;
  const adjSum = state.adjustmentsToday.reduce((s,a)=>s + Number(a.amount||0), 0);
  const actSum = state.activitiesToday.reduce((s,a)=>s + Number(a.points||0), 0);
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

// -------- RENDER --------
function renderAll() {
  // header stats date
  document.getElementById('today-date').textContent =
    new Date(state.today).toLocaleDateString();

  renderObjectives();
  renderAdjustments();
  renderActivities();
}

function renderObjectives() {
  const grid = document.getElementById('button-list');
  grid.innerHTML = '';

  const remaining = state.objectives
    .map((label, id) => ({ id, label }))
    .filter(item => !state.doneIds.includes(item.id));

  document.getElementById('empty-state').classList.toggle('hidden', remaining.length !== 0);

  remaining.forEach(item => {
    const card = document.createElement('div');
    card.className = 'button-item';
    card.dataset.id = item.id;
    card.innerHTML = `<div class="label">${item.label}</div>`;
    card.addEventListener('click', () => markObjectiveDone(item.id));
    grid.appendChild(card);
  });

  document.getElementById('total-count').textContent = state.objectives.length;
}

function renderAdjustments() {
  const adjList = document.getElementById('adjustments-list');
  adjList.innerHTML = '';
  state.adjustmentsToday.forEach((a, idx) => {
    const li = document.createElement('li');
    li.textContent = `${a.amount} ${a.reason ? '— ' + a.reason : ''}`;
    li.title = "Tap to remove";
    li.addEventListener('click', () => {
      state.adjustmentsToday.splice(idx, 1);
      saveState(); updateCounts(); renderAdjustments();
    });
    adjList.appendChild(li);
  });
}

function renderActivities() {
  // Activities catalog (buttons)
  const list = document.getElementById('activities-list');
  list.innerHTML = '';
  state.activities.forEach((act, idx) => {
    const card = document.createElement('div');
    card.className = 'button-item';
    card.innerHTML = `
      <div class="label">${act.label}</div>
      <div class="points">−${act.points} pts</div>`;
    card.addEventListener('click', () => applyActivity(idx));
    list.appendChild(card);
  });

  // Applied today (with undo)
  const applied = document.getElementById('activities-applied-list');
  applied.innerHTML = '';
  state.activitiesToday.forEach((entry, i) => {
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.textContent = `${entry.label} (−${entry.points})`;
    const right = document.createElement('button');
    right.textContent = 'Undo';
    right.className = 'undo';
    right.addEventListener('click', () => {
      state.activitiesToday.splice(i, 1);
      saveState(); updateCounts(); renderActivities();
    });
    li.appendChild(left);
    li.appendChild(right);
    applied.appendChild(li);
  });
}

// -------- INTERACTIONS --------
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
    idx, label: act.label, points: Number(act.points) || 0,
    tsISO: new Date().toISOString()
  });
  saveState(); updateCounts(); renderActivities();
}

function updateCounts() {
  const completed = state.doneIds.length;
  document.getElementById('completed-count').textContent = completed;

  const adjSum = state.adjustmentsToday.reduce((s,a)=>s + Number(a.amount||0), 0);
  const actSum = state.activitiesToday.reduce((s,a)=>s + Number(a.points||0), 0);
  const dailyNet = completed - adjSum - actSum;

  document.getElementById('daily-score').textContent = dailyNet;
  document.getElementById('rolling-total').textContent = state.rollingTotal + dailyNet;
}

// -------- WIRE UI --------
function wireEvents() {
  // Tabs
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      document.getElementById(`tab-${tab}`).classList.remove('hidden');
    });
  });

  // Adjustments
  document.getElementById('adjust-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const amt = Number(document.getElementById('adjust-amount').value);
    const reason = document.getElementById('adjust-reason').value.trim();
    if (!Number.isFinite(amt)) return;
    state.adjustmentsToday.push({ amount: amt, reason });
    document.getElementById('adjust-amount').value = '';
    document.getElementById('adjust-reason').value = '';
    saveState(); updateCounts(); renderAdjustments();
  });

  // Reset day
  document.getElementById('reset-day').addEventListener('click', () => {
    if (confirm('Start a new day? This logs today into history and resets buttons/activities.')) {
      startNewDay();
    }
  });

  // Objectives editor
  const modal = document.getElementById('editor-modal');
  document.getElementById('edit-objectives').addEventListener('click', () => {
    document.getElementById('editor-text').value = state.objectives.join('\n');
    modal.classList.remove('hidden');
  });
  document.getElementById('save-objectives').addEventListener('click', () => {
    const lines = document.getElementById('editor-text').value
      .split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) return alert('Provide at least one objective.');
    state.objectives = lines;
    state.doneIds = state.doneIds.filter(id => id < lines.length);
    saveState(); modal.classList.add('hidden'); renderObjectives(); updateCounts();
  });
  document.getElementById('cancel-editor').addEventListener('click', () => modal.classList.add('hidden'));

  // Activities editor
  const actModal = document.getElementById('activities-editor-modal');
  document.getElementById('edit-activities').addEventListener('click', () => {
    // populate text as "Label | Points"
    const text = state.activities.map(a => `${a.label} | ${a.points}`).join('\n');
    document.getElementById('activities-editor-text').value = text;
    actModal.classList.remove('hidden');
  });
  document.getElementById('save-activities').addEventListener('click', () => {
    const lines = document.getElementById('activities-editor-text').value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    const parsed = [];
    for (const line of lines) {
      const [labelRaw, pointsRaw] = line.split('|').map(x => (x ?? '').trim());
      const label = labelRaw;
      const pts = Number(pointsRaw);
      if (!label) return alert(`Missing label on: "${line}"`);
      if (!Number.isFinite(pts) || pts < 1 || pts > 5) {
        return alert(`Points must be 1–5 on: "${line}"`);
      }
      parsed.push({ label, points: Math.round(pts) });
    }
    state.activities = parsed;
    saveState(); actModal.classList.add('hidden'); renderActivities(); updateCounts();
  });
  document.getElementById('cancel-activities-editor').addEventListener('click', () => actModal.classList.add('hidden'));

  // Midnight roll: check each minute whether the date changed
  setInterval(() => {
    const now = new Date();
    if (!isSameDate(new Date(state.today), now)) startNewDay();
  }, 60000);

  // Initial tab state
  document.querySelector('[data-tab="objectives"]').click();
}

// -------- EXPORT --------
document.getElementById('export-data').addEventListener('click', () => {
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
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `daily-objectives-export-${new Date().toISOString().slice(0,10)}.json`;
  a.href = url; a.click();
  URL.revokeObjectURL(url);
});
