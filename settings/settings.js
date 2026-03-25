'use strict';

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
const setZeroBtn = document.getElementById('set-zero-btn');
const resetBtn = document.getElementById('reset-btn');

let currentSites = [...DEFAULT_BLOCKED_SITES];
let currentDiff = 'STANDARD';
let saveTimeout = null;

async function init() {
    await loadSettings();

    diffStandard.addEventListener('click', () => { setDiff('STANDARD'); autoSave(); });
    diffHard.addEventListener('click', () => { setDiff('HARD'); autoSave(); });
    addSiteBtn.addEventListener('click', () => { addSite(); autoSave(); });
    newSiteInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { addSite(); autoSave(); } });
    baseMinutesEl.addEventListener('input', () => autoSave());
    setZeroBtn.addEventListener('click', () => sendMessage({ type: 'SET_REMAINING', seconds: 0 }));
    resetBtn.addEventListener('click', async () => {
        const state = await sendMessage({ type: 'GET_STATE' });
        await sendMessage({ type: 'SET_REMAINING', seconds: state.timer?.earnedSeconds ?? 0 });
    });
}

async function loadSettings() {
    try {
        const resp = await sendMessage({ type: 'GET_STATE' });
        const settings = resp.settings ?? {};

        currentDiff = settings.difficulty ?? 'STANDARD';
        setDiff(currentDiff);

        const storedMinutes = parseInt(settings.baseMinutes, 10);
        baseMinutesEl.value = (storedMinutes > 0) ? storedMinutes : 120;

        currentSites = settings.blockedSites ?? [...DEFAULT_BLOCKED_SITES];
        renderSiteList();
    } catch (err) {
        console.error('FocusLock Settings load error:', err);
    }
}

function setDiff(mode) {
    currentDiff = mode;
    diffStandard.classList.toggle('active', mode === 'STANDARD');
    diffHard.classList.toggle('active', mode === 'HARD');
}

function renderSiteList() {
    if (currentSites.length === 0) {
        siteList.innerHTML = `<li class="site-item site-item--empty"><span>No sites blocked</span></li>`;
    } else {
        currentSites.forEach((site, idx) => {
            const li = document.createElement('li');
            li.className = 'site-item';
            li.innerHTML = `<span>${site}</span>`;
            siteList.appendChild(li);
        });
    }
}

function flashInputDuplicate() {
    newSiteInput.classList.remove('duplicate-flash');

    void newSiteInput.offsetWidth;
    newSiteInput.classList.add('duplicate-flash');
}

function addSite() {
    const raw = newSiteInput.value.trim().toLowerCase()
        .replace(/^https?:\/\
        .replace(/^www\./, '')
        .split('/')[0];

    if (!raw) {
        newSiteInput.focus();
        return;
    }

    if (currentSites.includes(raw)) {
        flashInputDuplicate();
        newSiteInput.focus();
        return;
    }
    currentSites.push(raw);
    renderSiteList();
    newSiteInput.value = '';
}

function autoSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(persistSettings, 500);
}

async function persistSettings() {
    const settings = {
        difficulty: currentDiff,
        baseMinutes: Math.max(5, parseInt(baseMinutesEl.value, 10) || 120),
        blockedSites: currentSites,
    };

    try {
        await sendMessage({ type: 'SETTINGS_UPDATED', settings });
        console.log('[FocusLock] Settings auto-saved.');
    } catch (err) {
        console.error('[FocusLock] Auto-save error:', err);
    }
}

function sendMessage(payload) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(payload, (response) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(response ?? {});
        });
    });
}

init();

(function initLerpScroll() {
    let currentScroll = window.scrollY;
    let targetScroll = window.scrollY;
    const LERP = 0.08;
    const MULTIPLIER = 1.2;
    let ticking = false;

        function isInsideScrollable(el, deltaY) {
        while (el && el !== document.body) {
            if (el.scrollHeight > el.clientHeight) {
                const style = getComputedStyle(el);
                const overflow = style.overflowY;
                if (overflow === 'auto' || overflow === 'scroll') {
                    const atTop = el.scrollTop <= 0 && deltaY < 0;
                    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1 && deltaY > 0;

                    if (!atTop && !atBottom) return true;
                }
            }
            el = el.parentElement;
        }
        return false;
    }

    window.addEventListener('wheel', (e) => {

        if (isInsideScrollable(e.target, e.deltaY)) return;

        e.preventDefault();
        targetScroll += e.deltaY * MULTIPLIER;

        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        targetScroll = Math.max(0, Math.min(targetScroll, maxScroll));

        if (!ticking) {
            ticking = true;
            requestAnimationFrame(lerpLoop);
        }
    }, { passive: false });

    function lerpLoop() {
        currentScroll += (targetScroll - currentScroll) * LERP;

        if (Math.abs(targetScroll - currentScroll) < 0.5) {
            currentScroll = targetScroll;
            ticking = false;
        }

        window.scrollTo(0, currentScroll);

        if (ticking) {
            requestAnimationFrame(lerpLoop);
        }
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            currentScroll = window.scrollY;
            targetScroll = window.scrollY;
        }
    });
})();

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
