import { storage } from './utils.js';

export const STATE_COLORS = {
    'in-progress': '#3B82F6',
    'completed': '#10B981',
    'pending': '#F59E0B',
    'awaiting-info': '#EF4444',
    'awaiting-tests': '#8B5CF6'
};

export const STATE_LABELS = {
    'in-progress': 'En proceso',
    'completed': 'Completado',
    'pending': 'Pendiente',
    'awaiting-info': 'Agt. Info',
    'awaiting-tests': 'Agt. Pruebas'
};

const LOGS_KEY = 'nottia_logs';
const CLIENTS_KEY = 'nottia_clients';
const THEME_KEY = 'nottia_theme';

function isValidLog(l) {
    return l && typeof l === 'object'
        && typeof l.id === 'number'
        && typeof l.os === 'string'
        && typeof l.date === 'string'
        && l.state in STATE_LABELS;
}

export const db = {
    logs: storage.get(LOGS_KEY, []).filter(isValidLog),
    clients: storage.get(CLIENTS_KEY, []).filter(c => c && typeof c.id === 'number' && typeof c.name === 'string'),

    save() {
        const ok1 = storage.set(LOGS_KEY, this.logs);
        const ok2 = storage.set(CLIENTS_KEY, this.clients);
        return ok1 && ok2;
    },

    clientById(id) {
        const numId = Number(id);
        return this.clients.find(c => c.id === numId);
    },

    clientName(id) {
        const c = this.clientById(id);
        return c ? c.name : '—';
    },

    importLogs(imported) {
        if (!Array.isArray(imported)) throw new Error('formato inválido');
        const validated = imported.filter(isValidLog);
        const existingIds = new Set(this.logs.map(l => l.id));
        let added = 0;
        for (const log of validated) {
            if (!existingIds.has(log.id)) {
                this.logs.unshift(log);
                existingIds.add(log.id);
                added++;
            }
        }
        this.save();
        return added;
    }
};

export function getTheme() {
    return storage.get(THEME_KEY, null) === 'dark' || localStorage.getItem(THEME_KEY) === 'dark';
}

export function setTheme(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
}