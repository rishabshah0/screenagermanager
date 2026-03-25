import { debounce } from 'lodash-es';
import Lenis from 'lenis';
import browser from 'webextension-polyfill';

const SITES = ['youtube.com', 'tiktok.com', 'instagram.com', 'twitter.com', 'x.com', 'reddit.com', 'netflix.com', 'twitch.tv', 'facebook.com', 'snapchat.com'];
const $ = id => document.getElementById(id);
const bind = (id, evt, fn) => $(id)?.addEventListener(evt, fn);
const send = (type, opts = {}) => browser.runtime.sendMessage({ type, ...opts });

let sites = [...SITES], diff = 'STANDARD';

const render = () => $('site-list').innerHTML = sites.length 
    ? sites.map(s => `<li class="site-item"><span>${s}</span></li>`).join('') 
    : `<li class="site-item site-item--empty"><span>No sites blocked</span></li>`;

const setDiff = m => {
    diff = m;
    ['STANDARD', 'HARD'].forEach(mode => $(`diff-${mode.toLowerCase()}`).classList.toggle('active', m === mode));
};

const save = debounce(() => send('SETTINGS_UPDATED', {
    settings: { difficulty: diff, baseMinutes: Math.max(5, parseInt($('base-minutes').value, 10) || 120), blockedSites: sites }
}).catch(console.error), 500);

const addSite = () => {
    const el = $('new-site'), val = el.value.trim();
    if (val) {
        try {
            const raw = new URL(val.includes('://') ? val : `http://${val}`).hostname.replace(/^www\./, '');
            if (raw && sites.includes(raw)) {
                el.classList.remove('duplicate-flash');
                void el.offsetWidth;
                el.classList.add('duplicate-flash');
            } else if (raw) {
                sites.push(raw);
                render();
                el.value = '';
            }
        } catch {}
    }
    el.focus();
};

const init = async () => {
    const { settings: s = {} } = await send('GET_STATE').catch(() => ({}));
    setDiff(s.difficulty || 'STANDARD');
    $('base-minutes').value = parseInt(s.baseMinutes, 10) || 120;
    sites = s.blockedSites || [...SITES];
    render();

    bind('diff-standard', 'click', () => (setDiff('STANDARD'), save()));
    bind('diff-hard', 'click', () => (setDiff('HARD'), save()));
    bind('add-site-btn', 'click', () => (addSite(), save()));
    bind('new-site', 'keydown', e => e.key === 'Enter' && (addSite(), save()));
    bind('base-minutes', 'input', save);
    bind('set-zero-btn', 'click', () => send('SET_REMAINING', { seconds: 0 }));
    bind('reset-btn', 'click', async () => send('SET_REMAINING', { seconds: (await send('GET_STATE').catch(()=>{}))?.timer?.earnedSeconds || 0 }));
};

init();

const lenis = new Lenis();
const raf = t => (lenis.raf(t), requestAnimationFrame(raf));
requestAnimationFrame(raf);

const obs = new IntersectionObserver(e => e.forEach(x => x.isIntersecting && x.target.classList.add('visible')), { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
