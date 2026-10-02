// Utilidades puras. Nada de estado global aquí.

export function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Evita CSV injection: si el campo arranca con = + - @ Excel lo ejecuta como fórmula.
export function sanitizeCSVField(value) {
    let v = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
    return `"${v.replace(/"/g, '""')}"`;
}

export function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fmtDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return '';
    return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(d);
}

export function pad2(n) {
    return String(n).padStart(2, '0');
}

export function isValidTime(value) {
    return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
}

export const storage = {
    get(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch {
            return false;
        }
    }
};