import { Duration } from 'luxon';
import browser from 'webextension-polyfill';

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
    const remaining = latestEndTime
        ? Math.max(0, Math.floor((latestEndTime - Date.now()) / 1000))
        : 0;

    const el = document.getElementById('time-remaining');
    if (el) el.textContent = formatTime(remaining);

    renderLoopId = requestAnimationFrame(renderLoop);
}

const sendMessage = (payload) => browser.runtime.sendMessage(payload);

const formatTime = (totalSeconds) => {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00';
    return Duration.fromMillis(totalSeconds * 1000).toFormat('mm:ss');
};
