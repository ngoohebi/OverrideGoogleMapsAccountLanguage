import { isMapsUrl } from './rules.js';
import { STORAGE_KEY, applyLang, getLang, setLang } from './settings.js';

async function sync() {
  await applyLang(await getLang());
}

// The toolbar icon is greyed out (disabled) except on Google Maps pages.
// Tab URLs are only visible for Google sites (host permissions), so every
// other tab simply stays disabled.
function updateTab(tabId, url) {
  return isMapsUrl(url || '') ? chrome.action.enable(tabId) : chrome.action.disable(tabId);
}

async function updateAllTabs() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((t) => updateTab(t.id, t.url).catch(() => {})));
}

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.url || change.status === 'loading') updateTab(tabId, tab.url).catch(() => {});
});

chrome.action.disable();

chrome.runtime.onInstalled.addListener(async () => {
  await sync();
  await updateAllTabs();
});
chrome.runtime.onStartup.addListener(async () => {
  await sync();
  await updateAllTabs();
});

// Also covers a change synced from another signed-in Chrome.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && STORAGE_KEY in changes) {
    applyLang(changes[STORAGE_KEY].newValue);
  }
});

// Handy from the service worker DevTools console, and used by test/e2e.mjs
// (service workers cannot use dynamic import()).
globalThis.setLang = setLang;
