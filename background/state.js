export const KEYS = {
    TIMER: 'timer',
    SETTINGS: 'settings',
    ASSIGNMENTS: 'assignments',
};

export const DEFAULT_SETTINGS = {
    difficulty: 'STANDARD',
    baseMinutes: 120,
    blockedSites: null,
};

export const DEFAULT_TIMER = {
    endTime: null,
    earnedSeconds: 0,
};

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

export async function saveTimer(timerObj) {
    await chrome.storage.local.set({ [KEYS.TIMER]: timerObj });
}

export async function saveSettings(settingsObj) {
    await chrome.storage.local.set({ [KEYS.SETTINGS]: settingsObj });
}

export async function saveAssignments(assignmentsObj) {
    await chrome.storage.local.set({ [KEYS.ASSIGNMENTS]: assignmentsObj });
}
