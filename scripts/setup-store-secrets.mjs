// One-time setup for push-to-deploy: gets a Chrome Web Store API refresh token
// and saves all five GitHub Actions secrets with `gh secret set`.
//
//   node scripts/setup-store-secrets.mjs <client_secret.json> <EXTENSION_ID> <PUBLISHER_ID>
//
// <client_secret.json> is the file you download for a Google Cloud OAuth client
// of type "Desktop app" (see README). The script opens Google's consent page in
// your browser, catches the reply on 127.0.0.1, and never prints any secret.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const [file, extensionId, publisherId] = process.argv.slice(2);
if (!file || !/^[a-p]{32}$/.test(extensionId || '') || !publisherId) {
  console.error(
    'Usage: node scripts/setup-store-secrets.mjs <client_secret.json> <EXTENSION_ID (32 letters a-p)> <PUBLISHER_ID>',
  );
  process.exit(1);
}

const json = JSON.parse(readFileSync(file, 'utf8'));
const client = json.installed ?? json.web;
if (!client?.client_id || !client?.client_secret) {
  console.error('That file has no client_id/client_secret. Download the JSON of a "Desktop app" OAuth client.');
  process.exit(1);
}

const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
const state = randomBytes(16).toString('hex');

// 1. Wait for Google's redirect on a random local port.
let redirectUri;
const code = await new Promise((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname !== '/') return res.writeHead(404).end();
    const ok = url.searchParams.get('state') === state && url.searchParams.get('code');
    res.writeHead(ok ? 200 : 400, { 'content-type': 'text/html; charset=utf-8' });
    res.end(ok ? '<h2>Done. You can close this tab and go back to the terminal.</h2>' : '<h2>Sign-in failed.</h2>');
    server.close();
    ok ? resolve(url.searchParams.get('code')) : reject(new Error(url.searchParams.get('error') || 'no code returned'));
  });
  server.listen(0, '127.0.0.1', () => {
    redirectUri = `http://127.0.0.1:${server.address().port}`;
    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    auth.search = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    console.log('Opening Google sign-in in your browser… choose the account that owns the Web Store item.');
    spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [auth.toString()], { stdio: 'ignore', detached: true });
    setTimeout(() => reject(new Error('Timed out after 5 minutes waiting for sign-in.')), 5 * 60_000).unref();
  });
});

// 2. Exchange the code for a refresh token.
const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: new URLSearchParams({
    code,
    client_id: client.client_id,
    client_secret: client.client_secret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  }),
});
const tokens = await tokenRes.json();
if (!tokens.refresh_token) {
  console.error(`No refresh token returned (${tokens.error || tokenRes.status}: ${tokens.error_description || ''}).`);
  process.exit(1);
}
console.log('✔ Got a refresh token.');

// 3. Check the token can see the item (non-fatal: the item may still be in review).
try {
  const r = await fetch(
    `https://chromewebstore.googleapis.com/v2/publishers/${publisherId}/items/${extensionId}:fetchStatus`,
    { headers: { authorization: `Bearer ${tokens.access_token}` } },
  );
  console.log(r.ok ? '✔ Chrome Web Store API can see the item.' : `! API check returned HTTP ${r.status} (continuing).`);
} catch {
  console.log('! Could not reach the Chrome Web Store API to check (continuing).');
}

// 4. Save the secrets in this repo (values go through stdin, never argv or output).
const secrets = {
  EXTENSION_ID: extensionId,
  PUBLISHER_ID: publisherId,
  CLIENT_ID: client.client_id,
  CLIENT_SECRET: client.client_secret,
  REFRESH_TOKEN: tokens.refresh_token,
};
for (const [name, value] of Object.entries(secrets)) {
  execFileSync('gh', ['secret', 'set', name], { input: value, stdio: ['pipe', 'ignore', 'inherit'] });
  console.log(`✔ GitHub secret ${name} saved`);
}
console.log('\nDone. From now on: bump "version" in extension/manifest.json and push to main to publish.');
