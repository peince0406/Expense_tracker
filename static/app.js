// ─── State ───
let activeFilter = 'all';
let activeCat    = 'all';
let customRange  = null;

const CAT_EMOJI = {
  Groceries: '🛒', Leisure: '🎮', Electronics: '💻',
  Utilities: '💡', Clothing: '👕', Health: '🏥', Others: '📦'
};

// ─── Init ───
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('f-date').value = today();
  const res  = await fetch('/api/me');
  const data = await res.json();
  if (data.logged_in) {
    document.getElementById('top-username').textContent = data.username;
    showApp();
  }

  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
});

// ─── Auth ───
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b, i) =>
    b.classList.toggle('active', (i===0 && tab==='login') || (i===1 && tab==='signup'))
  );
  document.getElementById('login-form').style.display  = tab === 'login'  ? '' : 'none';
  document.getElementById('signup-form').style.display = tab === 'signup' ? '' : 'none';
  document.getElementById('login-err').textContent  = '';
  document.getElementById('signup-err').textContent = '';
}

async function doSignup() {
  const username = document.getElementById('su-user').value.trim();
  const email    = document.getElementById('su-email').value.trim();
  const password = document.getElementById('su-pass').value;
  const errEl    = document.getElementById('signup-err');
  errEl.textContent = '';

  const res  = await fetch('/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });
  const data = await res.json();

  if (!res.ok) return errEl.textContent = data.error;
  document.getElementById('top-username').textContent = data.username;
  showToast(data.message, 'success');
  showApp();
}

async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const errEl    = document.getElementById('login-err');
  errEl.textContent = '';

  const res  = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();

  if (!res.ok) return errEl.textContent = data.error;
  document.getElementById('top-username').textContent = data.username;
  showToast(data.message, 'success');
  showApp();
}

async function doLogout() {
  await fetch('/api/logout', { method: 'POST' });
  activeFilter = 'all'; activeCat = 'all'; customRange = null;
  document.getElementById('app-screen').style.display  = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  switchTab('login');
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display  = 'block';
  loadExpenses();
  loadStats();
}

// ─── Expenses ───
async function loadExpenses() {
  let url = `/api/expenses?filter=${activeFilter}&category=${activeCat}`;
  if (activeFilter === 'custom' && customRange) {
    url += `&start=${customRange.start}&end=${customRange.end}`;
  }

  const res      = await fetch(url);
  const expenses = await res.json();
  renderExpenses(expenses);
}

async function loadStats() {
  const res  = await fetch('/api/stats');
  const data = await res.json();
  document.getElementById('stat-total').textContent = '₹' + fmtNum(data.total);
  document.getElementById('stat-month').textContent = '₹' + fmtNum(data.this_month);
  document.getElementById('stat-count').textContent = data.count;
}

function renderExpenses(list) {
  const el = document.getElementById('expense-list');
  if (!list.length) {
    el.innerHTML = `
      <div class="empty-state">
        <span class="emoji">💸</span>
        <p>Koi expense nahi mili</p>
        <span>Add karo ya filter change karo</span>
      </div>`;
    return;
  }

  el.innerHTML = list.map(e => `
    <div class="expense-item">
      <div class="cat-dot cat-${e.category}">${CAT_EMOJI[e.category] || '📦'}</div>
      <div class="expense-info">
        <div class="expense-title">${esc(e.title)}</div>
        <div class="expense-meta">${e.category} · ${fmtDate(e.date)}${e.description ? ' · ' + esc(e.description) : ''}</div>
      </div>
      <div class="expense-amount">₹${fmtNum(e.amount)}</div>
      <div class="expense-actions">
        <button class="action-btn" onclick="editExpense(${e.id})" title="Edit">✏️</button>
        <button class="action-btn danger" onclick="deleteExpense(${e.id})" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function saveExpense() {
  const id       = document.getElementById('edit-id').value;
  const title    = document.getElementById('f-title').value.trim();
  const amount   = document.getElementById('f-amount').value;
  const date     = document.getElementById('f-date').value;
  const category = document.getElementById('f-category').value;
  const description = document.getElementById('f-desc').value.trim();

  const method = id ? 'PUT' : 'POST';
  const url    = id ? `/api/expenses/${id}` : '/api/expenses';

  const res  = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, amount: parseFloat(amount), date, category, description })
  });
  const data = await res.json();

  if (!res.ok) return showToast(data.error, 'error');
  showToast(data.message, 'success');
  closeModal();
  loadExpenses();
  loadStats();
}

async function deleteExpense(id) {
  if (!confirm('Kya aap sure hain? Yeh expense delete ho jayegi.')) return;
  const res  = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) return showToast(data.error, 'error');
  showToast(data.message, 'success');
  loadExpenses();
  loadStats();
}

async function editExpense(id) {
  const res      = await fetch(`/api/expenses?filter=all&category=all`);
  const expenses = await res.json();
  const exp      = expenses.find(e => e.id === id);
  if (!exp) return;

  document.getElementById('modal-title').textContent = 'Expense Edit Karo';
  document.getElementById('edit-id').value           = exp.id;
  document.getElementById('f-title').value           = exp.title;
  document.getElementById('f-amount').value          = exp.amount;
  document.getElementById('f-date').value            = exp.date.split('T')[0];
  document.getElementById('f-category').value        = exp.category;
  document.getElementById('f-desc').value            = exp.description || '';
  openModal();
}

// ─── Filters ───
function setFilter(f, btn) {
  activeFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('custom-filter').classList.remove('open');
  updateFilterLabel();
  loadExpenses();
}

function toggleCustom(btn) {
  const box  = document.getElementById('custom-filter');
  const open = box.classList.toggle('open');
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (open) btn.classList.add('active');
}

function applyCustomFilter() {
  const start = document.getElementById('filter-start').value;
  const end   = document.getElementById('filter-end').value;
  activeFilter = 'custom';
  customRange  = { start, end };
  updateFilterLabel();
  loadExpenses();
}

function setCatFilter(cat, btn) {
  activeCat = cat;
  document.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadExpenses();
}

function updateFilterLabel() {
  const labels = {
    all: 'Saari expenses dikh rahi hain',
    past_week: 'Pichhle 7 din ki expenses',
    past_month: 'Pichhle 30 din ki expenses',
    last_3_months: 'Pichhe 3 mahine ki expenses',
    custom: customRange ? `${customRange.start || '...'} se ${customRange.end || '...'}` : 'Custom range'
  };
  document.getElementById('filter-label').textContent = labels[activeFilter] || '';
}

// ─── Modal ───
function openModal() { document.getElementById('modal').classList.add('open'); }

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  document.getElementById('modal-title').textContent = 'Nayi Expense';
  document.getElementById('edit-id').value = '';
  ['f-title','f-amount','f-desc'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-date').value     = today();
  document.getElementById('f-category').value = 'Groceries';
}

// ─── Utils ───
function today() { return new Date().toISOString().split('T')[0]; }

function fmtDate(d) {
  return new Date(d).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtNum(n) {
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast ${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}
