// Developer-run live reference OAuth flow (plan D7). NOT part of the
// automated node --test gates and never run unattended: it needs the deployed
// consent page, Supabase dashboard settings (Site URL + Authorization Path),
// and a developer signing in and approving/denying in a browser.
//
// Usage:
//   node poc/web/tests/oauth-reference-flow.mjs          # approval run
//   node poc/web/tests/oauth-reference-flow.mjs --deny   # denial run
// Optional env: POC_SUPABASE_URL, POC_MCP_URL (recorded project defaults).
// No password is read here. Step output is redacted by construction: it
// prints step names, HTTP statuses, ok/error_code, token_type/expires_in,
// and app IDs only — never codes, verifiers, or tokens. One intentional
// exception: the authorize URL (which carries state and the client id) is
// printed so the developer can open it; do not copy that URL, or any
// terminal transcript containing it, into recorded evidence.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';

const denyMode = process.argv.includes('--deny');
const supabaseUrl = (process.env.POC_SUPABASE_URL ?? 'https://yjrwyfkybszlpufsflan.supabase.co').replace(/\/$/, '');
const mcpUrl = process.env.POC_MCP_URL ?? `${supabaseUrl}/functions/v1/mcp`;
const redirectUri = 'http://127.0.0.1:8765/callback';
const b64url = (buf) => Buffer.from(buf).toString('base64url');

// 1. Discovery
const discoveryRes = await fetch(`${supabaseUrl}/.well-known/oauth-authorization-server/auth/v1`);
assert.equal(discoveryRes.status, 200, `discovery failed: HTTP ${discoveryRes.status}`);
const discovery = await discoveryRes.json();
for (const field of ['authorization_endpoint', 'token_endpoint', 'registration_endpoint']) {
  assert.ok(discovery[field], `discovery missing ${field}`);
}
console.log('PASS discovery: authorization, token, and registration endpoints present');

// 2. Fresh DCR client per run (plan D8: forces a real consent decision)
const dcrRes = await fetch(discovery.registration_endpoint, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_name: 'loomspan-poc-reference', redirect_uris: [redirectUri],
    grant_types: ['authorization_code'], response_types: ['code'],
    token_endpoint_auth_method: 'none',
  }),
});
assert.ok(dcrRes.status === 200 || dcrRes.status === 201, `DCR failed: HTTP ${dcrRes.status}`);
const client = await dcrRes.json();
assert.ok(client.client_id, 'DCR returned no client_id');
console.log(`PASS dynamic client registration: HTTP ${dcrRes.status} (client id not printed)`);

// 3. PKCE + authorize URL (endpoint printed without its query)
const verifier = b64url(randomBytes(48));
const challenge = b64url(createHash('sha256').update(verifier).digest());
const state = b64url(randomBytes(24));
const authorizeUrl = new URL(discovery.authorization_endpoint);
authorizeUrl.search = new URLSearchParams({
  response_type: 'code', client_id: client.client_id, redirect_uri: redirectUri,
  scope: 'openid email profile', state, code_challenge: challenge, code_challenge_method: 'S256',
}).toString();

// 4. One-shot local callback listener
const callback = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('timed out waiting for the browser callback (10 min)')), 600_000);
  const server = createServer((req, res) => {
    const url = new URL(req.url, redirectUri);
    if (url.pathname !== '/callback') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Loomspan reference flow: you can close this tab and return to the terminal.');
    clearTimeout(timer); server.close();
    resolve(url.searchParams);
  });
  server.listen(8765, '127.0.0.1', () => {
    console.log(`Open this authorize URL in a browser, sign in if prompted, then ${denyMode ? 'DENY' : 'APPROVE'} the request:`);
    console.log(authorizeUrl.toString());
  });
  server.on('error', reject);
});
assert.equal(callback.get('state'), state, 'callback state mismatch');

if (denyMode) {
  assert.equal(callback.get('error'), 'access_denied', `denial run expected error=access_denied, got: ${callback.get('error') ?? 'none'}`);
  assert.ok(!callback.get('code'), 'denial run must not receive a code');
  console.log('PASS denial: callback carried error=access_denied, no code; no token exchange attempted');
  const unauth = await mcpCall(null, null, 'list_apps', {});
  assert.equal(unauth.status, 401, `unauthenticated list_apps expected HTTP 401, got ${unauth.status}`);
  console.log('PASS denial: unauthenticated list_apps returned HTTP 401 — no authenticated tool call is possible');
  console.log('DONE: denial reference flow passed.');
  process.exit(0);
}

const code = callback.get('code');
assert.ok(code, `approval run expected a code, got error: ${callback.get('error') ?? 'none'}`);
console.log('PASS callback: code received (value not printed), state matched');

// 5. Token exchange (public client, auth method "none")
const tokenRes = await fetch(discovery.token_endpoint, {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code', code, redirect_uri: redirectUri,
    code_verifier: verifier, client_id: client.client_id,
  }),
});
assert.equal(tokenRes.status, 200, `token exchange failed: HTTP ${tokenRes.status}`);
const token = await tokenRes.json();
assert.ok(token.access_token, 'token exchange returned no access_token');
console.log(`PASS token exchange: token received (value not printed), type=${token.token_type ?? 'unknown'}, expires_in=${token.expires_in ?? 'unknown'}`);

// 6. Authenticated MCP initialize + list_apps
async function mcpCall(accessToken, sessionId, name, args) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  const initOrCall = name === null;
  const res = await fetch(mcpUrl, {
    method: 'POST', headers,
    body: JSON.stringify(initOrCall
      ? { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'oauth-reference-flow', version: '0' } } }
      : { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: args } }),
  });
  const text = await res.text();
  let payload = null;
  for (const line of text.split(/\r?\n/)) {
    const data = line.startsWith('data:') ? line.slice(5).trim() : line.trim();
    if (!data) continue;
    try { const p = JSON.parse(data); if (p && ('result' in p || 'error' in p)) payload = p; } catch { /* keep scanning */ }
  }
  return { status: res.status, payload, sessionId: res.headers.get('mcp-session-id') ?? sessionId };
}

const init = await mcpCall(token.access_token, null, null, null);
assert.equal(init.status, 200, `MCP initialize failed: HTTP ${init.status}`);
const appsCall = await mcpCall(token.access_token, init.sessionId, 'list_apps', {});
assert.equal(appsCall.status, 200, `list_apps failed: HTTP ${appsCall.status}`);
const result = appsCall.payload?.result ?? {};
const structured = result.structuredContent
  ?? JSON.parse(result.content?.find((c) => c.type === 'text')?.text ?? '{}');
assert.equal(structured.ok, true, `list_apps not ok: ${structured.error_code ?? 'unknown'}`);
assert.equal(structured.apps?.length, 1, `owner must see exactly one app, got ${structured.apps?.length}`);
assert.equal(structured.apps[0].app_id, 'grocery-list');
assert.ok(!('instructions' in structured.apps[0]) && !('operations' in structured.apps[0]), 'list_apps leaked pack content');
console.log('PASS authenticated list_apps: ok=true, app_ids=[grocery-list] (summary only)');
console.log('DONE: approval reference flow passed.');
