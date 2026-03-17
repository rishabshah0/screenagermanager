/**
 * FocusLock — Block List & declarativeNetRequest Manager
 *
 * Dynamically adds/removes DNR rules to intercept requests to blocked sites
 * and redirect them to the FocusLock blocked page.
 *
 * @module background/blocker
 */

import { getSettings } from './state.js';

/** ID range for dynamic DNR rules we manage (1000–1999) */
const RULE_ID_OFFSET = 1000;

/** Default distracting sites (without protocol/www, matched as domain patterns) */
export const DEFAULT_BLOCKED_SITES = [
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

/**
 * Build a DNR rule object that blocks requests to a given domain.
 *
 * @param {string} domain - e.g. 'youtube.com'
 * @param {number} ruleId - Unique integer ID for DNR
 * @returns {chrome.declarativeNetRequest.Rule}
 */
function buildBlockRule(domain, ruleId) {
    const blockedPageUrl = chrome.runtime.getURL('blocked/blocked.html');
    return {
        id: ruleId,
        priority: 1,
        action: {
            type: 'redirect',
            redirect: {
                url: `${blockedPageUrl}?site=${encodeURIComponent(domain)}`,
            },
        },
        condition: {
            urlFilter: `||${domain}`,
            resourceTypes: ['main_frame'],
        },
    };
}

/**
 * Activate blocking for all sites in the current block list.
 * Removes any previous rules first to avoid duplicates.
 */
export async function activateBlocking() {
    const settings = await getSettings();
    const blockedSites = settings.blockedSites ?? DEFAULT_BLOCKED_SITES;

    // Remove existing rules managed by FocusLock
    await deactivateBlocking();

    const newRules = blockedSites.map((domain, idx) =>
        buildBlockRule(domain, RULE_ID_OFFSET + idx)
    );

    await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: newRules,
        removeRuleIds: [],
    });

    console.log(`[FocusLock] Blocking activated for ${newRules.length} sites.`);
}

/**
 * Deactivate all FocusLock dynamic blocking rules.
 */
export async function deactivateBlocking() {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const focusLockRuleIds = existingRules
        .filter((r) => r.id >= RULE_ID_OFFSET && r.id < RULE_ID_OFFSET + 1000)
        .map((r) => r.id);

    if (focusLockRuleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
            addRules: [],
            removeRuleIds: focusLockRuleIds,
        });
        console.log(`[FocusLock] Removed ${focusLockRuleIds.length} blocking rules.`);
    }
}

/**
 * Update the block list in settings and refresh rules if blocking is active.
 *
 * @param {string[]} newSiteList - Array of domain strings
 * @param {boolean} isBlockingActive - Whether blocking is currently on
 */
export async function updateBlockList(newSiteList, isBlockingActive) {
    const settings = await getSettings();
    settings.blockedSites = newSiteList;
    await chrome.storage.local.set({ settings });

    if (isBlockingActive) {
        await activateBlocking();
    }
}
