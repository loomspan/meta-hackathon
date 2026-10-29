import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const p = (...parts) => join(repoRoot, ...parts);

test('poc scaffold exists with required structure', () => {
  const required = [
    'poc/README.md',
    'poc/mcp-server/supabase/config.toml',
    'poc/mcp-server/supabase/migrations/20261027000001_poc_fixture_schema.sql',
    'poc/mcp-server/supabase/seed.sql',
    'poc/mcp-server/supabase/functions/mcp/index.ts',
    'poc/mcp-server/supabase/functions/mcp/core.ts',
    'poc/mcp-server/supabase/functions/mcp/data.ts',
    'poc/mcp-server/.env.example',
    'poc/web/index.html',
    'poc/web/oauth/consent.html',
    'poc/web/assets/consent-core.mjs',
    'poc/web/assets/consent.js',
    'poc/web/assets/config.js',
    'poc/fixtures/expected-fixture.json',
    'poc/mcp-server/tests/fixture.assertions.sql',
  ];
  for (const rel of required) {
    assert.ok(existsSync(p(rel)), `${rel} does not exist`);
  }
});

test('poc/web contains the ticket-3 pages and no placeholder', () => {
  const entries = readdirSync(p('poc/web'));
  for (const name of ['index.html', 'oauth', 'assets']) {
    assert.ok(entries.includes(name), `poc/web must contain ${name}, found: ${entries}`);
  }
  assert.ok(!entries.includes('.gitkeep'), '.gitkeep must be removed once real web files exist');
});

test('mcp function directory contains the Gate 1 function files', () => {
  const entries = readdirSync(p('poc/mcp-server/supabase/functions/mcp'));
  for (const name of ['index.ts', 'core.ts', 'data.ts']) {
    assert.ok(entries.includes(name), `functions/mcp must contain ${name}, found: ${entries}`);
  }
});

test('no POC file exists at repo root', () => {
  const rootEntries = readdirSync(repoRoot);
  for (const name of rootEntries) {
    assert.ok(!/^poc[-_.]/i.test(name), `POC-related root entry not allowed: ${name}`);
    assert.ok(!/^(mcp-server|fixtures|seed\.sql|migration)/i.test(name), `POC-related root entry not allowed: ${name}`);
  }
  assert.ok(existsSync(p('poc')), 'poc/ directory must exist');
});

test('README has preflight, owner-setup and local-setup sections', () => {
  const readme = readFileSync(p('poc/README.md'), 'utf8');
  assert.match(readme, /## Supabase preflight evidence/);
  assert.match(readme, /OAuth 2\.1/);
  assert.match(readme, /[Dd]ynamic client registration/);
  assert.match(readme, /ES256|RS256/);
  assert.match(readme, /HS256/);
  assert.match(readme, /## Test owner setup/);
  assert.match(readme, /## Local fixture setup/);
  assert.match(readme, /00000000-0000-4000-8000-000000000001/);
});

test('seed: grocery pack only carries presentation rules', () => {
  const seed = readFileSync(p('poc/mcp-server/supabase/seed.sql'), 'utf8');
  const lower = seed.toLowerCase();
  assert.ok(lower.includes('alphabetical'), 'seed must state alphabetical rule (grocery pack)');
  assert.ok(lower.includes('count'), 'seed must state count-header rule (grocery pack)');
  assert.ok(/ask[^.]*quantity|quantity[^.]*ask/.test(lower), 'seed must state ask-for-quantity rule');
  // Definition JSONB segment must not contain the pack-only rules.
  const defMatch = seed.match(/poc_app_definitions[\s\S]*?VALUES\s*\([\s\S]*?\)\s*ON CONFLICT/);
  assert.ok(defMatch, 'seed must insert into poc_app_definitions');
  const defText = defMatch[0].toLowerCase();
  assert.ok(!defText.includes('alphabetical'), 'app definition must NOT contain alphabetical rule');
  assert.ok(!/ask[^)]*quantity/.test(defText), 'app definition must NOT contain ask-for-quantity rule');
});

test('no alphabetical ordering in migration or seed SQL logic', () => {
  for (const rel of [
    'poc/mcp-server/supabase/migrations/20261027000001_poc_fixture_schema.sql',
    'poc/mcp-server/supabase/seed.sql',
  ]) {
    const sql = readFileSync(p(rel), 'utf8');
    assert.ok(!/order\s+by\s+name/i.test(sql), `${rel} must not contain ORDER BY name`);
  }
});

test('expected-fixture.json parses with non-alphabetical insertion order', () => {
  const fx = JSON.parse(readFileSync(p('poc/fixtures/expected-fixture.json'), 'utf8'));
  assert.equal(fx.app.id, 'grocery-list');
  assert.equal(fx.app.current_version, 1);
  assert.deepEqual(fx.items.map((i) => i[0]), ['Oats', 'Apples', 'Milk']);
  assert.deepEqual(fx.items.map((i) => i[1]), [2, 4, 1]);
  const alpha = [...fx.items.map((i) => i[0])].sort();
  assert.notDeepEqual(fx.items.map((i) => i[0]), alpha, 'insertion order must differ from alphabetical order');
  assert.deepEqual(fx.packs.map((x) => x.id).sort(), ['build', 'grocery-list', 'run']);
});
