/**
 * FocusLock — Shared Storage State Helpers
 *
 * Centralises all reads and writes to chrome.storage.local so that every
 * other module imports from one place.
 *
 * @module background/state
 */

/** Keys used in chrome.storage.local */
export const KEYS = {
    TIMER: 'timer',          // { remainingSeconds, earnedSeconds, lastUpdated }
    SETTINGS: 'settings',   // { difficulty, baseMinutes, blockedSites }
    ASSIGNMENTS: 'assignments', // Cached scraper output + last sync timestamp
};

/** Default settings */
export const DEFAULT_SETTINGS = {
    difficulty: 'STANDARD',
    baseMinutes: 120,
    blockedSites: null, // null = use DEFAULT_BLOCKED_SITES from blocker.js
};

/** Default timer state */
export const DEFAULT_TIMER = {
    endTime: null, // Null if timer is 0/expired. If active, Date.now() when it will hit 0.
    earnedSeconds: 0,
};

// ─── Getters ────────────────────────────────────────────────────────────────

export async function getTimer() {
    const result = await chrome.storage.local.get(KEYS.TIMER);
    return result[KEYS.TIMER] ?? { ...DEFAULT_TIMER };
}

export async function getSettings() {
    const result = await chrome.storage.local.get(KEYS.SETTINGS);
    return result[KEYS.SETTINGS] ?? { ...DEFAULT_SETTINGS };
}

export async function getAssignments() {
    const result = await chrome.storage.local.get(KEYS.ASSIGNMENTS);
    return result[KEYS.ASSIGNMENTS] ?? { raw: [], lastSync: null };
}



// ─── Setters ────────────────────────────────────────────────────────────────

export async function saveTimer(timerObj) {
    await chrome.storage.local.set({ [KEYS.TIMER]: timerObj });
}

export async function saveSettings(settingsObj) {
    await chrome.storage.local.set({ [KEYS.SETTINGS]: settingsObj });
}

export async function saveAssignments(assignmentsObj) {
    await chrome.storage.local.set({ [KEYS.ASSIGNMENTS]: assignmentsObj });
}


