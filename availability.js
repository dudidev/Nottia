import { db } from './state.js';
import { escapeHTML, pad2 } from './utils.js';

const DAY_START = 6 * 60;
const DAY_END = 22 * 60;
const MIN_GAP = 15;

const minutesOf = t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
};
const hhmm = m => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;

function busyOf(date, excludeId) {
    return db.logs
        .filter(l => l.date === date && l.id !== excludeId && l.timeStart)
        .map(l => ({ os: l.os, s: minutesOf(l.timeStart), e: l.timeEnd ? minutesOf(l.timeEnd) : minutesOf(l.timeStart) }))
        .sort((a, b) => a.s - b.s || a.e - b.e);
}

function gapsOf(busy) {
    const gaps = [];
    let cursor = DAY_START;
    for (const b of busy) {
        const end = Math.min(b.s, DAY_END);
        if (end - cursor >= MIN_GAP) gaps.push([cursor, end]);
        cursor = Math.max(cursor, b.e);
    }
    if (DAY_END - cursor >= MIN_GAP) gaps.push([cursor, DAY_END]);
    return gaps;
}

export function renderAvailability(el, date, excludeId, onPick) {
    if (!date) { el.innerHTML = ''; return; }

    const busy = busyOf(date, excludeId);
    const span = DAY_END - DAY_START;
    const pct = m => Math.min(100, Math.max(0, (m - DAY_START) / span * 100));

    const blocks = busy
        .filter(b => b.e >= DAY_START && b.s <= DAY_END)
        .map(b => {
            const left = pct(b.s);
            const width = Math.max(pct(b.e) - left, 0.8);
            const label = `${b.os} · ${hhmm(b.s)}${b.e > b.s ? '–' + hhmm(b.e) : ''}`;
            return `<div class="strip-block" style="left:${left}%;width:${width}%" title="${escapeHTML(label)}"><span>${escapeHTML(b.os)}</span></div>`;
        }).join('');

    let scale = '';
    for (let m = DAY_START; m <= DAY_END; m += 240) scale += `<span>${pad2(m / 60)}</span>`;

    const chips = gapsOf(busy).map(([s, e]) => e === DAY_END
        ? `<button type="button" class="chip chip-free" data-s="${hhmm(s)}" data-e="">Desde ${hhmm(s)}</button>`
        : `<button type="button" class="chip chip-free" data-s="${hhmm(s)}" data-e="${hhmm(e)}">Libre ${hhmm(s)}–${hhmm(e)}</button>`
    ).join('');

    el.innerHTML = `
        <div class="avail-caption">Disponibilidad del día</div>
        <div class="strip">${blocks}</div>
        <div class="strip-scale">${scale}</div>
        <div class="chip-row">${chips || '<span class="avail-empty">Sin huecos libres este día</span>'}</div>`;

    el.onclick = e => {
        const b = e.target.closest('[data-s]');
        if (b) onPick(b.dataset.s, b.dataset.e);
    };
}