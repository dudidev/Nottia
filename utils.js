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

export function fmtDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return '';
    return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(d);
}

export function pad2(n) {
    return String(n).padStart(2, '0');
}

// Máscara HH:MM en formato 24h, sin depender del locale del navegador.
export function maskTimeInput(el) {
    el.addEventListener('input', () => {
        let digits = el.value.replace(/\D/g, '').slice(0, 4);
        if (digits.length >= 3) {
            let hh = digits.slice(0, 2);
            let mm = digits.slice(2);
            if (Number(hh) > 23) hh = '23';
            if (mm.length === 2 && Number(mm) > 59) mm = '59';
            el.value = `${hh}:${mm}`;
        } else if (digits.length >= 1) {
            if (digits.length === 2 && Number(digits) > 23) digits = '23';
            el.value = digits;
        } else {
            el.value = '';
        }
    });
    el.addEventListener('blur', () => {
        if (el.value && !isValidTime(el.value)) el.value = '';
    });
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