// End-to-end test: loads the unpacked extension into Chrome for Testing
// (branded Chrome no longer allows --load-extension) and drives real Google Maps.
//   npm run test:e2e            (headless)
//   HEADFUL=1 npm run test:e2e  (watch it)
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const extDir = path.join(root, 'extension');
const shotDir = process.env.SHOT_DIR || path.join(root, 'dist', 'e2e');
mkdirSync(shotDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: !process.env.HEADFUL,
  pipe: true,
  enableExtensions: [extDir],
  args: ['--lang=en-US', '--window-size=1280,800'],
  defaultViewport: { width: 1280, height: 800 },
});

let failures = 0;
async function step(name, fn) {
  try {
    await fn();
    console.log(`✔ ${name}`);
  } catch (err) {
    failures++;
    console.error(`✖ ${name}\n  ${err.stack || err}`);
  }
}

try {
  const swTarget = await browser.waitForTarget(
    (t) => t.type() === 'service_worker' && t.url().endsWith('/background.js'),
  );
  const extId = new URL(swTarget.url()).host;
  const sw = await swTarget.worker();
  console.log(`extension id: ${extId}`);

  // Use the same code path as the popup.
  const setLang = (lang) =>
    sw.evaluate((l) => globalThis.setLang(l), lang);
  const rules = () => sw.evaluate(() => chrome.declarativeNetRequest.getDynamicRules());
  const title = () => sw.evaluate(() => chrome.action.getTitle({}));

  const page = await browser.newPage();
  const redirects = [];
  page.on('response', (r) => {
    if (r.request().isNavigationRequest() && r.status() >= 300 && r.status() < 400) {
      redirects.push(`${r.status()} ${r.url()}`);
    }
  });

  async function open(url) {
    redirects.length = 0;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => document.documentElement.lang, { timeout: 30_000 });
    // Maps rewrites the URL client-side; the request URL is what the server saw.
    const requestUrl = page.mainFrame().url();
    const htmlLang = await page.evaluate(() => document.documentElement.lang);
    return { requestUrl, htmlLang, redirects: [...redirects] };
  }

  // Google appends the visitor's region (e.g. fr-TW), so compare the prefix.
  const langIs = (actual, code) =>
    assert.match(actual, new RegExp(`^${code}(-|$)`, 'i'), `html lang ${actual} is not ${code}`);

  const MAPS = 'https://www.google.com/maps/@35.6595,139.7005,16z';

  await step('initially off: no rules, plain icon title', async () => {
    await setLang('');
    assert.deepEqual(await rules(), []);
    assert.match(await title(), /Google Maps shows: your Google Account language/);
  });

  await step('baseline: with the extension off, Maps URL has no hl (Google picks the language)', async () => {
    const r = await open(MAPS);
    console.log('   ', r);
    assert.ok(!/[?&]hl=/.test(r.requestUrl), r.requestUrl);
  });

  await step('ja: Maps load gets hl=ja and renders in Japanese', async () => {
    assert.equal(await setLang('ja'), 'ja');
    assert.equal((await rules()).length, 2);
    assert.match(await title(), /Google Maps shows: Japanese · 日本語/);
    const r = await open(MAPS);
    console.log('   ', r);
    assert.match(r.requestUrl, /[?&]hl=ja(&|$)/);
    langIs(r.htmlLang, 'ja');
    await page.screenshot({ path: path.join(shotDir, 'maps-ja.png') });
  });

  await step('fr: existing hl=en is replaced', async () => {
    await setLang('fr');
    const r = await open('https://www.google.com/maps/@35.6595,139.7005,16z?hl=en');
    console.log('   ', r);
    assert.match(r.requestUrl, /[?&]hl=fr(&|$)/);
    assert.ok(!/hl=en/.test(r.requestUrl));
    langIs(r.htmlLang, 'fr');
  });

  await step('fr: URL that already has hl=fr is not redirected (no loop)', async () => {
    const r = await open('https://www.google.com/maps/@35.6595,139.7005,16z?hl=fr');
    console.log('   ', r);
    assert.equal(r.redirects.filter((x) => /hl=fr/.test(x) && /google\.[a-z.]+\/maps/.test(x)).length, 0);
    langIs(r.htmlLang, 'fr');
  });

  await step('zh-TW on a country domain (google.co.jp)', async () => {
    await setLang('zh-TW');
    const r = await open('https://www.google.co.jp/maps/@35.6595,139.7005,16z');
    console.log('   ', r);
    assert.match(r.requestUrl, /[?&]hl=zh-TW(&|$)/);
    assert.match(r.htmlLang, /^zh/);
    await page.screenshot({ path: path.join(shotDir, 'maps-zh-TW.png') });
  });

  await step('non-Maps Google pages are untouched', async () => {
    redirects.length = 0;
    await page.goto('https://www.google.com/search?q=taipei', { waitUntil: 'domcontentloaded' });
    assert.ok(!/[?&]hl=/.test(page.url()), page.url());
  });

  await step('toolbar icon is greyed out off Maps and active on Maps', async () => {
    // The extension can only see URLs of Google tabs, so look the tab up on Maps.
    await open(MAPS);
    const tabId = await sw.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.find((t) => /google\.[a-z.]+\/maps/.test(t.url || '')).id;
    });
    const enabled = async () => {
      await new Promise((r) => setTimeout(r, 700)); // declarativeContent is async
      return sw.evaluate((id) => chrome.action.isEnabled(id), tabId);
    };
    assert.equal(await enabled(), true, 'greyed out on Google Maps');
    await page.goto('https://www.google.com/search?q=taipei', { waitUntil: 'domcontentloaded' });
    assert.equal(await enabled(), false, 'active on Google Search');
    await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
    assert.equal(await enabled(), false, 'active on example.com');
    await open('https://www.google.co.jp/maps');
    assert.equal(await enabled(), true, 'greyed out on google.co.jp/maps');
  });

  await step('off again: no rewrite', async () => {
    await setLang('');
    assert.deepEqual(await rules(), []);
    const r = await open(MAPS);
    assert.ok(!/[?&]hl=/.test(r.requestUrl), r.requestUrl);
  });

  await step('popup: search, click/Enter and custom-code rows save + apply the language', async () => {
    const popup = await browser.newPage();
    await popup.setViewport({ width: 320, height: 600 });
    await popup.goto(`chrome-extension://${extId}/popup.html`);
    await popup.waitForSelector('#list li');
    const count = await popup.$$eval('#list li', (li) => li.length);
    assert.ok(count >= 70, `only ${count} languages`);
    await popup.type('#search', 'japan');
    const shown = await popup.$$eval('#list li', (li) => li.map((x) => x.dataset.code));
    assert.deepEqual(shown, ['ja']);
    await popup.keyboard.press('Enter');
    await popup.waitForFunction(() => document.querySelector('#status strong')?.textContent === 'Japanese · 日本語');
    const stored = await sw.evaluate(() => chrome.storage.sync.get('lang'));
    assert.equal(stored.lang, 'ja');
    assert.match(await title(), /Google Maps shows: Japanese · 日本語/);
    await popup.screenshot({ path: path.join(shotDir, 'popup.png'), fullPage: true });

    // Search clears after choosing.
    assert.equal(await popup.$eval('#search', (el) => el.value), '');
    assert.equal(await popup.$('#custom'), null, 'old Other-code form is gone');

    // A code that is not in the list is offered as a row and chosen the same way.
    await popup.type('#search', 'yue');
    const rows = await popup.$$eval('#list li', (li) =>
      li.map((x) => [x.dataset.code, x.classList.contains('custom-row')]),
    );
    assert.deepEqual(rows.at(-1), ['yue', true]);
    await popup.click('#list li.custom-row');
    await popup.waitForFunction(() => document.querySelector('#status strong')?.textContent.startsWith('Cantonese'));
    assert.equal((await sw.evaluate(() => chrome.storage.sync.get('lang'))).lang, 'yue');
    // The saved custom code stays visible as the selected row.
    assert.equal(await popup.$eval('#list li[aria-selected="true"]', (li) => li.dataset.code), 'yue');
    await popup.screenshot({ path: path.join(shotDir, 'popup-custom.png'), fullPage: true });

    // Pick Korean by clicking its row.
    await popup.type('#search', 'korean');
    await popup.click('#list li[data-code="ko"]');
    await popup.waitForFunction(() => document.querySelector('#status strong')?.textContent === 'Korean · 한국어');
    assert.equal((await sw.evaluate(() => chrome.storage.sync.get('lang'))).lang, 'ko');
    await popup.close();
  });

  await step('ko from popup is applied on next Maps load', async () => {
    const r = await open(MAPS);
    assert.match(r.requestUrl, /[?&]hl=ko(&|$)/);
    langIs(r.htmlLang, 'ko');
  });

  await setLang('');
} finally {
  await browser.close();
}

console.log(failures ? `\n${failures} step(s) failed` : '\nall e2e steps passed');
console.log(`screenshots: ${shotDir}`);
process.exit(failures ? 1 : 0);
