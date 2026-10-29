import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const w = (...parts) => join(webRoot, ...parts);
const read = (...parts) => readFileSync(w(...parts), 'utf8');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full)); else out.push(full);
  }
  return out;
}

test('D5 layout: onboarding and consent pages exist, .gitkeep removed', () => {
  assert.ok(existsSync(w('index.html')), 'poc/web/index.html missing');
  assert.ok(existsSync(w('oauth', 'consent.html')), 'poc/web/oauth/consent.html missing');
  assert.ok(!existsSync(w('.gitkeep')), '.gitkeep must be removed once real files exist');
  for (const rel of [['assets', 'poc.css'], ['assets', 'config.js'], ['assets', 'consent-core.mjs'], ['assets', 'consent.js'], ['assets', 'onboarding.js']]) {
    assert.ok(existsSync(w(...rel)), `${rel.join('/')} missing`);
  }
});

test('consent page contains required state regions and disabled decision buttons', () => {
  const html = read('oauth', 'consent.html');
  for (const id of ['consent-loading', 'consent-signin', 'consent-details', 'consent-error', 'consent-deciding', 'client-name', 'client-meta', 'scope-list', 'user-email', 'approve-button', 'deny-button', 'signin-email', 'signin-password', 'signin-submit', 'signin-error', 'details-error']) {
    assert.ok(html.includes(`id="${id}"`), `consent page missing id="${id}"`);
  }
  assert.match(html, /<noscript>/);
  assert.match(html, /id="approve-button"[^>]*disabled/);
  assert.match(html, /id="deny-button"[^>]*disabled/);
});

test('onboarding page has server URL, both surfaces, entry prompt, copy blocks', () => {
  const html = read('index.html');
  assert.ok(html.includes('Connect Loomspan (POC)'));
  assert.ok(html.includes('https://yjrwyfkybszlpufsflan.supabase.co/functions/v1/mcp'));
  assert.match(html, /Muse \(muse\.ai\)/);
  assert.match(html, /ChatGPT web/);
  assert.ok(html.includes('Connect to Loomspan using the Loomspan MCP server, then open my grocery-list app.'));
  assert.match(html, /one connection serves all apps/i);
  assert.match(html, /data-copy-target/);
});

test('all first-party src/href references are relative; CDN import is the only external script', () => {
  for (const rel of [['index.html'], ['oauth', 'consent.html']]) {
    const html = read(...rel);
    for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      assert.ok(!m[1].startsWith('/'), `${rel.join('/')} has absolute ref ${m[1]}`);
    }
  }
  const glue = read('assets', 'consent.js');
  const externalScripts = [...glue.matchAll(/from\s+["'](https:\/\/[^"']+)["']/g)].map((m) => m[1]);
  assert.equal(externalScripts.length, 1);
  // Exact pin (not a floating range): 2.78.0 is the first verified release
  // whose bundle contains auth.oauth.getAuthorizationDetails /
  // approveAuthorization / denyAuthorization; 2.57.4 lacked all three and
  // broke the live consent page. Assert the ticket requirement, not trivia.
  assert.equal(externalScripts[0], 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.78.0/+esm');
  // Tested core is the shipped path: glue delegates, never calls auth.oauth directly.
  assert.ok(glue.includes('loadAuthorization') && glue.includes('decideAuthorization'));
  assert.ok(!glue.includes('auth.oauth.'), 'glue must not call auth.oauth directly');
  // Glue must use textContent (not innerHTML) for authorization-derived data.
  assert.ok(!/\.innerHTML\s*=/.test(glue), 'glue must not assign innerHTML');
});

test('config.js is placeholder-only and no web source carries secret material', () => {
  const config = read('assets', 'config.js');
  assert.ok(config.includes('__LOOMSPAN_ANON_KEY__'));
  assert.ok(config.includes('https://yjrwyfkybszlpufsflan.supabase.co'));
  for (const file of walk(webRoot)) {
    if (file.includes(`${'tests'}`) && file.endsWith('.test.mjs')) continue;
    const rel = file.slice(webRoot.length);
    if (rel.includes('tests')) continue; // dev-only scripts may name env vars, never values
    const text = readFileSync(file, 'utf8');
    assert.ok(!/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\./.test(text), `JWT-shaped string in ${rel}`);
    assert.ok(!/service_role/i.test(text), `service_role in ${rel}`);
    assert.ok(!/SUPABASE_SERVICE_ROLE_KEY/.test(text), `service-role var in ${rel}`);
    assert.ok(!/-----BEGIN (RSA |EC )?PRIVATE KEY-----/.test(text), `private key in ${rel}`);
  }
});

test('poc.css honours mechanically checkable taste constraints', () => {
  const css = read('assets', 'poc.css');
  assert.ok(!/linear-gradient|radial-gradient/.test(css), 'no gradients');
  assert.ok(!/backdrop-filter/.test(css), 'no glassmorphism');
  assert.ok(!/scale\(1\.05/.test(css), 'no hover scale');
  assert.ok(!/#faf8f4/i.test(css), 'no cream whole-page background');
  assert.ok(!/purple|indigo|violet/i.test(css), 'no purple/indigo/violet');
  assert.ok(css.includes('prefers-reduced-motion'), 'must respect prefers-reduced-motion');
});
