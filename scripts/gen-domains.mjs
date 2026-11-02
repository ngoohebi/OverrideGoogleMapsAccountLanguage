// Regenerates host_permissions in extension/manifest.json from Google's
// official list of search domains (https://www.google.com/supported_domains).
// Run: npm run gen:domains
import { readFile, writeFile } from 'node:fs/promises';

const MANIFEST = new URL('../extension/manifest.json', import.meta.url);

const res = await fetch('https://www.google.com/supported_domains');
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const domains = (await res.text())
  .split('\n')
  .map((d) => d.trim().replace(/^\./, ''))
  .filter((d) => /^google\.[a-z.]+$/.test(d));

if (domains.length < 100) throw new Error(`Suspiciously few domains: ${domains.length}`);

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
manifest.host_permissions = [...new Set(domains)].sort().map((d) => `*://*.${d}/*`);
await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`host_permissions: ${manifest.host_permissions.length} Google domains`);
