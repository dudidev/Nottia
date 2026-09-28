import { escapeHTML, sanitizeCSVField, fmtDate, pad2, maskTimeInput, isValidTime } from './utils.js';
import { db, STATE_COLORS, STATE_LABELS, getTheme, setTheme } from './state.js';

const $ = id => document.getElementById(id);

let selectedState = 'in-progress';
let selectedFilter = 'all';
let selectedClient = 'all';
let selectedFormat = 'json';
let editingLogId = null;
let editingClientId = null;
let isDark = getTheme();

// ─── TEMA ───
setTheme(isDark);
$('themeToggle').addEventListener('click', () => {
    isDark = !isDark;
    setTheme(isDark);
});

// ─── NAVEGACIÓN ───
function goTab(tab) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === tab));
    render();
}

document.querySelectorAll('.nav-item[data-tab]').forEach(n => {
    n.addEventListener('click', () => goTab(n.dataset.tab));
});

// ─── TOAST ───
let toastTimer = null;
function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ─── VALIDACIÓN DE SOLAPAMIENTO ───
function findOverlaps(date, startTime, endTime, excludeLogId = null) {
    if (!endTime) return [];
    return db.logs.filter(l => {
        if (excludeLogId != null && l.id === excludeLogId) return false;
        if (l.date !== date) return false;
        const logStart = l.timeStart;
        const logEnd = l.timeEnd || l.timeStart;
        return !(endTime <= logStart || startTime >= logEnd);
    });
}

// ─── MODAL APUNTE ───
function openLogModal(id) {
    editingLogId = id ?? null;
    $('logForm').reset();
    $('timeError').classList.remove('show');

    const sel = $('fClient');
    sel.innerHTML = '';
    sel.appendChild(new Option('— Seleccionar cliente —', ''));
    db.clients.forEach(c => sel.appendChild(new Option(c.name, c.id)));

    if (editingLogId != null) {
        const log = db.logs.find(l => l.id === editingLogId);
        if (!log) return;
        $('modalTitle').textContent = 'Editar apunte';
        $('fOS').value = log.os || '';
        $('fDate').value = log.date || '';
        $('fPriority').value = log.priority || 'media';
        $('fTimeStart').value = log.timeStart || '';
        $('fTimeEnd').value = log.timeEnd || '';
        $('fClient').value = log.client || '';
        $('fComment').value = log.comment || '';
        selectedState = log.state in STATE_LABELS ? log.state : 'in-progress';
        $('btnDeleteLog').style.display = 'inline-flex';
    } else {
        $('modalTitle').textContent = 'Nuevo apunte';
        const now = new Date();
        $('fDate').valueAsDate = now;
        $('fTimeStart').value = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
        selectedState = 'in-progress';
        $('btnDeleteLog').style.display = 'none';
    }

    document.querySelectorAll('.state-btn').forEach(b => b.classList.toggle('selected', b.dataset.state === selectedState));
    updateDurationBadge();
    $('logOverlay').classList.add('active');
}

function closeLogModal() { $('logOverlay').classList.remove('active'); }

$('btnAddDesktop').addEventListener('click', () => openLogModal(null));
$('btnAddLogs').addEventListener('click', () => openLogModal(null));
$('btnCancelLog').addEventListener('click', closeLogModal);
$('logOverlay').addEventListener('click', e => { if (e.target === $('logOverlay')) closeLogModal(); });

document.querySelectorAll('.state-btn').forEach(btn => {
    btn.addEventListener('click', e => {
        e.preventDefault();
        selectedState = btn.dataset.state;
        document.querySelectorAll('.state-btn').forEach(b => b.classList.toggle('selected', b.dataset.state === selectedState));
    });
});

// ─── DURACIÓN ───
function updateDurationBadge() {
    const start = $('fTimeStart').value;
    const end = $('fTimeEnd').value;
    const badge = $('durationBadge');
    if (!isValidTime(start) || !isValidTime(end)) { badge.style.display = 'none'; return; }

    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) { badge.style.display = 'none'; return; }

    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const parts = [];
    if (h) parts.push(`${h} h`);
    if (m) parts.push(`${m} min`);
    $('durationText').textContent = parts.join(' ') || '0 min';
    badge.style.display = 'inline-flex';
}

maskTimeInput($('fTimeStart'));
maskTimeInput($('fTimeEnd'));
$('fTimeStart').addEventListener('input', updateDurationBadge);
$('fTimeEnd').addEventListener('input', updateDurationBadge);

document.querySelectorAll('.quick-duration-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const start = $('fTimeStart').value;
        if (!isValidTime(start)) return;
        const [sh, sm] = start.split(':').map(Number);
        const total = sh * 60 + sm + parseInt(btn.dataset.min, 10);
        $('fTimeEnd').value = `${pad2(Math.floor((total % 1440) / 60))}:${pad2(total % 60)}`;
        updateDurationBadge();
    });
});

// ─── SUBMIT APUNTE ───
$('logForm').addEventListener('submit', e => {
    e.preventDefault();

    const date = $('fDate').value;
    const timeStart = $('fTimeStart').value;
    const timeEnd = $('fTimeEnd').value;
    const errorMsg = $('timeError');

    if (!isValidTime(timeStart) || (timeEnd && !isValidTime(timeEnd))) {
        errorMsg.textContent = 'Hora inválida. Usa formato HH:MM (24 horas).';
        errorMsg.classList.add('show');
        return;
    }

    const overlap = findOverlaps(date, timeStart, timeEnd, editingLogId);
    if (overlap.length) {
        errorMsg.textContent = `Conflicto de horario con ${overlap.length} apunte(s). Revisa los tiempos.`;
        errorMsg.classList.add('show');
        return;
    }
    errorMsg.classList.remove('show');

    const os = $('fOS').value.trim();
    if (!os) return;

    const log = {
        id: editingLogId ?? Date.now(),
        os,
        date,
        priority: $('fPriority').value,
        timeStart,
        timeEnd,
        client: $('fClient').value ? Number($('fClient').value) : '',
        state: selectedState,
        comment: $('fComment').value.trim()
    };

    if (editingLogId != null) {
        db.logs = db.logs.map(l => l.id === editingLogId ? log : l);
        toast('Apunte actualizado');
    } else {
        db.logs.unshift(log);
        toast('Apunte guardado');
    }

    db.save();
    closeLogModal();
    render();
});

$('btnDeleteLog').addEventListener('click', () => {
    if (editingLogId == null) return;
    db.logs = db.logs.filter(l => l.id !== editingLogId);
    db.save();
    closeLogModal();
    toast('Apunte eliminado');
    render();
});

// ─── MODAL CLIENTE ───
function openClientModal(id) {
    editingClientId = id ?? null;
    $('clientForm').reset();
    if (editingClientId != null) {
        const c = db.clientById(editingClientId);
        if (!c) return;
        $('clientModalTitle').textContent = 'Editar cliente';
        $('cName').value = c.name;
        $('cDesc').value = c.desc || '';
        $('btnDeleteClient').style.display = 'inline-flex';
    } else {
        $('clientModalTitle').textContent = 'Nuevo cliente';
        $('btnDeleteClient').style.display = 'none';
    }
    $('clientOverlay').classList.add('active');
}

function closeClientModal() { $('clientOverlay').classList.remove('active'); }

$('btnAddClient').addEventListener('click', () => openClientModal(null));
$('btnCancelClient').addEventListener('click', closeClientModal);
$('clientOverlay').addEventListener('click', e => { if (e.target === $('clientOverlay')) closeClientModal(); });

$('clientForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('cName').value.trim();
    if (!name) return;

    const cl = {
        id: editingClientId ?? Date.now(),
        name,
        desc: $('cDesc').value.trim()
    };
    if (editingClientId != null) {
        db.clients = db.clients.map(c => c.id === editingClientId ? cl : c);
        toast('Cliente actualizado');
    } else {
        db.clients.push(cl);
        toast('Cliente creado');
    }
    db.save();
    closeClientModal();
    render();
});

$('btnDeleteClient').addEventListener('click', () => {
    if (editingClientId == null) return;
    db.clients = db.clients.filter(c => c.id !== editingClientId);
    db.save();
    closeClientModal();
    toast('Cliente eliminado');
    render();
});

// ─── FILTROS ───
function buildFilters() {
    const container = $('filterChips');
    const filters = [
        { key: 'all', label: 'Todos' },
        { key: 'in-progress', label: 'En proceso' },
        { key: 'completed', label: 'Completado' },
        { key: 'pending', label: 'Pendiente' },
        { key: 'awaiting-info', label: 'Agt. Info' },
        { key: 'awaiting-tests', label: 'Agt. Pruebas' }
    ];

    container.innerHTML = '';

    filters.forEach(f => {
        const btn = document.createElement('button');
        btn.className = `filter-chip ${selectedFilter === f.key ? 'active' : ''}`;
        btn.textContent = f.label;
        btn.addEventListener('click', () => {
            selectedFilter = f.key;
            renderLogsList();
        });
        container.appendChild(btn);
    });

    const clientSelect = $('clientFilterSelect');
    const prevValue = String(selectedClient);
    clientSelect.innerHTML = '<option value="all">Todos los clientes</option>';
    db.clients.forEach(c => clientSelect.appendChild(new Option(c.name, c.id)));
    clientSelect.value = prevValue;
    if (clientSelect.value !== prevValue) { selectedClient = 'all'; clientSelect.value = 'all'; }
}

$('clientFilterSelect').addEventListener('change', e => {
    selectedClient = e.target.value === 'all' ? 'all' : Number(e.target.value);
    renderLogsList();
});

// ─── RENDER APUNTES ───
const ICON_CALENDAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
const ICON_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
const ICON_USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
const EMPTY_LOG_ICON = '<svg class="empty-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><path d="M12.5 7H11v6l5.25 3.15"/></svg>';
const EMPTY_DOC_ICON = '<svg class="empty-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
const EMPTY_USERS_ICON = '<svg class="empty-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';

function renderLogsList() {
    const container = $('logsList');
    const searchQuery = $('searchInput').value.toLowerCase();

    let filtered = db.logs;
    if (selectedFilter !== 'all') filtered = filtered.filter(l => l.state === selectedFilter);
    if (selectedClient !== 'all') filtered = filtered.filter(l => l.client === selectedClient);
    if (searchQuery) filtered = filtered.filter(l => l.os.toLowerCase().includes(searchQuery));

    $('logsSubtitle').textContent = `${filtered.length} apunte${filtered.length !== 1 ? 's' : ''}`;

    if (!filtered.length) {
        container.innerHTML = `<div class="empty-state">${EMPTY_LOG_ICON}<div class="empty-text">Sin apuntes que coincidan</div></div>`;
        return;
    }

    container.innerHTML = filtered.map(log => {
        const c = db.clientById(log.client);
        const clientLabel = c ? c.name : 'Sin cliente';
        const timeLabel = log.timeStart ? (log.timeEnd ? `${log.timeStart} — ${log.timeEnd}` : log.timeStart) : '—';
        const priority = ['alta', 'media', 'baja'].includes(log.priority) ? log.priority : 'media';
        const stateColor = STATE_COLORS[log.state] || '#9CA3AF';
        const stateLabel = STATE_LABELS[log.state] || 'Desconocido';

        return `
        <div class="log-card" data-log-id="${log.id}">
            <div class="log-main">
                <div class="log-header">
                    <div class="log-os">${escapeHTML(log.os)}</div>
                    <span class="log-priority ${priority}">${priority.toUpperCase()}</span>
                </div>
                <div class="log-info">
                    <div class="log-info-item"><span class="icon">${ICON_USER}</span><span>${escapeHTML(clientLabel)}</span></div>
                    <div class="log-info-item"><span class="icon">${ICON_CALENDAR}</span><span>${escapeHTML(fmtDate(log.date))}</span></div>
                    <div class="log-info-item"><span class="icon">${ICON_CLOCK}</span><span>${escapeHTML(timeLabel)}</span></div>
                </div>
                ${log.comment ? `<div class="log-comment">${escapeHTML(log.comment)}</div>` : ''}
            </div>
            <span class="status-badge" style="background:${stateColor}">${escapeHTML(stateLabel)}</span>
        </div>`;
    }).join('');

    container.querySelectorAll('[data-log-id]').forEach(card => {
        card.addEventListener('click', () => openLogModal(Number(card.dataset.logId)));
    });
}

$('searchInput').addEventListener('input', renderLogsList);

// ─── DASHBOARD ───
function renderDashboard() {
    const logs = db.logs;
    const total = logs.length;
    const byState = {};
    Object.keys(STATE_LABELS).forEach(k => { byState[k] = logs.filter(l => l.state === k).length; });

    const today = new Date().toISOString().split('T')[0];
    const todayLogs = logs.filter(l => l.date === today).length;
    $('dashSubtitle').textContent = `${todayLogs} hoy · ${total} total`;

    const statDefs = [
        { label: 'Total', value: total, color: '#007AFF' },
        { label: 'En proceso', value: byState['in-progress'], color: '#3B82F6' },
        { label: 'Completados', value: byState['completed'], color: '#10B981' },
        { label: 'Pendientes', value: byState['pending'], color: '#F59E0B' },
        { label: 'Agt. Info', value: byState['awaiting-info'], color: '#EF4444' },
        { label: 'Agt. Pruebas', value: byState['awaiting-tests'], color: '#8B5CF6' }
    ];

    $('statCards').innerHTML = statDefs.map(s => `
        <div class="stat-card">
            <div class="stat-value" style="color:${s.color}">${s.value}</div>
            <div class="stat-label">${escapeHTML(s.label)}</div>
        </div>`).join('');

    const stateChart = $('stateChart');
    if (!total) {
        stateChart.innerHTML = '<div style="color:var(--text3);font-size:13px;">Sin datos aún</div>';
    } else {
        stateChart.innerHTML = Object.entries(STATE_LABELS).map(([k, label]) => {
            const count = byState[k] || 0;
            const pct = Math.round(count / total * 100);
            return `
            <div class="state-bar-wrap">
                <div class="state-bar-label"><span>${escapeHTML(label)}</span><span>${count} (${pct}%)</span></div>
                <div class="state-bar"><div class="state-bar-fill" style="width:${pct}%;background:${STATE_COLORS[k]}"></div></div>
            </div>`;
        }).join('');
    }

    const clientChart = $('clientChart');
    const clientCounts = {};
    logs.forEach(l => { if (l.client) clientCounts[l.client] = (clientCounts[l.client] || 0) + 1; });
    const sorted = Object.entries(clientCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxC = sorted[0]?.[1] || 1;

    if (!sorted.length) {
        clientChart.innerHTML = '<div style="color:var(--text3);font-size:13px;">Sin clientes asociados</div>';
    } else {
        clientChart.innerHTML = sorted.map(([id, count], i) => {
            const c = db.clientById(id);
            const name = c ? c.name : id;
            const pct = Math.round(count / maxC * 100);
            return `
            <div style="margin-bottom:12px;">
                <div style="font-size:12px;font-weight:600;margin-bottom:4px;">#${i + 1} ${escapeHTML(name)}</div>
                <div style="height:6px;border-radius:3px;background:var(--surface2);overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:var(--primary);border-radius:3px;"></div>
                </div>
                <div style="font-size:11px;color:var(--text3);margin-top:2px;">${count} apunte${count !== 1 ? 's' : ''}</div>
            </div>`;
        }).join('');
    }

    const recentLogs = $('recentLogs');
    const recent = logs.slice(0, 5);
    if (!recent.length) {
        recentLogs.innerHTML = `<div class="empty-state" style="padding:20px;">${EMPTY_DOC_ICON}<div class="empty-text">Sin apuntes. Crea el primero.</div></div>`;
    } else {
        recentLogs.innerHTML = recent.map(log => {
            const c = db.clientById(log.client);
            const clientLabel = c ? c.name : '—';
            const stateColor = STATE_COLORS[log.state] || '#9CA3AF';
            const stateLabel = STATE_LABELS[log.state] || 'Desconocido';
            return `
            <div class="timeline-item" data-log-id="${log.id}">
                <div class="timeline-dot" style="background:${stateColor}"></div>
                <div class="timeline-content">
                    <div class="timeline-title">${escapeHTML(log.os)}</div>
                    <div class="timeline-meta">${escapeHTML(clientLabel)} · ${escapeHTML(fmtDate(log.date))} · ${escapeHTML(stateLabel)}</div>
                </div>
            </div>`;
        }).join('');
        recentLogs.querySelectorAll('[data-log-id]').forEach(item => {
            item.addEventListener('click', () => openLogModal(Number(item.dataset.logId)));
        });
    }
}

// ─── CLIENTES ───
function renderClients() {
    const grid = $('clientsGrid');
    $('clientsSubtitle').textContent = `${db.clients.length} cliente${db.clients.length !== 1 ? 's' : ''}`;

    if (!db.clients.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">${EMPTY_USERS_ICON}<div class="empty-text">Crea tu primer cliente</div></div>`;
        return;
    }

    grid.innerHTML = db.clients.map(c => {
        const count = db.logs.filter(l => l.client === c.id).length;
        const initial = c.name.trim().charAt(0).toUpperCase() || '?';
        return `
        <div class="client-card" data-client-id="${c.id}">
            <div class="client-avatar">${escapeHTML(initial)}</div>
            <div class="client-name">${escapeHTML(c.name)}</div>
            <div class="client-meta">${escapeHTML(c.desc || 'Sin descripción')}</div>
            <div class="client-meta" style="margin-top:8px;font-weight:500;color:var(--primary);">${count} apunte${count !== 1 ? 's' : ''}</div>
        </div>`;
    }).join('');

    grid.querySelectorAll('[data-client-id]').forEach(card => {
        card.addEventListener('click', () => openClientModal(Number(card.dataset.clientId)));
    });
}

// ─── EXPORT ───
document.querySelectorAll('.format-btn').forEach(b => {
    b.addEventListener('click', () => {
        document.querySelectorAll('.format-btn').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
        selectedFormat = b.dataset.format;
    });
});

const todayDate = new Date();
$('exportFrom').valueAsDate = new Date(todayDate.getTime() - 30 * 86400000);
$('exportTo').valueAsDate = todayDate;

$('btnExport').addEventListener('click', () => {
    const from = $('exportFrom').value;
    const to = $('exportTo').value;
    if (!from || !to || from > to) { toast('Rango de fechas inválido'); return; }

    const filtered = db.logs.filter(l => l.date >= from && l.date <= to);
    const enriched = filtered.map(l => ({ ...l, clientName: db.clientName(l.client) }));

    let content, filename, type;

    if (selectedFormat === 'json') {
        content = JSON.stringify(enriched, null, 2);
        filename = 'nottia-export.json';
        type = 'application/json';
    } else if (selectedFormat === 'csv') {
        const h = ['OS', 'Fecha', 'Inicio', 'Fin', 'Cliente', 'Prioridad', 'Estado', 'Comentario'];
        const rows = enriched.map(l => [
            sanitizeCSVField(l.os), l.date, l.timeStart || '', l.timeEnd || '',
            sanitizeCSVField(l.clientName), l.priority, l.state, sanitizeCSVField(l.comment || '')
        ]);
        content = [h.join(','), ...rows.map(r => r.join(','))].join('\n');
        filename = 'nottia-export.csv';
        type = 'text/csv';
    } else if (selectedFormat === 'markdown') {
        content = '# Nottia — Exportación\n\n';
        enriched.forEach(l => {
            content += `## ${l.os}\n- **Fecha:** ${l.date}\n- **Horario:** ${l.timeStart || '—'} — ${l.timeEnd || '—'}\n- **Cliente:** ${l.clientName}\n- **Prioridad:** ${l.priority}\n- **Estado:** ${STATE_LABELS[l.state] || l.state}\n`;
            if (l.comment) content += `- **Comentario:** ${l.comment}\n`;
            content += '\n';
        });
        filename = 'nottia-export.md';
        type = 'text/markdown';
    } else {
        content = enriched.map(l =>
            `OS: ${l.os}\nFecha: ${l.date}\nHorario: ${l.timeStart || '—'} — ${l.timeEnd || '—'}\nCliente: ${l.clientName}\nPrioridad: ${l.priority}\nEstado: ${STATE_LABELS[l.state] || l.state}\nComentario: ${l.comment || ''}\n${'─'.repeat(40)}`
        ).join('\n\n');
        filename = 'nottia-export.txt';
        type = 'text/plain';
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast('Archivo descargado');
});

// ─── IMPORT ───
$('importFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Archivo demasiado grande'); e.target.value = ''; return; }

    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const imported = JSON.parse(ev.target.result);
            const added = db.importLogs(imported);
            render();
            toast(`${added} apunte${added !== 1 ? 's' : ''} importado${added !== 1 ? 's' : ''}`);
        } catch {
            toast('Archivo inválido');
        }
        e.target.value = '';
    };
    reader.onerror = () => toast('Error leyendo archivo');
    reader.readAsText(file);
});

$('btnImport').addEventListener('click', () => $('importFile').click());

// ─── RENDER ALL ───
function render() {
    renderDashboard();
    renderLogsList();
    buildFilters();
    renderClients();
}

render();
goTab('dashboard');