/**
 * FocusLock — MV3 Service Worker
 *
 * Responsibilities:
 *  1. Uses chrome.alarms to schedule blocking exactly when `endTime` is reached
 *  2. Activates DNR rules via blocker.js when time is up
 *  3. Handles messages from popup (GET_STATE, SET_REMAINING, SETTINGS_UPDATED)
 *
 * @module background/service-worker
 */

import { computeFromRaw } from '../engine/formula.js';
import { activateBlocking, deactivateBlocking } from './blocker.js';
import {
    getTimer,
    getSettings,
    getAssignments,
    saveTimer,
    saveAssignments,
} from './state.js';

const ALARM_NAME = 'focuslock-block';

// ─── Install / Startup ──────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
    console.log('[FocusLock] Extension installed.');
    await seedDemoData();
    await checkState();
});

chrome.runtime.onStartup.addListener(async () => {
    console.log('[FocusLock] Browser started.');
    await seedDemoData();
    await checkState();
});

/** Seed demo data on first install so the popup has something to show. */
async function seedDemoData() {
    const existing = await getAssignments();
    if (existing.raw && existing.raw.length > 0) return; // Already has real data

    const demoAssignments = [
        { title: 'Chapter 12 Reading Questions', earnedPoints: '45', totalPoints: '50', status: 'graded', dueDate: todayMinus(1) },
        { title: 'Lab Report: Photosynthesis', earnedPoints: '88', totalPoints: '100', status: 'graded', dueDate: todayMinus(2) },
        { title: 'Spanish Vocab Unit 8 Quiz', earnedPoints: '18', totalPoints: '20', status: 'graded', dueDate: todayMinus(3) },
        { title: 'Geometry Proof Worksheet', earnedPoints: '27', totalPoints: '30', status: 'graded', dueDate: todayMinus(4) },
        { title: 'History Essay: Civil Rights', earnedPoints: '0', totalPoints: '50', status: 'missing', dueDate: todayMinus(2) },
    ];

    await saveAssignments({ raw: demoAssignments, lastSync: Date.now() });

    const settings = await getSettings();
    const earnedMinutes = computeFromRaw(demoAssignments, settings.difficulty, settings.baseMinutes);
    const earnedSeconds = Math.round(earnedMinutes * 60);

    await saveTimer({
        endTime: Date.now() + (earnedSeconds * 1000),
        earnedSeconds,
    });

    console.log(`[FocusLock] Demo data seeded: ${earnedMinutes.toFixed(1)} min earned from ${demoAssignments.length} assignments.`);
}

function todayMinus(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
}

/** Check current timer and apply blocking or schedule the alarm. */
async function checkState() {
    const timer = await getTimer();

    await chrome.alarms.clear(ALARM_NAME);

    if (timer.endTime === null || timer.endTime <= Date.now()) {
        console.log('[FocusLock] Timer expired. Activating block.');
        await activateBlocking();
    } else {
        console.log(`[FocusLock] Timer active. Blocking suspended until ${new Date(timer.endTime).toLocaleTimeString()}`);
        await deactivateBlocking();
        // Schedule alarm to fire when time runs out
        chrome.alarms.create(ALARM_NAME, { when: timer.endTime });
    }
}

// ─── Alarm Tick ─────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === ALARM_NAME) {
        console.log('[FocusLock] Alarm fired — time is up.');
        await checkState();
    }
});

// ─── Message Handling ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse).catch((err) => {
        console.error('[FocusLock] Message handler error:', err);
        sendResponse({ error: err.message });
    });
    return true; // Keep channel open for async response
});

async function handleMessage(message) {
    switch (message.type) {

        // ── Popup requests current state ──
        case 'GET_STATE': {
            const [timer, settings, assignments] = await Promise.all([
                getTimer(),
                getSettings(),
                getAssignments(),
            ]);
            return { timer, settings, assignments };
        }

        // ── Popup saves updated settings ──
        case 'SETTINGS_UPDATED': {
            const { settings } = message;
            await chrome.storage.local.set({ settings });

            // Recompute timer base on new settings so it reflects immediately
            const assignments = await getAssignments();
            if (assignments.raw && assignments.raw.length > 0) {
                const earnedMinutes = computeFromRaw(
                    assignments.raw,
                    settings.difficulty,
                    settings.baseMinutes
                );
                const earnedSeconds = Math.round(earnedMinutes * 60);
                const timer = await getTimer();

                // Since we don't have perfect tracking of time spent, we just restart the timer
                // with the new earned time for simplicity in this demo build.
                await saveTimer({
                    earnedSeconds,
                    endTime: Date.now() + (earnedSeconds * 1000)
                });
                await checkState();
            } else {
                await deactivateBlocking(); // refresh block rules if they changed domains
            }
            return { success: true };
        }

        // ── Dev/debug: manually override remaining time ──
        case 'SET_REMAINING': {
            const { seconds } = message;
            const timer = await getTimer();
            if (seconds <= 0) {
                await saveTimer({ ...timer, endTime: null });
            } else {
                await saveTimer({ ...timer, endTime: Date.now() + seconds * 1000 });
            }
            await checkState();
            return { success: true };
        }

        default:
            return { error: `Unknown message type: ${message.type}` };
    }
}
