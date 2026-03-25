import browser from 'webextension-polyfill';
import { computeFromRaw } from '../engine/formula.js';
import { activateBlocking, deactivateBlocking } from './blocker.js';
import { getTimer, getSettings, getAssignments, saveTimer, saveAssignments } from './state.js';

const ALARM = 'screenager-block';
const todayMinus = d => new Date(Date.now() - d * 864e5).toISOString().split('T')[0];

const init = async () => {
    console.log('[Screenager] Init');
    const exist = await getAssignments();
    if (!exist.raw?.length) {
        const raw = [
            { title: 'Chapter 12 Reading', earnedPoints: '45', totalPoints: '50', status: 'graded', dueDate: todayMinus(1) },
            { title: 'Lab Report', earnedPoints: '88', totalPoints: '100', status: 'graded', dueDate: todayMinus(2) },
            { title: 'Spanish Vocab', earnedPoints: '18', totalPoints: '20', status: 'graded', dueDate: todayMinus(3) },
            { title: 'Geometry Proof', earnedPoints: '27', totalPoints: '30', status: 'graded', dueDate: todayMinus(4) },
            { title: 'History Essay', earnedPoints: '0', totalPoints: '50', status: 'missing', dueDate: todayMinus(2) },
        ];
        await saveAssignments({ raw, lastSync: Date.now() });
        const { difficulty, baseMinutes } = await getSettings();
        const earnedSeconds = Math.round(computeFromRaw(raw, difficulty, baseMinutes) * 60);
        await saveTimer({ endTime: Date.now() + earnedSeconds * 1000, earnedSeconds });
    }
    await checkState();
};

browser.runtime.onInstalled.addListener(init);
browser.runtime.onStartup.addListener(init);

const checkState = async () => {
    const t = await getTimer();
    await browser.alarms.clear(ALARM);
    if (!t.endTime || t.endTime <= Date.now()) {
        console.log('[Screenager] Block active.');
        await activateBlocking();
    } else {
        console.log(`[Screenager] Suspended till ${new Date(t.endTime).toLocaleTimeString()}`);
        await deactivateBlocking();
        browser.alarms.create(ALARM, { when: t.endTime });
    }
};

browser.alarms.onAlarm.addListener(a => a.name === ALARM && checkState());

const handlers = {
    GET_STATE: async () => ({ timer: await getTimer(), settings: await getSettings(), assignments: await getAssignments() }),
    SETTINGS_UPDATED: async ({ settings }) => {
        await browser.storage.local.set({ settings });
        const { raw } = await getAssignments();
        if (raw?.length) {
            const sec = Math.round(computeFromRaw(raw, settings.difficulty, settings.baseMinutes) * 60);
            await saveTimer({ earnedSeconds: sec, endTime: Date.now() + sec * 1000 });
            await checkState();
        } else await deactivateBlocking();
        return { success: true };
    },
    SET_REMAINING: async ({ seconds }) => {
        await saveTimer({ ...(await getTimer()), endTime: seconds <= 0 ? null : Date.now() + seconds * 1000 });
        await checkState();
        return { success: true };
    }
};

browser.runtime.onMessage.addListener((msg, _, res) => {
    (handlers[msg.type]?.(msg) ?? Promise.resolve({ error: `Unknown: ${msg.type}` }))
        .then(res).catch(e => { console.error(e); res({ error: e.message }); });
    return true;
});
