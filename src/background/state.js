import browser from 'webextension-polyfill';
import { defaultTo } from 'lodash-es';

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

const DEFAULT_ASSIGNMENTS = { raw: [], lastSync: null };

async function load(key, fallback) {
    const result = await browser.storage.local.get(key);
    return defaultTo(result[key], { ...fallback });
}

async function save(key, value) {
    await browser.storage.local.set({ [key]: value });
}

export const getTimer = () => load(KEYS.TIMER, DEFAULT_TIMER);
export const getSettings = () => load(KEYS.SETTINGS, DEFAULT_SETTINGS);
export const getAssignments = () => load(KEYS.ASSIGNMENTS, DEFAULT_ASSIGNMENTS);

export const saveTimer = (obj) => save(KEYS.TIMER, obj);
export const saveSettings = (obj) => save(KEYS.SETTINGS, obj);
export const saveAssignments = (obj) => save(KEYS.ASSIGNMENTS, obj);
