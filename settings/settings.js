/**
 * FocusLock — Settings Page Script
 */
'use strict';

/** Default blocked sites — kept in sync with background/blocker.js */
const DEFAULT_BLOCKED_SITES = [
    'youtube.com',
    'tiktok.com',
    'instagram.com',
    'twitter.com',
    'x.com',
    'reddit.com',
    'netflix.com',
    'twitch.tv',
    'facebook.com',
    'snapchat.com',
];

const diffStandard = document.getElementById('diff-standard');
const diffHard = document.getElementById('diff-hard');
const baseMinutesEl = document.getElementById('base-minutes');
const siteList = document.getElementById('site-list');
const newSiteInput = document.getElementById('new-site');
const addSiteBtn = document.getElementById('add-site-btn');
const saveBtn = document.getElementById('save-btn');
const saveStatus = document.getElementById('save-status');
const setZeroBtn = document.getElementById('set-zero-btn');
const resetBtn = document.getElementById('reset-btn');

let currentSites = [...DEFAULT_BLOCKED_SITES];
let currentDiff = 'STANDARD';

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
    await loadSettings();

    diffStandard.addEventListener('click', () => setDiff('STANDARD'));
    diffHard.addEventListener('click', () => setDiff('HARD'));
    addSiteBtn.addEventListener('click', addSite);
    newSiteInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addSite(); });
    saveBtn.addEventListener('click', saveSettings);
    setZeroBtn.addEventListener('click', () => sendMessage({ type: 'SET_REMAINING', seconds: 0 }));
    resetBtn.addEventListener('click', async () => {
        const state = await sendMessage({ type: 'GET_STATE' });
        await sendMessage({ type: 'SET_REMAINING', seconds: state.timer?.earnedSeconds ?? 0 });
    });
}

// ── Load ───────────────────────────────────────────────────────────────────
async function loadSettings() {
    try {
        const resp = await sendMessage({ type: 'GET_STATE' });
        const settings = resp.settings ?? {};

        currentDiff = settings.difficulty ?? 'STANDARD';
        setDiff(currentDiff, false);

        baseMinutesEl.value = settings.baseMinutes ?? 120;

        currentSites = settings.blockedSites ?? [...DEFAULT_BLOCKED_SITES];
        renderSiteList();
    } catch (err) {
        console.error('FocusLock Settings load error:', err);
    }
}

// ── Difficulty ─────────────────────────────────────────────────────────────
function setDiff(mode, persist = false) {
    currentDiff = mode;
    diffStandard.classList.toggle('active', mode === 'STANDARD');
    diffHard.classList.toggle('active', mode === 'HARD');
}

// ── Site List ──────────────────────────────────────────────────────────────
function renderSiteList() {
    siteList.innerHTML = '';
    currentSites.forEach((site, idx) => {
        const li = document.createElement('li');
        li.className = 'site-item';
        li.innerHTML = `<span>${site}</span>`;
        siteList.appendChild(li);
    });
}

function addSite() {
    const raw = newSiteInput.value.trim().toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0];

    if (!raw || currentSites.includes(raw)) {
        newSiteInput.focus();
        return;
    }
    currentSites.push(raw);
    renderSiteList();
    newSiteInput.value = '';
}

// ── Save ───────────────────────────────────────────────────────────────────
async function saveSettings() {
    const settings = {
        difficulty: currentDiff,
        baseMinutes: parseInt(baseMinutesEl.value, 10) || 120,
        blockedSites: currentSites,
    };

    try {
        await sendMessage({ type: 'SETTINGS_UPDATED', settings });
        flashSave('Saved!');
    } catch (err) {
        flashSave('Error saving', true);
    }
}

function flashSave(msg, isError = false) {
    saveStatus.textContent = msg;
    saveStatus.style.color = isError ? '#ff5c5c' : 'var(--accent)';
    saveStatus.classList.add('visible');
    setTimeout(() => saveStatus.classList.remove('visible'), 2500);
}

// ── Helpers ────────────────────────────────────────────────────────────────
function sendMessage(payload) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(payload, (response) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(response ?? {});
        });
    });
}

init();
