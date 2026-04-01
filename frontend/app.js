// ─── Constants ────────────────────────────────────────────────────────────────
const STATUSES = [
  'Nowy', 'Zadzwoniłem', 'Nieodebrany', 'Zainteresowany',
  'Niezainteresowany', 'Klient', 'Dobry lead', 'Zły lead',
];

const STATUS_COLORS = {
  'Nowy':              '#3b82f6',
  'Zadzwoniłem':       '#f59e0b',
  'Nieodebrany':       '#ef4444',
  'Zainteresowany':    '#22c55e',
  'Niezainteresowany': '#9ca3af',
  'Klient':            '#f59e0b',
  'Dobry lead':        '#10b981',
  'Zły lead':          '#f43f5e',
};

// ─── State ────────────────────────────────────────────────────────────────────
let allLeads = [];
let currentView = 'dashboard';
let viewMode = 'table';
let sortState = { col: 'created_at', dir: -1 };
let activePanelLeadId = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupNav();
  setupSearchEnterKey();
  populateSelects();
  await loadLeads();
  switchView('dashboard');
});

function setupNav() {
  document.getElementById('main-nav').addEventListener('click', e => {
    const item = e.target.closest('.nav-item');
    if (item && item.dataset.view) switchView(item.dataset.view);
  });
}

function setupSearchEnterKey() {
  ['inp-query', 'inp-city'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') runSearch();
    });
  });
}

function populateSelects() {
  const filterSel = document.getElementById('f-status');
  const panelSel  = document.getElementById('panel-status-select');

  STATUSES.forEach(s => {
    filterSel.appendChild(new Option(s, s));
    panelSel.appendChild(new Option(s, s));
  });
}

// ─── Data ─────────────────────────────────────────────────────────────────────
async function loadLeads() {
  try {
    const res = await fetch('/leads');
    allLeads = await res.json();
    updateLeadsBadge();
  } catch {
    showToast('Błąd połączenia z backendem', 'error');
  }
}

function updateLeadsBadge() {
  document.getElementById('nav-leads-badge').textContent = allLeads.length || '';
}

// ─── View Management ──────────────────────────────────────────────────────────
function switchView(view) {
  currentView = view;

  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.nav-item[data-view="${view}"]`).classList.add('active');

  closePanel();

  if (view === 'dashboard') renderDashboard();
  if (view === 'leads')     renderLeadsView();
}

function setViewMode(mode) {
  viewMode = mode;
  document.querySelector('.toggle-table').classList.toggle('active', mode === 'table');
  document.querySelector('.toggle-kanban').classList.toggle('active', mode === 'kanban');
  document.getElementById('leads-table-view').style.display  = mode === 'table'  ? 'block' : 'none';
  document.getElementById('leads-kanban-view').style.display = mode === 'kanban' ? 'block' : 'none';
  renderLeadsView();
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function renderDashboard() {
  const total     = allLeads.length;
  const counts    = countByStatus(allLeads);
  const clients   = counts['Klient'] || 0;
  const interested = (counts['Zainteresowany'] || 0) + (counts['Dobry lead'] || 0);
  const noWeb     = allLeads.filter(l => l.website_status === 'bez_strony').length;
  const convPct   = total ? Math.round(clients / total * 100) : 0;

  document.getElementById('dash-cards').innerHTML = `
    <div class="stat-card c-blue">
      <div class="stat-label">Wszystkie leady</div>
      <div class="stat-value">${total}</div>
      <div class="stat-sub">W bazie danych</div>
    </div>
    <div class="stat-card c-green">
      <div class="stat-label">Klienci</div>
      <div class="stat-value">${clients}</div>
      <div class="stat-sub">${convPct}% konwersja</div>
    </div>
    <div class="stat-card c-gold">
      <div class="stat-label">Zainteresowani</div>
      <div class="stat-value">${interested}</div>
      <div class="stat-sub">Do zamknięcia</div>
    </div>
    <div class="stat-card c-purple">
      <div class="stat-label">Bez strony www</div>
      <div class="stat-value">${noWeb}</div>
      <div class="stat-sub">Potencjalni klienci</div>
    </div>
  `;

  // Status breakdown bars
  document.getElementById('status-breakdown').innerHTML = STATUSES.map(s => {
    const pct = total ? ((counts[s] || 0) / total * 100).toFixed(1) : 0;
    return `
      <div class="status-bar-row">
        <div class="status-bar-top">
          <span class="status-bar-name">${esc(s)}</span>
          <span class="status-bar-count">${counts[s] || 0}</span>
        </div>
        <div class="status-bar-track">
          <div class="status-bar-fill" style="width:${pct}%;background:${STATUS_COLORS[s]}"></div>
        </div>
      </div>
    `;
  }).join('');

  // Top cities
  const cities = groupByField(allLeads, 'city').slice(0, 6);
  document.getElementById('top-cities').innerHTML = cities.length
    ? cities.map(([name, count]) => `
        <div class="top-list-item">
          <span class="top-list-name">${esc(name)}</span>
          <span class="top-list-badge">${count}</span>
        </div>`).join('')
    : '<div style="color:var(--text-light);font-size:.84rem">Brak danych</div>';

  // Top categories
  const cats = groupByField(allLeads, 'category').slice(0, 6);
  document.getElementById('top-categories').innerHTML = cats.length
    ? cats.map(([name, count]) => `
        <div class="top-list-item">
          <span class="top-list-name">${esc(name)}</span>
          <span class="top-list-badge">${count}</span>
        </div>`).join('')
    : '<div style="color:var(--text-light);font-size:.84rem">Brak danych</div>';
}

function countByStatus(leads) {
  const c = {};
  STATUSES.forEach(s => c[s] = 0);
  leads.forEach(l => { if (c[l.status] !== undefined) c[l.status]++; });
  return c;
}

function groupByField(leads, field) {
  const map = {};
  leads.forEach(l => {
    const v = l[field];
    if (v) map[v] = (map[v] || 0) + 1;
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

// ─── Leads View ───────────────────────────────────────────────────────────────
function renderLeadsView() {
  const filtered = applySorting(getFilteredLeads());

  // Stats bar
  const total  = filtered.length;
  const counts = countByStatus(filtered);
  const badges = STATUSES
    .filter(s => counts[s] > 0)
    .map(s => `<span class="status-badge status-${esc(s)}">${esc(s)}: ${counts[s]}</span>`);

  document.getElementById('leads-stats').innerHTML =
    `<span>Leadów: <strong>${total}</strong></span>` + (badges.length ? '&nbsp; ' + badges.join(' ') : '');

  if (viewMode === 'table') renderTable(filtered);
  else                      renderKanban(filtered);
}

function getFilteredLeads() {
  const city     = document.getElementById('f-city').value.trim().toLowerCase();
  const category = document.getElementById('f-category').value.trim().toLowerCase();
  const status   = document.getElementById('f-status').value;
  const website  = document.getElementById('f-website').value;

  return allLeads.filter(l => {
    if (city     && !(l.city     || '').toLowerCase().includes(city))     return false;
    if (category && !(l.category || '').toLowerCase().includes(category)) return false;
    if (status   && l.status !== status)                                  return false;
    if (website  && l.website_status !== website)                         return false;
    return true;
  });
}

function clearFilters() {
  ['f-city', 'f-category', 'f-status', 'f-website'].forEach(id => {
    document.getElementById(id).value = '';
  });
  renderLeadsView();
}

// ─── Sort ─────────────────────────────────────────────────────────────────────
function sortBy(col) {
  sortState.dir = sortState.col === col ? sortState.dir * -1 : 1;
  sortState.col = col;
  updateSortIcons();
  renderLeadsView();
}

function updateSortIcons() {
  ['name', 'reviews_count', 'category', 'city', 'status', 'created_at'].forEach(col => {
    const el = document.getElementById('sort-' + col);
    if (el) el.textContent = sortState.col === col ? (sortState.dir === 1 ? ' ▲' : ' ▼') : '';
  });
}

function applySorting(leads) {
  if (!sortState.col) return leads;
  const { col, dir } = sortState;
  return [...leads].sort((a, b) => {
    let va = a[col] ?? '', vb = b[col] ?? '';
    if (col === 'reviews_count') return (Number(va) - Number(vb)) * dir;
    if (col === 'created_at')    return (new Date(va) - new Date(vb)) * dir;
    return String(va).localeCompare(String(vb), 'pl') * dir;
  });
}

// ─── Table Render ─────────────────────────────────────────────────────────────
function renderTable(leads) {
  const tbody = document.getElementById('leads-body');

  if (!leads.length) {
    tbody.innerHTML = `<tr><td colspan="10">
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-text">Brak leadów spełniających kryteria</div>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = leads.map(lead => `
    <tr onclick="openPanel('${lead.id}')">
      <td class="td-name" title="${esc(lead.name)}">${esc(lead.name)}</td>
      <td class="td-address" title="${esc(lead.address || '')}">${esc(lead.address || '—')}</td>
      <td class="td-phone">${lead.phone
        ? `<a href="tel:${esc(lead.phone)}" onclick="event.stopPropagation()">${esc(lead.phone)}</a>`
        : '—'}</td>
      <td class="td-reviews">${lead.reviews_count ?? 0}</td>
      <td>${esc(lead.category || '—')}</td>
      <td>${esc(lead.city || '—')}</td>
      <td>${websiteBadge(lead.website_status)}</td>
      <td><span class="status-badge status-${esc(lead.status)}">${esc(lead.status)}</span></td>
      <td class="td-date">${formatDate(lead.created_at)}</td>
      <td>
        <button class="btn-row-delete"
          onclick="event.stopPropagation(); confirmDelete('${lead.id}')"
          title="Usuń lead">✕</button>
      </td>
    </tr>
  `).join('');
}

// ─── Kanban Render ────────────────────────────────────────────────────────────
function renderKanban(leads) {
  const grouped = {};
  STATUSES.forEach(s => grouped[s] = []);
  leads.forEach(l => { if (grouped[l.status]) grouped[l.status].push(l); });

  document.getElementById('kanban-board').innerHTML = STATUSES.map(status => `
    <div class="kanban-col">
      <div class="kanban-col-header">
        <span class="kanban-col-title" style="color:${STATUS_COLORS[status]}">${esc(status)}</span>
        <span class="status-badge status-${esc(status)}">${grouped[status].length}</span>
      </div>
      ${grouped[status].length
        ? grouped[status].map(lead => `
            <div class="kanban-card" onclick="openPanel('${lead.id}')">
              <div class="kanban-card-name">${esc(lead.name)}</div>
              <div class="kanban-card-city">${[lead.city, lead.category].filter(Boolean).map(esc).join(' · ')}</div>
              ${lead.phone ? `<div class="kanban-card-phone">${esc(lead.phone)}</div>` : ''}
              <div class="kanban-card-footer">
                <span class="kanban-reviews">⭐ ${lead.reviews_count ?? 0}</span>
                ${websiteBadge(lead.website_status)}
              </div>
            </div>`).join('')
        : '<div class="kanban-empty">Brak</div>'
      }
    </div>
  `).join('');
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function openPanel(id) {
  const lead = allLeads.find(l => l.id === id);
  if (!lead) return;
  activePanelLeadId = id;

  document.getElementById('panel-status-tag').innerHTML =
    `<span class="status-badge status-${esc(lead.status)}">${esc(lead.status)}</span>`;
  document.getElementById('panel-name').textContent = lead.name;
  document.getElementById('panel-meta').textContent =
    [lead.category, lead.city].filter(Boolean).join(' · ');

  document.getElementById('panel-address').textContent = lead.address || '—';
  document.getElementById('panel-phone').innerHTML = lead.phone
    ? `<a href="tel:${esc(lead.phone)}">${esc(lead.phone)}</a>`
    : '—';
  document.getElementById('panel-reviews').textContent = `⭐ ${lead.reviews_count ?? 0} opinii`;
  document.getElementById('panel-website').innerHTML = websiteBadge(lead.website_status);
  document.getElementById('panel-date').textContent = formatDate(lead.created_at);

  document.getElementById('panel-status-select').value = lead.status;
  document.getElementById('panel-notes').value = lead.notes || '';

  document.getElementById('detail-panel').classList.add('open');
  document.getElementById('panel-overlay').classList.add('visible');
}

function closePanel() {
  activePanelLeadId = null;
  document.getElementById('detail-panel').classList.remove('open');
  document.getElementById('panel-overlay').classList.remove('visible');
}

async function savePanelChanges() {
  const id = activePanelLeadId;
  if (!id) return;
  const lead = allLeads.find(l => l.id === id);
  if (!lead) return;

  const newStatus = document.getElementById('panel-status-select').value;
  const newNotes  = document.getElementById('panel-notes').value;

  const tasks = [];

  if (newStatus !== lead.status) {
    tasks.push(
      fetch(`/leads/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      }).then(r => { if (r.ok) lead.status = newStatus; else throw new Error(); })
    );
  }

  if (newNotes !== (lead.notes || '')) {
    tasks.push(
      fetch(`/leads/${id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: newNotes }),
      }).then(r => { if (r.ok) lead.notes = newNotes; else throw new Error(); })
    );
  }

  if (tasks.length === 0) { showToast('Brak zmian'); return; }

  try {
    await Promise.all(tasks);
    showToast('Zapisano', 'success');
    closePanel();
    if (currentView === 'leads')     renderLeadsView();
    if (currentView === 'dashboard') renderDashboard();
  } catch {
    showToast('Błąd zapisu', 'error');
  }
}

async function deleteFromPanel() {
  const id = activePanelLeadId;
  if (!id || !confirm('Usunąć tego leada?')) return;
  closePanel();
  await deleteLead(id);
}

async function confirmDelete(id) {
  if (!confirm('Usunąć tego leada?')) return;
  await deleteLead(id);
}

async function deleteLead(id) {
  try {
    const res = await fetch(`/leads/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    allLeads = allLeads.filter(l => l.id !== id);
    updateLeadsBadge();
    showToast('Lead usunięty');
    if (currentView === 'leads')     renderLeadsView();
    if (currentView === 'dashboard') renderDashboard();
  } catch {
    showToast('Błąd usuwania', 'error');
  }
}

// ─── Search ───────────────────────────────────────────────────────────────────
async function runSearch() {
  const query = document.getElementById('inp-query').value.trim();
  const city  = document.getElementById('inp-city').value.trim();

  if (!query || !city) { showToast('Wpisz frazę i miasto', 'error'); return; }

  const btn  = document.getElementById('btn-search');
  const info = document.getElementById('search-result-info');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Szukam...';
  info.textContent = 'Trwa wyszukiwanie w Google Maps...';

  try {
    const res = await fetch('/leads/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, city }),
    });
    if (!res.ok) throw new Error(await res.text());
    const newLeads = await res.json();

    await loadLeads();

    const count = newLeads.length;
    info.innerHTML = count > 0
      ? `<strong style="color:var(--accent)">${count}</strong> nowych leadów dodano do bazy`
      : 'Nie znaleziono nowych leadów (mogą już być w bazie).';

    showToast(`Dodano ${count} nowych leadów`, count > 0 ? 'success' : '');

    if (count > 0) setTimeout(() => switchView('leads'), 1400);

  } catch (e) {
    showToast('Błąd: ' + e.message, 'error');
    info.textContent = 'Wystąpił błąd. Spróbuj ponownie.';
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      Szukaj w Google Maps`;
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function websiteBadge(status) {
  return status === 'tylko_facebook'
    ? '<span class="wb-badge wb-facebook">FB</span>'
    : '<span class="wb-badge wb-none">brak</span>';
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 3000);
}
