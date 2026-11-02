// Renders Chrome Web Store images into store/images/:
//   screenshot-1.png  1280x800  before/after: English vs local Japanese
//   screenshot-2.png  1280x800  Maps in Japanese + the popup
//   promo-small.png   440x280   small promo tile
// Run: npm run assets   (needs network; drives real Google Maps)
import puppeteer from 'puppeteer';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const extDir = path.join(root, 'extension');
const outDir = path.join(root, 'store', 'images');
mkdirSync(outDir, { recursive: true });

const PLACE = 'https://www.google.com/maps/search/Tokyo+Tower/@35.6586,139.7454,17z';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b64 = (buf) => `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;

const browser = await puppeteer.launch({
  headless: true,
  pipe: true,
  enableExtensions: [extDir],
  args: ['--lang=en-US'],
});

try {
  const swTarget = await browser.waitForTarget(
    (t) => t.type() === 'service_worker' && t.url().endsWith('/background.js'),
  );
  const extId = new URL(swTarget.url()).host;
  const sw = await swTarget.worker();
  const setLang = (l) => sw.evaluate((x) => globalThis.setLang(x), l);

  async function mapsShot(lang, width, height, scrollPanel = 0) {
    await setLang(lang);
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await page.goto(PLACE, { waitUntil: 'networkidle2', timeout: 90_000 });
    await sleep(6000); // let tiles and the place panel settle
    await page.mouse.move(width - 5, height / 2); // no hover tooltips
    await page.evaluate((y) => {
      document.activeElement?.blur();
      // Scroll the place side panel so the address row is in view.
      for (const el of document.querySelectorAll('div')) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 100 && r.left < 100 && r.width > 300) {
          el.scrollTop = y;
          break;
        }
      }
    }, scrollPanel);
    await sleep(800);
    const buf = await page.screenshot();
    await page.close();
    return buf;
  }

  async function popupShot(lang) {
    await setLang(lang);
    const page = await browser.newPage();
    await page.setViewport({ width: 320, height: 520, deviceScaleFactor: 2 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await page.goto(`chrome-extension://${extId}/popup.html`);
    await page.waitForSelector('#list li[aria-selected="true"]');
    await sleep(300);
    const buf = await page.screenshot();
    await page.close();
    return buf;
  }

  const en = await mapsShot('en', 640, 690, 150);
  const ja = await mapsShot('ja', 640, 690, 150);
  const jaFull = await mapsShot('ja', 1280, 800);
  const popup = await popupShot('ja');
  await setLang('');

  const font = `system-ui,-apple-system,"Segoe UI",Roboto,sans-serif`;
  const icon = b64(readFileSync(path.join(extDir, 'icons', 'icon128.png')));

  const compose = async (html, width, height, file) => {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: path.join(outDir, file) });
    await page.close();
    console.log(`store/images/${file}`);
  };

  await compose(
    `<style>
      body{margin:0;width:1280px;height:800px;background:#e8f0fe;font-family:${font};overflow:hidden}
      h1{margin:0;padding:16px 0 0;text-align:center;font-size:28px;color:#174ea6}
      .row{display:flex;gap:12px;justify-content:center;margin-top:10px}
      figure{margin:0;display:flex;flex-direction:column;align-items:flex-start;gap:8px}
      figure img{display:block;width:620px;height:670px;object-fit:cover;object-position:left top;border:1px solid #c6dafc;border-radius:8px}
      figcaption{padding:5px 12px;border-radius:999px;font-size:16px;font-weight:600;color:#fff}
      .before figcaption{background:#5f6368}.after figcaption{background:#1a73e8}
    </style>
    <h1>See the names and addresses the way they are written on the street</h1>
    <div class="row">
      <figure class="before"><figcaption>Account language (English)</figcaption><img src="${b64(en)}"></figure>
      <figure class="after"><figcaption>Local language: 日本語 (hl=ja)</figcaption><img src="${b64(ja)}"></figure>
    </div>`,
    1280, 800, 'screenshot-1.png',
  );

  await compose(
    `<style>
      body{margin:0;width:1280px;height:800px;overflow:hidden;font-family:${font}}
      .map{position:absolute;inset:0;width:1280px;height:800px}
      .pop{position:absolute;right:28px;top:24px;width:320px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.35);overflow:hidden;background:#fff}
      .pop img{display:block;width:320px}
    </style>
    <img class="map" src="${b64(jaFull)}">
    <div class="pop"><img src="${b64(popup)}"></div>`,
    1280, 800, 'screenshot-2.png',
  );

  await compose(
    `<style>
      body{margin:0;width:440px;height:280px;overflow:hidden;font-family:${font};
        background:linear-gradient(135deg,#34a853,#1a73e8);color:#fff;display:flex;align-items:center;gap:22px;padding:0 30px;box-sizing:border-box}
      img{width:110px;height:110px;filter:drop-shadow(0 4px 12px rgba(0,0,0,.25))}
      h1{margin:0 0 8px;font-size:30px;line-height:1.1}
      p{margin:0;font-size:15px;line-height:1.35;opacity:.95}
    </style>
    <img src="${icon}">
    <div><h1>Maps Language Override</h1><p>Read Google Maps in the local language, not your account language.</p></div>`,
    440, 280, 'promo-small.png',
  );
} finally {
  await browser.close();
}
