const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export const COLLECTION_KEYS = [
    'taxiRentRecords',
    'roomRentRecords',
    'borrowRecords',
    'salesRecords',
    'expenseRecords',
];

export const STATUS = {
    IDLE: 'idle',
    PULLING: 'pulling',
    SYNCING: 'syncing',
    SYNCED: 'synced',
    OFFLINE: 'offline',
    ERROR: 'error',
};

const STATUS_META = {
    [STATUS.IDLE]: { text: 'Sync idle', dotClass: 'bg-slate-400', textClass: 'text-slate-400' },
    [STATUS.PULLING]: { text: 'Pulling data...', dotClass: 'bg-blue-400 animate-pulse', textClass: 'text-blue-300' },
    [STATUS.SYNCING]: { text: 'Syncing...', dotClass: 'bg-amber-400 animate-pulse', textClass: 'text-amber-300' },
    [STATUS.SYNCED]: { text: 'Synced', dotClass: 'bg-emerald-400', textClass: 'text-emerald-300' },
    [STATUS.OFFLINE]: { text: 'Offline', dotClass: 'bg-orange-400', textClass: 'text-orange-300' },
    [STATUS.ERROR]: { text: 'Sync failed', dotClass: 'bg-red-400', textClass: 'text-red-300' },
};

let syncTimer = null;
let syncing = false;

export function setStatus(state) {
    const meta = STATUS_META[state] || STATUS_META[STATUS.IDLE];
    const textEl = document.getElementById('sync-status');
    const dotEl = document.getElementById('sync-status-dot');
    if (textEl) {
        textEl.textContent = meta.text;
        textEl.className = `text-xs font-medium ${meta.textClass}`;
    }
    if (dotEl) {
        dotEl.className = `w-1.5 h-1.5 rounded-full ${meta.dotClass}`;
    }
}

function getLocalPayload() {
    return COLLECTION_KEYS.reduce((acc, key) => {
        try {
            const parsed = JSON.parse(localStorage.getItem(key) || '[]');
            acc[key] = Array.isArray(parsed) ? parsed : [];
        } catch {
            acc[key] = [];
        }
        return acc;
    }, {});
}

// Check backend health first
export async function checkBackendHealth() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        if (!response.ok) {
            console.error('[Sync] Health check failed:', response.status);
            return null;
        }
        const data = await response.json();
        console.log('[Sync] Health check:', data);
        return data;
    } catch (err) {
        console.error('[Sync] Health check error:', err.message);
        return null;
    }
}

export async function pullFromBackend() {
    setStatus(STATUS.PULLING);
    
    // First check backend health
    const health = await checkBackendHealth();
    if (!health) {
        console.error('[Sync] Health check failed - backend unreachable');
        setStatus(STATUS.OFFLINE);
        return false;
    }
    
    // Check if Supabase is properly configured
    if (!health.supabaseConfigured) {
        console.error('[Sync] Supabase not configured:', health.supabaseMessage);
        setStatus(STATUS.ERROR);
        return false;
    }
    
    // Check if connection to Supabase works
    if (health.connectionTest && !health.connectionTest.ok) {
        console.error('[Sync] Supabase connection failed:', health.connectionTest.error);
        setStatus(STATUS.ERROR);
        return false;
    }

    try {
        console.log('[Sync] Pulling data from backend...');
        const response = await fetch(`${API_BASE}/api/collections`);
        if (!response.ok) {
            console.error('[Sync] Pull failed with status:', response.status);
            setStatus(response.status >= 500 ? STATUS.OFFLINE : STATUS.ERROR);
            return false;
        }
        const payload = await response.json();
        console.log('[Sync] Pull response:', payload);
        const items = Array.isArray(payload?.items) ? payload.items : [];

        items.forEach((item) => {
            if (!COLLECTION_KEYS.includes(item.name)) return;
            const value = Array.isArray(item.data) ? item.data : [];
            localStorage.setItem(item.name, JSON.stringify(value));
            console.log(`[Sync] Saved ${item.name}: ${value.length} records`);
        });

        setStatus(STATUS.SYNCED);
        console.log('[Sync] Pull completed successfully');
        return true;
    } catch (err) {
        console.error('[Sync] Pull error:', err.message);
        setStatus(STATUS.OFFLINE);
        return false;
    }
}

export async function pushToBackend() {
    if (syncing) return false;
    syncing = true;
    setStatus(STATUS.SYNCING);

    try {
        const body = getLocalPayload();
        console.log('[Sync] Pushing data to backend:', JSON.stringify(body, null, 2));
        
        const response = await fetch(`${API_BASE}/api/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        
        if (!response.ok) {
            console.error('[Sync] Push failed with status:', response.status);
            setStatus(response.status >= 500 ? STATUS.OFFLINE : STATUS.ERROR);
            return false;
        }
        
        const result = await response.json();
        console.log('[Sync] Push response:', result);
        
        setStatus(STATUS.SYNCED);
        return true;
    } catch (err) {
        console.error('[Sync] Push error:', err.message);
        setStatus(STATUS.OFFLINE);
        return false;
    } finally {
        syncing = false;
    }
}

function schedulePush() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
        pushToBackend();
    }, 500);
}

export function installAutoSync() {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => {
        originalSetItem(key, value);
        if (COLLECTION_KEYS.includes(key)) {
            schedulePush();
        }
    };
}

export function initSyncStatusIndicator() {
    setStatus(STATUS.IDLE);
}

