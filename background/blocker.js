
import { getSettings } from './state.js';

const RULE_ID_OFFSET = 1000;

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

export async function activateBlocking() {
    const settings = await getSettings();
    const blockedSites = settings.blockedSites ?? DEFAULT_BLOCKED_SITES;

    await deactivateBlocking();

    const newRules = blockedSites.map((domain, idx) =>
        buildBlockRule(domain, RULE_ID_OFFSET + idx)
    );

    await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: newRules,
        removeRuleIds: [],
    });

    console.log(`[Screenager Manager] Blocking activated for ${newRules.length} sites.`);
}

export async function deactivateBlocking() {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const screenagerRuleIds = existingRules
        .filter((r) => r.id >= RULE_ID_OFFSET && r.id < RULE_ID_OFFSET + 1000)
        .map((r) => r.id);

    if (screenagerRuleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
            addRules: [],
            removeRuleIds: screenagerRuleIds,
        });
        console.log(`[Screenager Manager] Removed ${screenagerRuleIds.length} blocking rules.`);
    }
}

export async function updateBlockList(newSiteList, isBlockingActive) {
    const settings = await getSettings();
    settings.blockedSites = newSiteList;
    await chrome.storage.local.set({ settings });

    if (isBlockingActive) {
        await activateBlocking();
    }
}
