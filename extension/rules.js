// Pure helpers shared by the background worker, the popup and the unit tests.
// No chrome.* APIs in here so it can be imported from Node.

export const REDIRECT_RULE_ID = 1;
export const ALLOW_RULE_ID = 2;
export const RULE_IDS = [REDIRECT_RULE_ID, ALLOW_RULE_ID];

// Google Maps main-frame URLs:
//   https://www.google.<tld>/maps...   https://google.<tld>/maps...
//   https://maps.google.<tld>/...
// MAPS_PATH matches scheme + host + path (stops before the query string).
const MAPS_PATH =
  '^https?://(?:(?:www\\.)?google\\.[a-z.]+/maps(?:/[^?#]*)?|maps\\.google\\.[a-z.]+/[^?#]*)';
/** RE2 regex for any Google Maps page URL. */
const MAPS_URL = `${MAPS_PATH}(?:[?#]|$)`;

const LANG_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;

/** Returns a cleaned language code, or '' when it is empty/invalid (= off). */
export function normalizeLang(lang) {
  const code = String(lang ?? '').trim();
  return LANG_RE.test(code) ? code : '';
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Builds the declarativeNetRequest dynamic rules for a language ('' = none). */
export function buildRules(lang) {
  const code = normalizeLang(lang);
  if (!code) return [];
  return [
    {
      // URL already carries the wanted hl: leave it alone (prevents redirect loops).
      id: ALLOW_RULE_ID,
      priority: 2,
      action: { type: 'allow' },
      condition: {
        regexFilter: `${MAPS_PATH}\\?(?:[^#]*&)?hl=${escapeRe(code)}(?:[&#]|$)`,
        isUrlFilterCaseSensitive: false,
        resourceTypes: ['main_frame'],
      },
    },
    {
      // Any other Maps page load: add or replace hl.
      id: REDIRECT_RULE_ID,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          transform: {
            queryTransform: { addOrReplaceParams: [{ key: 'hl', value: code }] },
          },
        },
      },
      condition: {
        regexFilter: MAPS_URL,
        isUrlFilterCaseSensitive: false,
        resourceTypes: ['main_frame'],
      },
    },
  ];
}

/** True when the URL is a Google Maps page. */
export function isMapsUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const host = u.hostname.toLowerCase();
  if (/^maps\.google\.[a-z.]+$/.test(host)) return true;
  if (/^(?:www\.)?google\.[a-z.]+$/.test(host)) {
    return u.pathname === '/maps' || u.pathname.startsWith('/maps/');
  }
  return false;
}

/** Returns the URL with hl set to lang, or with hl removed when lang is ''. */
export function withHl(url, lang) {
  const u = new URL(url);
  const code = normalizeLang(lang);
  if (code) u.searchParams.set('hl', code);
  else u.searchParams.delete('hl');
  return u.toString();
}
