import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const p = (...parts) => join(repoRoot, ...parts);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const JWT_RE = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;
const PLACEHOLDER_UUID = '00000000-0000-4000-8000-000000000001';
// Documented throwaway local-Docker-only value from the README; not a real secret.
const ALLOWED_LITERALS = ['poc-local-only'];

test('secret-scan regex self-check (in-memory fabricated sample)', () => {
  const fabricated = ['eyJ' + 'a'.repeat(10), 'eyJ' + 'b'.repeat(10), 'c'.repeat(12)].join('.');
  assert.ok(JWT_RE.test(fabricated), 'JWT regex must match a fabricated JWT-shaped string');
});

test('no secret material in any committed poc/ file', () => {
  const files = walk(p('poc'));
  assert.ok(files.length > 0, 'poc/ must contain files to scan');
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    assert.ok(!JWT_RE.test(text), `JWT-shaped string found in ${file}`);
    assert.ok(!/-----BEGIN (RSA |EC )?PRIVATE KEY-----/.test(text), `private key header in ${file}`);
    assert.ok(!/service[_-]?role[^\n]{0,40}eyJ/i.test(text), `service-role key material in ${file}`);
    for (const m of text.matchAll(/(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY)[ \t]*=[ \t]*(\S+)/g)) {
      assert.fail(`non-empty ${m[1]} value in ${file}`);
    }
    for (const m of text.matchAll(/password\s*[:=]\s*['"]?([^\s'"]+)/gi)) {
      assert.ok(ALLOWED_LITERALS.includes(m[1]), `password value committed in ${file}`);
    }
  }
});

test('.env.example values are all empty', () => {
  const text = readFileSync(p('poc/mcp-server/.env.example'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    assert.ok(eq > 0, `.env.example line must be KEY=: ${line}`);
    assert.equal(t.slice(eq + 1).trim(), '', `.env.example value must be empty: ${line}`);
  }
});

test('.gitignore covers env files with .env.example negated', () => {
  const text = readFileSync(p('.gitignore'), 'utf8');
  assert.match(text, /^\.env$/m);
  assert.match(text, /^\.env\.\*/m);
  assert.match(text, /^!\.env\.example$/m);
});

test('placeholder UUID is the only UUID literal in seed.sql', () => {
  const seed = readFileSync(p('poc/mcp-server/supabase/seed.sql'), 'utf8');
  const uuids = seed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? [];
  assert.ok(uuids.length >= 1, 'seed must contain the placeholder membership UUID');
  for (const u of uuids) assert.equal(u.toLowerCase(), PLACEHOLDER_UUID);
});
