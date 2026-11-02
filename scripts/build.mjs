// Zips extension/ into dist/maps-language-override-v<version>.zip
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const extDir = path.join(root, 'extension');
const { version } = JSON.parse(readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
const out = path.join(root, 'dist', `maps-language-override-v${version}.zip`);

mkdirSync(path.dirname(out), { recursive: true });
rmSync(out, { force: true });
execFileSync('zip', ['-r', '-X', '-q', out, '.', '-x', '.*', '*/.*', 'icons/icon.svg'], {
  cwd: extDir,
  stdio: 'inherit',
});
console.log(out);
