// chrome.* glue shared by the background worker and the popup.
import { languageName } from './languages.js';
import { RULE_IDS, buildRules, normalizeLang } from './rules.js';

const KEY = 'lang';

export async function getLang() {
  const data = await chrome.storage.sync.get(KEY);
  return normalizeLang(data[KEY]);
}

/** Makes the network rules and the toolbar tooltip match lang ('' = off). Idempotent. */
export async function applyLang(lang) {
  const code = normalizeLang(lang);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: RULE_IDS,
    addRules: buildRules(code),
  });
  await chrome.action.setTitle({
    title: [
      'Maps Language Override',
      `Google Maps shows: ${code ? languageName(code) : 'your Google Account language'}`,
      'Works only on Google Maps pages',
    ].join('\n'),
  });
}

/** Saves lang and applies it before resolving, so a reload right after uses it. */
export async function setLang(lang) {
  const code = normalizeLang(lang);
  await applyLang(code);
  await chrome.storage.sync.set({ [KEY]: code });
  return code;
}

export const STORAGE_KEY = KEY;
