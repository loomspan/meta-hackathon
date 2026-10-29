// Hosted Gate 1 acceptance probe for the deployed MCP function.
// Reads credentials ONLY from environment variables; never prints tokens,
// passwords, or keys. Prints only tool names, ok flags, and error_codes.
//
// Required env:
//   POC_ANON_KEY            public anon/publishable key (from dashboard)
//   POC_OWNER_EMAIL         e.g. poc-owner@example.invalid
//   POC_OWNER_PASSWORD      owner password (set via Read-Host, see README)
//   POC_NONMEMBER_EMAIL     e.g. poc-nonmember@example.invalid
//   POC_NONMEMBER_PASSWORD  non-member password
// Optional env:
//   POC_MCP_URL  defaults to the Loomspan Testing function URL
//   POC_TEST_ITEM  name of the synthetic item added then reported for cleanup
import assert from 'node:assert/strict';

const base = 'https://yjrwyfkybszlpufsflan.supabase.co';
const mcpUrl = process.env.POC_MCP_URL ?? `${base}/functions/v1/mcp`;
const testItem = process.env.POC_TEST_ITEM ?? 'POC Acceptance Eggs';

function need(name) {
  const v = process.env[name];
  assert.ok(v, `missing env ${name}`);
  return v;
}

async function getToken(email, password) {
  const res = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: need('POC_ANON_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  assert.equal(res.status, 200, `token grant failed for ${email}: HTTP ${res.status} ${body.error_code ?? body.code ?? ''} ${body.msg ?? body.message ?? ''}`.trim());
  assert.ok(body.access_token, 'token grant returned no access_token');
  return body.access_token;
}

async function rpc(token, method, params, sessionId) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: Math.floor(Math.random() * 1e9), method, params }),
  });
  const text = await res.text();
  const sid = res.headers.get('mcp-session-id') ?? sessionId;
  let payload = null;
  for (const line of text.split(/\r?\n/)) {
    const data = line.startsWith('data:') ? line.slice(5).trim() : line.trim();
    if (!data) continue;
    try {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object' && ('result' in parsed || 'error' in parsed)) payload = parsed;
    } catch { /* keep scanning SSE lines */ }
  }
  return { status: res.status, payload, sessionId: sid };
}

async function connect(token) {
  const init = await rpc(token, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'hosted-acceptance', version: '0' },
  }, null);
  assert.equal(init.status, 200, `initialize failed: HTTP ${init.status}`);
  return init.sessionId;
}

async function callTool(token, sessionId, name, args) {
  const { status, payload } = await rpc(token, 'tools/call', { name, arguments: args }, sessionId);
  assert.ok(payload, `no JSON-RPC payload for ${name} (HTTP ${status})`);
  if (payload.error) return { ok: false, error_code: 'rpc_error', http: status };
  const result = payload.result ?? {};
  const structured = result.structuredContent ?? null;
  if (structured) return { ...structured, http: status };
  const text = result.content?.find((c) => c.type === 'text')?.text ?? '{}';
  return { ...JSON.parse(text), http: status };
}

function show(label, res, expectOk = true) {
  const code = res.ok ? 'ok' : (res.error_code ?? 'error');
  console.log(`${res.ok === expectOk ? 'PASS' : 'FAIL'} ${label}: ${code} (HTTP ${res.http})`);
  return res;
}

const ownerToken = await getToken(need('POC_OWNER_EMAIL'), need('POC_OWNER_PASSWORD'));
const nonmemberToken = await getToken(need('POC_NONMEMBER_EMAIL'), need('POC_NONMEMBER_PASSWORD'));
console.log('PASS token grants for owner and non-member (values not printed)');

const unauth = await rpc(null, 'tools/call', { name: 'list_apps', arguments: {} }, null);
console.log(`${unauth.status === 401 ? 'PASS' : 'FAIL'} unauthenticated tools/call rejected: HTTP ${unauth.status}`);
assert.equal(unauth.status, 401);

const ownerSession = await connect(ownerToken);
const nonmemberSession = await connect(nonmemberToken);

const apps = show('owner list_apps', await callTool(ownerToken, ownerSession, 'list_apps', {}));
assert.equal(apps.ok, true);
assert.equal(apps.apps?.length, 1);
assert.equal(apps.apps[0].app_id, 'grocery-list');
assert.ok(!('instructions' in apps.apps[0]) && !('operations' in apps.apps[0]), 'list_apps leaked pack content');

for (const packId of ['build', 'run', 'grocery-list']) {
  const pack = show(`owner get_pack ${packId}`, await callTool(ownerToken, ownerSession, 'get_pack', { pack_id: packId }));
  assert.equal(pack.ok, true, packId);
  if (packId === 'grocery-list') assert.ok(pack.operations?.some((o) => o.name === 'add_item'));
  else assert.ok(!('operations' in pack), `${packId} pack must not carry operations`);
}

const version = apps.apps[0].version;
const call = (token, session, over) =>
  callTool(token, session, 'call_operation', { app_id: 'grocery-list', app_version: version, ...over });

const before = show('owner list_items before', await call(ownerToken, ownerSession, { operation: 'list_items', arguments: {} }));
assert.equal(before.ok, true);
const beforeCount = before.items.length;

const added = show('owner add_item', await call(ownerToken, ownerSession, { operation: 'add_item', arguments: { name: testItem, quantity: 6 } }));
assert.equal(added.ok, true);

const after = show('owner list_items after add', await call(ownerToken, ownerSession, { operation: 'list_items', arguments: {} }));
assert.equal(after.items.length, beforeCount + 1);
assert.equal(after.items[after.items.length - 1].name, testItem);

for (const bad of [{ name: '', quantity: 1 }, { name: 'X', quantity: 0 }, { name: 'X', quantity: 1.5 }]) {
  const res = show(`owner add_item invalid ${JSON.stringify(bad)}`, await call(ownerToken, ownerSession, { operation: 'add_item', arguments: bad }), false);
  assert.equal(res.ok, false);
  assert.equal(res.error_code, 'invalid_arguments');
}
const afterInvalid = await call(ownerToken, ownerSession, { operation: 'list_items', arguments: {} });
assert.equal(afterInvalid.items.length, beforeCount + 1, 'invalid add mutated items');
console.log('PASS invalid adds mutated nothing');

const stale = show('owner stale app_version', await call(ownerToken, ownerSession, { app_version: version + 99, operation: 'add_item', arguments: { name: 'StaleWrite', quantity: 1 } }), false);
assert.equal(stale.ok, false);
assert.equal(stale.error_code, 'stale_version');
assert.equal(stale.current_version, version);
const afterStale = await call(ownerToken, ownerSession, { operation: 'list_items', arguments: {} });
assert.ok(!afterStale.items.some((i) => i.name === 'StaleWrite'), 'stale call mutated items');
console.log('PASS stale_version mutated nothing (wrong-version probe; formal version-bump probe is ticket 4)');

const nmApps = show('non-member list_apps', await callTool(nonmemberToken, nonmemberSession, 'list_apps', {}));
assert.deepEqual(nmApps.apps, []);
const nmPack = show('non-member get_pack grocery-list', await callTool(nonmemberToken, nonmemberSession, 'get_pack', { pack_id: 'grocery-list' }), false);
assert.equal(nmPack.error_code, 'not_member');
const nmList = show('non-member list_items', await call(nonmemberToken, nonmemberSession, { operation: 'list_items', arguments: {} }), false);
assert.equal(nmList.error_code, 'not_member');
const nmAdd = show('non-member add_item', await call(nonmemberToken, nonmemberSession, { operation: 'add_item', arguments: { name: 'Nope', quantity: 1 } }), false);
assert.equal(nmAdd.error_code, 'not_member');

console.log(`DONE: hosted acceptance passed. Clean up the synthetic test item in SQL: DELETE FROM poc_grocery_items WHERE name = '${testItem}';`);
