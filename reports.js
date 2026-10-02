import { db, STATE_LABELS } from './state.js';
import { escapeHTML, todayStr } from './utils.js';

const $ = id => document.getElementById(id);

function toMin(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

function duration(l) {
    if (!l.timeStart || !l.timeEnd) return 0;
    return Math.max(0, toMin(l.timeEnd) - toMin(l.timeStart));
}

function fmtDur(min) {
    if (!min) return '0 min';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(' ');
}

function rangeLabel(l) {
    if (!l.timeStart) return '--';
    return l.timeEnd ? `${l.timeStart}–${l.timeEnd}` : l.timeStart;
}

function dayLogs() {
    const date = $('reportDate').value;
    return db.logs
        .filter(l => l.date === date)
        .sort((a, b) => (a.timeStart || '').localeCompare(b.timeStart || '') || a.id - b.id);
}

function buildText(logs, date) {
    const lines = [`Informe ${date}`, ''];
    logs.forEach((l, i) => {
        const dur = duration(l);
        lines.push(`${i + 1}. ${rangeLabel(l)}${dur ? ` (${fmtDur(dur)})` : ''} | ${l.os} | ${db.clientName(l.client)} | ${STATE_LABELS[l.state] || ''}`);
        if (l.comment) lines.push(`   ${l.comment}`);
    });
    lines.push('', `Total: ${fmtDur(logs.reduce((s, l) => s + duration(l), 0))}`);
    return lines.join('\n');
}

export function renderReport() {
    const logs = dayLogs();
    const total = logs.reduce((s, l) => s + duration(l), 0);
    const pending = logs.filter(l => !l.uploaded).length;
    $('reportSummary').textContent =
        `${logs.length} apunte${logs.length !== 1 ? 's' : ''} · ${fmtDur(total)} · ${pending} sin cargar`;

    if (!logs.length) {
        $('reportList').innerHTML = '<div class="empty-state"><div class="empty-text">Sin apuntes este día</div></div>';
        return;
    }

    $('reportList').innerHTML = logs.map(l => `
        <div class="report-row${l.uploaded ? ' done' : ''}">
            <div class="report-time">${escapeHTML(rangeLabel(l))}<small>${escapeHTML(fmtDur(duration(l)))}</small></div>
            <div class="log-main">
                <div class="log-os">${escapeHTML(l.os)}</div>
                <div class="report-meta">${escapeHTML(db.clientName(l.client))} · ${escapeHTML(STATE_LABELS[l.state] || '')}</div>
                ${l.comment ? `<div class="log-comment">${escapeHTML(l.comment)}</div>` : ''}
            </div>
            <label class="upload-check"><input type="checkbox" data-upload-id="${l.id}" ${l.uploaded ? 'checked' : ''}><span>Cargado</span></label>
        </div>`).join('');
}

export function initReport(toast, onChange) {
    $('reportDate').value = todayStr();
    $('reportDate').addEventListener('change', renderReport);

    $('reportList').addEventListener('change', e => {
        const id = e.target.dataset.uploadId;
        if (id == null) return;
        db.setUploaded(Number(id), e.target.checked);
        onChange();
    });

    $('btnCopyReport').addEventListener('click', async () => {
        const logs = dayLogs();
        if (!logs.length) { toast('Sin apuntes ese día'); return; }
        try {
            await navigator.clipboard.writeText(buildText(logs, $('reportDate').value));
            toast('Informe copiado');
        } catch {
            toast('No se pudo copiar');
        }
    });
}