import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const p = (...parts) => join(repoRoot, ...parts);
const fnDir = p('poc/mcp-server/supabase/functions/mcp');
const read = (name) => readFileSync(join(fnDir, name), 'utf8');

test('index.ts registers exactly the three Gate 1 tools', () => {
  const src = read('index.ts');
  const registered = [...src.matchAll(/registerTool\(\s*["']([^"']+)["']/g)].map((m) => m[1]).sort();
  assert.deepEqual(registered, ['call_operation', 'get_pack', 'list_apps']);
  assert.ok(!src.includes('save_sandbox_definition'), 'Gate 2 tool must not be registered');
  assert.ok(!src.includes('publish_test_revision'), 'Gate 2 tool must not be registered');
});

test('core.ts has no operation-name dispatch', () => {
  const src = read('core.ts');
  for (const name of ['list_items', 'add_item', 'remove_item']) {
    assert.ok(!src.includes(`"${name}"`), `core.ts must not dispatch on "${name}"`);
    assert.ok(!src.includes(`'${name}'`), `core.ts must not dispatch on '${name}'`);
  }
  assert.ok(!/switch\s*\(\s*(operation|op)\b/.test(src), 'core.ts must not switch on an operation');
});

test('no function source logs credentials or contains a service-role key value', () => {
  for (const name of readdirSync(fnDir).filter((n) => n.endsWith('.ts'))) {
    const src = read(name);
    assert.ok(!/console\.(log|error|info|warn)[^\n]*\b(authorization|token)\b/i.test(src), `${name} must not log headers or tokens`);
    assert.ok(!/eyJ[A-Za-z0-9_-]{8,}\./.test(src), `${name} must not contain a key value`);
  }
});

test('.gitkeep is absent once index.ts exists', () => {
  assert.ok(existsSync(join(fnDir, 'index.ts')));
  assert.ok(!existsSync(join(fnDir, '.gitkeep')), '.gitkeep must be removed once real files exist');
});
