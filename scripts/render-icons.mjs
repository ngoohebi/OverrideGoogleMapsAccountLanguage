// Renders extension/icons/icon.svg to the PNG sizes the manifest uses.
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../extension/icons/icon.svg', import.meta.url), 'utf8');
const browser = await puppeteer.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({
    path: new URL(`../extension/icons/icon${size}.png`, import.meta.url).pathname,
    omitBackground: true,
  });
}
await browser.close();
console.log('icons rendered');
