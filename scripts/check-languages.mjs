// Checks which ?hl= codes google.com/maps really renders, by reading <html lang>.
//   npm run check:languages            → checks extension/languages.js
//   npm run check:languages -- yue haw → checks the given codes
// Unknown codes fall back to the visitor's default language, so a code passes
// only when the page language starts with the requested code.
import { MAPS_LANGUAGES } from '../extension/languages.js';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const codes = process.argv.slice(2).length ? process.argv.slice(2) : MAPS_LANGUAGES;

async function pageLang(code) {
  const res = await fetch(`https://www.google.com/maps?hl=${encodeURIComponent(code)}`, {
    headers: { 'user-agent': UA, 'accept-language': 'de-DE,de;q=0.9' },
  });
  const html = await res.text();
  return /<html[^>]*\slang="([^"]+)"/.exec(html)?.[1] ?? '?';
}

// The region suffix comes from the visitor's location (e.g. ja-TW), except for
// real variants such as es-419 and pt-PT, which Maps keeps.
const ok = (code, lang) => {
  const l = lang.toLowerCase();
  const c = code.toLowerCase();
  return code.includes('-') ? l === c : l === c || l.startsWith(`${c}-`);
};

let bad = 0;
for (let i = 0; i < codes.length; i += 4) {
  const batch = codes.slice(i, i + 4);
  const langs = await Promise.all(batch.map(pageLang));
  batch.forEach((code, j) => {
    const pass = ok(code, langs[j]);
    if (!pass) bad++;
    console.log(`${pass ? '✔' : '✖'} ${code.padEnd(7)} → ${langs[j]}`);
  });
}
console.log(`\n${codes.length - bad}/${codes.length} render in the requested language`);
process.exit(bad ? 1 : 0);
