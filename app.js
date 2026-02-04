
// -------- CONFIG --------
const DEFAULT_OBJECTIVES = Array.from({length: 30}, (_, i) => `Objective ${i+1}`);

// -------- STATE --------
const LS_KEY = 'daily-objectives-app-v1';
const state = loadState();

// -------- INIT --------
document.addEventListener('DOMContentLoaded', () => {
  render();
  wireEvents();
  // If the saved date is not today, roll to a new day
  if (!isSameDate(new Date(state.today), new Date())) startNewDay();
  // Refresh UI counts
  updateCounts();
});

function loadState() {
  const now = new Date();
  const raw = localStorage.getItem(LS_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch { /* fallthrough */ }
  }
  return {
    today: now.toISOString(),
    objectives: DEFAULT_OBJECTIVES,
    doneIds: [],                  // ids of completed objectives today
    rollingTotal: 0,              // cumulative total across days
    history: [],                  // [{dateISO, dailyTotal, adjustments: [{amount, reason}]}]
    adjustmentsToday: []          // [{amount, reason}]
  };
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function startNewDay() {
  // Close out yesterday into history:
  const yesterday = new Date(state.today);
  const dailyTotal = state.doneIds.length;
  const adjSum = state.adjustmentsToday.reduce((s,a)=>s + Number(a.amount||0), 0);
  const net = dailyTotal - adjSum;
  if (state.doneIds.length > 0 || adjSum !== 0) {
    state.history.push({
      dateISO: yesterday.toISOString(),
      dailyTotal,
      adjustments: state.adjustmentsToday.slice(),
      net
    });
    state.rollingTotal += net;
  }

  // Reset for today
  state.today = new Date().toISOString();
  state.doneIds = [];
  state.adjustmentsToday = [];
  saveState();
  render();
  updateCounts();
}

function render() {
  const dateEl = document.getElementById('today-date');
  dateEl.textContent = new Date(state.today).toLocaleDateString();

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
    card.addEventListener('click', () => markDone(item.id));
    grid.appendChild(card);
  });

  // Adjustments list
  const adjList = document.getElementById('adjustments-list');
  adjList.innerHTML = '';
  state.adjustmentsToday.forEach((a, idx) => {
    const li = document.createElement('li');
    li.textContent = `${a.amount} ${a.reason ? '— ' + a.reason : ''}`;
    li.addEventListener('click', () => {
      state.adjustmentsToday.splice(idx, 1);
      saveState(); updateCounts(); render();
    });
    adjList.appendChild(li);
  });

  document.getElementById('total-count').textContent = state.objectives.length;
}

function markDone(id) {
  if (!state.doneIds.includes(id)) {
    state.doneIds.push(id);
    saveState();
    render();
    updateCounts();
  }
}

function updateCounts() {
  document.getElementById('completed-count').textContent = state.doneIds.length;
  const daily = state.doneIds.length;
  const adjSum = state.adjustmentsToday.reduce((s,a)=>s + Number(a.amount||0), 0);
  document.getElementById('daily-score').textContent = (daily - adjSum);
  document.getElementById('rolling-total').textContent = (state.rollingTotal + (daily - adjSum));
}

function wireEvents() {
  // Adjustments
  document.getElementById('adjust-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const amt = Number(document.getElementById('adjust-amount').value);
    const reason = document.getElementById('adjust-reason').value.trim();
    if (!Number.isFinite(amt)) return;
    state.adjustmentsToday.push({ amount: amt, reason });
    document.getElementById('adjust-amount').value = '';
    document.getElementById('adjust-reason').value = '';
    saveState(); updateCounts(); render();
  });

  // Reset day (closes previous, starts new)
  document.getElementById('reset-day').addEventListener('click', () => {
    if (confirm('Start a new day? This logs today into history and resets buttons.')) {
      startNewDay();
    }
  });

  // Editor modal
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
    // Remove doneIds that exceed new length
    state.doneIds = state.doneIds.filter(id => id < lines.length);
    saveState(); modal.classList.add('hidden'); render(); updateCounts();
  });
  document.getElementById('cancel-editor').addEventListener('click', () => modal.classList.add('hidden'));

  // Export data
  document.getElementById('export-data').addEventListener('click', () => {
    const data = {
      today: state.today,
      objectives: state.objectives,
      doneIds: state.doneIds,
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

  // Midnight roll: check each minute whether the date changed
  setInterval(() => {
    const now = new Date();
    if (!isSameDate(new Date(state.today), now)) startNewDay();
  }, 60000);
}
