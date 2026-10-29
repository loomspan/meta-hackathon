import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const p = (...parts) => join(repoRoot, ...parts);
const read = (...parts) => readFileSync(p(...parts), 'utf8');

const V2_SQL = ['poc', 'fixtures', 'grocery-list-v2-update.sql'];
const WORKSHEETS = [
  ['poc', 'fixtures', 'gate1-worksheet-muse.md'],
  ['poc', 'fixtures', 'gate1-worksheet-chatgpt-web.md'],
];

// Every Results-worksheet field from ai/thoughts/plans/proof_of_concept.md.
const WORKSHEET_FIELDS = [
  'Companion, surface, model/version, account plan',
  'Gate and test IDs completed; deferred tests',
  'Setup prerequisites and initial state',
  'Cold setup duration and manual steps',
  'Build/Run: native install vs session load',
  'App pack: native install vs session load',
  'Fresh-chat loading and restart behavior',
  'Newly added app/operation through unchanged MCP',
  'Version refresh, permissions, and write correctness',
  'Explicit selection and optional natural-language routing',
  'Repeated-run results and evidence locations',
  'Blocker category and smallest viable remedy',
  'OAuth/integration failure step, evidence, and attribution confidence',
];

function v2Definition(sql) {
  const m = sql.match(/poc_app_definitions[\s\S]*?'(\{"operations"[\s\S]*?\})'::jsonb/);
  assert.ok(m, 'v2 update must insert a poc_app_definitions definition');
  return JSON.parse(m[1]);
}

test('version-2 fixture update artifact exists and is DB-definition-only', () => {
  assert.ok(existsSync(p(...V2_SQL)), 'grocery-list-v2-update.sql is missing');
  const sql = read(...V2_SQL);
  // Touches only database definition/app/pack rows: no Edge Function code,
  // no deploy/reconnect/tool change is part of the artifact.
  for (const table of ['poc_app_definitions', 'poc_apps', 'poc_packs']) {
    assert.ok(sql.includes(table), `v2 update must touch ${table}`);
  }
  assert.ok(!/functions\/mcp|supabase functions|registerTool/i.test(sql),
    'v2 update must not reference Edge Function code or tools');
  assert.match(sql, /no Edge Function redeploy/i);
  assert.match(sql, /no companion[\s\S]{0,16}reconnect/i);
  // Applies on top of version 1 and bumps exactly 1 -> 2.
  assert.match(sql, /'grocery-list',\s*2,/, 'v2 definition row must be version 2');
  assert.match(sql, /SET current_version = 2[\s\S]*current_version = 1/,
    'app bump must be guarded on current_version = 1');
  assert.match(sql, /SET version = 2[\s\S]*version = 1/,
    'pack bump must be guarded on version = 1');
});

test('v2 definition adds remove_item as a generic-executor delete, keeping v1 operations', () => {
  const def = v2Definition(read(...V2_SQL));
  const v1 = JSON.parse(read('poc', 'fixtures', 'expected-fixture.json')).definition;
  assert.deepEqual(def.operations.map((o) => o.name), ['list_items', 'add_item', 'remove_item']);
  // v1 operations are carried forward unchanged (name/kind/arguments/effect).
  for (const v1op of v1.operations) {
    const carried = def.operations.find((o) => o.name === v1op.name);
    assert.ok(carried, `${v1op.name} must be carried into v2`);
    assert.equal(carried.kind, v1op.kind);
    assert.deepEqual(carried.arguments, v1op.arguments);
    assert.deepEqual(carried.effect, v1op.effect);
  }
  const remove = def.operations.find((o) => o.name === 'remove_item');
  assert.equal(remove.kind, 'write');
  assert.deepEqual(remove.effect, { action: 'delete', resource: 'grocery_items', match: ['name'] });
  assert.deepEqual(remove.arguments, [
    { name: 'name', type: 'string', required: true, min_length: 1, trim: true },
  ]);
  // Pack-only presentation rules never enter the definition.
  assert.ok(!JSON.stringify(def).toLowerCase().includes('alphabetical'),
    'definition must not contain the pack-only alphabetical rule');
});

test('v2 update bumps the grocery pack and names remove_item, keeping pack-only rules', () => {
  const sql = read(...V2_SQL);
  const packMatch = sql.match(/UPDATE poc_packs[\s\S]*?WHERE id = 'grocery-list'/);
  assert.ok(packMatch, 'v2 update must update the grocery pack row');
  const lower = packMatch[0].toLowerCase();
  assert.ok(lower.includes('remove_item'), 'v2 pack instructions must name remove_item');
  assert.ok(lower.includes('alphabetically'), 'v2 pack must keep the alphabetical rule');
  assert.ok(lower.includes('count'), 'v2 pack must keep the count-header rule');
  assert.ok(/ask[^.]*quantity|quantity[^.]*ask/.test(lower), 'v2 pack must keep the ask-for-quantity rule');
});

test('Gate 1 worksheets are blank not-run templates with every worksheet field', () => {
  for (const ws of WORKSHEETS) {
    assert.ok(existsSync(p(...ws)), `${ws.join('/')} is missing`);
    const text = read(...ws);
    assert.match(text, /not-run/, `${ws.join('/')}: status must be not-run`);
    assert.match(text, /No human tester has run Gate 1 on this surface yet/);
    for (const field of WORKSHEET_FIELDS) {
      assert.ok(text.includes(field), `${ws.join('/')}: missing worksheet field "${field}"`);
    }
    // Each G1 test is present and scored not-run; G1.6 and G1.7 are separate rows.
    for (const id of ['G1.1', 'G1.2', 'G1.3', 'G1.4', 'G1.5', 'G1.6', 'G1.7']) {
      assert.match(text, new RegExp(`\\| ${id.replace('.', '\\.')} [^|]*\\| not-run \\|`),
        `${ws.join('/')}: ${id} must be a not-run row`);
    }
    // Pack delivery outcomes are distinguished, never merged.
    const flat = text.toLowerCase().replace(/\s+/g, ' ');
    for (const outcome of ['persistent native installation', 'instructions loaded for the current conversation', 'repeatable loading in a fresh conversation', 'manual workaround']) {
      assert.ok(flat.includes(outcome), `${ws.join('/')}: missing pack outcome "${outcome}"`);
    }
    for (const pack of ['Build pack', 'Run pack', 'Grocery-list app pack']) {
      assert.ok(text.includes(pack), `${ws.join('/')}: missing pack row "${pack}"`);
    }
    // Dual blocker classification and workaround burden.
    for (const category of ['account/policy eligibility', 'transport/authentication', 'host discovery', 'instruction delivery/adherence', 'persistence', 'generic invocation', 'user friction']) {
      assert.ok(text.includes(category), `${ws.join('/')}: missing blocker category "${category}"`);
    }
    for (const cause of ['fixture', 'provider', 'companion', 'interoperability', 'unknown']) {
      assert.ok(text.includes(cause), `${ws.join('/')}: missing root cause "${cause}"`);
    }
    assert.match(text, /added setup burden/);
    assert.match(text, /cause-unconfirmed/);
    // Thresholds and decision categories, with the decision left pending.
    assert.match(text, /10 minutes/);
    assert.match(text, /exactly one write/);
    assert.match(text, /Decision: \*\*pending \/ not-run\*\*/);
    for (const category of ['Proceed broadly', 'Proceed with narrower support', 'Revise pack delivery', 'Reconsider the central experience']) {
      assert.ok(text.includes(category), `${ws.join('/')}: missing decision category "${category}"`);
    }
    // No result is pre-marked passed.
    assert.ok(!/\|\s*passed\s*\|/i.test(text), `${ws.join('/')}: no test may be pre-marked passed`);
  }
});

test('README runbook covers every G1 step per surface with prompts and evidence capture', () => {
  const readme = read('poc', 'README.md');
  assert.match(readme, /## Gate 1 runbook \(Ticket 4\)/);
  assert.match(readme, /grocery-list-v2-update\.sql/);
  assert.match(readme, /gate1-worksheet-muse\.md/);
  assert.match(readme, /gate1-worksheet-chatgpt-web\.md/);
  for (const id of ['G1.1', 'G1.2', 'G1.3', 'G1.4', 'G1.5', 'G1.6', 'G1.7']) {
    assert.ok(readme.includes(id), `runbook must cover ${id}`);
  }
  for (const surface of ['Muse', 'ChatGPT web']) {
    assert.ok(readme.includes(surface), `runbook must cover ${surface}`);
  }
  // Exact prompts a tester types.
  for (const prompt of [
    'Please connect to Loomspan using the instructions at https://loomspan.ai/poc/',
    'Get the Loomspan Run pack and the Loomspan Build pack.',
    'Use Loomspan. List my apps, show the grocery-list summary, load the grocery-list pack, use the production environment, show my grocery list, and add Bread with quantity 2.',
    'Add Cheese to my grocery list.',
    'Use Loomspan. Open my grocery-list app, show my grocery list, and add Eggs with quantity 6.',
    'Use Loomspan. Load the current grocery-list pack and remove Milk from my grocery list.',
    'Add Pears to my grocery list with quantity 3, using the app version you already have loaded.',
  ]) {
    assert.ok(readme.includes(prompt), `runbook missing exact prompt: ${prompt}`);
  }
  // Evidence capture, honest scoring, dual classification, and the exit decision.
  assert.match(readme, /Transcript/);
  assert.match(readme, /Tool-call traces/);
  assert.match(readme, /poc_tool_call_log/);
  assert.match(readme, /Never store credentials/);
  assert.match(readme, /stale_version/);
  assert.match(readme, /exactly one write/);
  assert.match(readme, /persistent native installation/);
  assert.match(readme, /repeatable loading/);
  assert.match(readme, /manual workaround/);
  assert.match(readme, /account\/policy eligibility/);
  assert.match(readme, /cause-unconfirmed/);
  assert.match(readme, /pending \/ not-run/);
  assert.match(readme, /one documented attempt and one targeted correction/);
  // G1.7's stale call is preservable and uses an operation the v1 pack knows:
  // G1.6 runs in the original conversation, the fresh G1.5 conversation is
  // left untouched holding v1, and the fixture is reset to v1 between surfaces.
  assert.match(readme, /in conversation A only/);
  assert.match(readme, /Leave conversation B untouched/);
  assert.match(readme, /stale call must use `add_item`/);
  assert.match(readme, /Between surfaces: restore the version-1 fixture/);
  assert.match(readme, /DELETE FROM poc_app_definitions WHERE app_id = 'grocery-list' AND version = 2/);
});
