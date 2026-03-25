'use strict';

let latestEndTime = null;
let renderLoopId = null;

(async function () {

    const params = new URLSearchParams(window.location.search);
    const site = params.get('site') || 'This site';
    const siteEl = document.getElementById('site-name');
    if (siteEl) siteEl.textContent = site;

    try {
        const resp = await sendMessage({ type: 'GET_STATE' });
        latestEndTime = resp.timer?.endTime;

        renderLoopId = requestAnimationFrame(renderLoop);

        window.addEventListener('unload', () => cancelAnimationFrame(renderLoopId));

        setInterval(async () => {
            try {
                const r = await sendMessage({ type: 'GET_STATE' });
                latestEndTime = r.timer?.endTime;

                if (latestEndTime && latestEndTime > Date.now()) {
                    history.length > 1 ? history.back() : window.close();
                }
            } catch {  }
        }, 10_000);

    } catch {
        const el = document.getElementById('time-remaining');
        if (el) el.textContent = 'Unavailable';
    }

    document.getElementById('back-btn')?.addEventListener('click', () => {
        history.length > 1 ? history.back() : window.close();
    });
})();

function renderLoop() {
    let remaining = 0;
    if (latestEndTime) {
        remaining = Math.max(0, Math.floor((latestEndTime - Date.now()) / 1000));
    }

    const el = document.getElementById('time-remaining');
    if (el) el.textContent = remaining > 0 ? formatTime(remaining) : '00:00';

    renderLoopId = requestAnimationFrame(renderLoop);
}

function sendMessage(payload) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(payload, (response) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(response ?? {});
        });
    });
}

function formatTime(totalSeconds) {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00';
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
