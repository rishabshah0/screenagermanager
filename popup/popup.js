
'use strict';

const RING_CIRCUMFERENCE = 553.0;

const timerDisplay = document.getElementById('timer-display');
const timerEarned = document.getElementById('timer-earned');
const ringProgress = document.getElementById('ring-progress');
const statusBanner = document.getElementById('status-banner');
const statusText = document.getElementById('status-text');
const statAssignments = document.getElementById('stat-assignments-val');
const statAvgGrade = document.getElementById('stat-avg-grade-val');
const statMissing = document.getElementById('stat-missing-val');
const diffStandard = document.getElementById('diff-standard');
const diffHard = document.getElementById('diff-hard');

let currentDifficulty = 'STANDARD';
let latestTimer = { endTime: null, earnedSeconds: 0 };
let renderLoopId = null;
let hasLoadedData = false;

async function init() {
    await loadDataFromBackground();

    setInterval(loadDataFromBackground, 10000);

    diffStandard.addEventListener('click', () => setDifficulty('STANDARD'));
    diffHard.addEventListener('click', () => setDifficulty('HARD'));

    renderLoopId = requestAnimationFrame(renderLoop);

    window.addEventListener('unload', () => cancelAnimationFrame(renderLoopId));
}

async function loadDataFromBackground() {
    try {
        const response = await sendMessage({ type: 'GET_STATE' });
        if (response.error) throw new Error(response.error);

        latestTimer = response.timer;
        hasLoadedData = true;
        renderStatic(response);
    } catch (err) {
        console.error('Could not reach background worker:', err.message);
    }
}

function renderStatic({ settings, assignments }) {

    currentDifficulty = settings.difficulty ?? 'STANDARD';
    diffStandard.classList.toggle('active', currentDifficulty === 'STANDARD');
    diffHard.classList.toggle('active', currentDifficulty === 'HARD');

    const raw = assignments?.raw ?? [];
    const graded = raw.filter(a => a.status === 'graded' || a.status === 'turned-in');
    const missing = raw.filter(a => a.status === 'missing');

    statAssignments.textContent = graded.length || 'none';
    statMissing.textContent = missing.length || '0';

    document.querySelector('.shell').classList.remove('loading');

    if (graded.length > 0) {
        const grades = graded.map(a => {
            const e = parseFloat(a.earnedPoints) || 0;
            const t = parseFloat(a.totalPoints) || 0;
            return t > 0 ? (e / t) * 100 : 0;
        });
        const avg = grades.reduce((s, g) => s + g, 0) / grades.length;
        statAvgGrade.textContent = `${avg.toFixed(0)}%`;
    } else {
        statAvgGrade.textContent = '–';
    }
}

function renderLoop() {
    if (!hasLoadedData) {
        renderLoopId = requestAnimationFrame(renderLoop);
        return;
    }

    const earned = latestTimer.earnedSeconds ?? 0;

    let remaining = 0;
    if (latestTimer.endTime) {
        remaining = Math.max(0, Math.floor((latestTimer.endTime - Date.now()) / 1000));
    }

    timerDisplay.textContent = formatTime(remaining);
    timerEarned.textContent = `of ${formatTime(earned)} earned`;

    const fraction = earned > 0 ? remaining / earned : 0;
    const offset = RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, fraction)));
    ringProgress.style.strokeDashoffset = offset;
    document.querySelector('.ring-svg').setAttribute('aria-valuenow', Math.round(fraction * 100));

    const isBlocked = remaining <= 0;
    const isWarning = !isBlocked && remaining < 600;

    ringProgress.classList.toggle('blocked', isBlocked);
    ringProgress.classList.toggle('warn', isWarning);
    timerDisplay.classList.toggle('warn', isWarning);
    timerDisplay.classList.toggle('accent', !isWarning && !isBlocked);

    statusBanner.hidden = !isBlocked;
    if (isBlocked) {
        statusText.textContent = 'Screen time blocked';
    }

    renderLoopId = requestAnimationFrame(renderLoop);
}

async function setDifficulty(mode) {
    if (currentDifficulty === mode) return;

    currentDifficulty = mode;
    diffStandard.classList.toggle('active', mode === 'STANDARD');
    diffHard.classList.toggle('active', mode === 'HARD');
    diffStandard.setAttribute('aria-pressed', mode === 'STANDARD');
    diffHard.setAttribute('aria-pressed', mode === 'HARD');

    const result = await sendMessage({ type: 'GET_STATE' });
    const settings = result.settings ?? {};
    settings.difficulty = mode;

    await sendMessage({ type: 'SETTINGS_UPDATED', settings });
    await loadDataFromBackground();
}

function sendMessage(payload) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(payload, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(response ?? {});
            }
        });
    });
}

function formatTime(totalSeconds) {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00';
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

init();
