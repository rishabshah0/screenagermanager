import { getSettings } from './state.js';
import browser from 'webextension-polyfill';
import { defaultTo, map, filter } from 'lodash-es';

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
    const blockedPageUrl = browser.runtime.getURL('blocked/blocked.html');
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
    const blockedSites = defaultTo(settings.blockedSites, DEFAULT_BLOCKED_SITES);

    await deactivateBlocking();

    const newRules = map(blockedSites, (domain, idx) =>
        buildBlockRule(domain, RULE_ID_OFFSET + idx)
    );

    await browser.declarativeNetRequest.updateDynamicRules({
        addRules: newRules,
        removeRuleIds: [],
    });

    console.log(`[Screenager Manager] Blocking activated for ${newRules.length} sites.`);
}

export async function deactivateBlocking() {
    const existingRules = await browser.declarativeNetRequest.getDynamicRules();
    const screenagerRuleIds = map(
        filter(existingRules, (r) => r.id >= RULE_ID_OFFSET && r.id < RULE_ID_OFFSET + 1000),
        'id'
    );

    await browser.declarativeNetRequest.updateDynamicRules({
        addRules: [],
        removeRuleIds: screenagerRuleIds,
    });
    console.log(`[Screenager Manager] Removed ${screenagerRuleIds.length} blocking rules.`);
}

export async function updateBlockList(newSiteList, isBlockingActive) {
    const settings = await getSettings();
    settings.blockedSites = newSiteList;
    await browser.storage.local.set({ settings });

    if (isBlockingActive) {
        await activateBlocking();
    }
}
