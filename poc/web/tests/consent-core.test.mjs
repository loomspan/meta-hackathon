import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAuthorizationId, isRedirectOnly, formatScopes,
  describeAuthorization, loadAuthorization, decideAuthorization,
} from '../assets/consent-core.mjs';

function stubOAuth(impl) {
  const calls = [];
  const oauth = {};
  for (const name of ['getAuthorizationDetails', 'approveAuthorization', 'denyAuthorization']) {
    oauth[name] = async (...args) => { calls.push([name, args]); return impl[name](...args); };
  }
  return { supabase: { auth: { oauth } }, calls };
}
const detailsData = {
  authorization_id: 'auth-1', redirect_uri: 'http://127.0.0.1:8765/callback',
  client: { id: 'c1', name: 'loomspan-poc-reference', uri: '', logo_uri: '' },
  user: { id: 'u1', email: 'poc-owner@example.invalid' }, scope: 'openid email profile',
};

test('loadAuthorization returns details with client and scopes for a fresh authorization', async () => {
  const { supabase, calls } = stubOAuth({ getAuthorizationDetails: async () => ({ data: detailsData, error: null }) });
  const r = await loadAuthorization(supabase, 'auth-1');
  assert.equal(r.kind, 'details');
  assert.deepEqual(calls, [['getAuthorizationDetails', ['auth-1']]]);
  const d = describeAuthorization(r.details);
  assert.equal(d.clientName, 'loomspan-poc-reference');
  assert.deepEqual(d.scopes, ['openid', 'email', 'profile']);
  assert.equal(d.userEmail, 'poc-owner@example.invalid');
  assert.equal(d.redirectUri, 'http://127.0.0.1:8765/callback');
});

test('loadAuthorization maps redirect-only (previously consented) to redirect', async () => {
  const url = 'http://127.0.0.1:8765/callback?code=REDACTED&state=REDACTED';
  const { supabase } = stubOAuth({ getAuthorizationDetails: async () => ({ data: { redirect_url: url }, error: null }) });
  const r = await loadAuthorization(supabase, 'auth-1');
  assert.deepEqual(r, { kind: 'redirect', redirectUrl: url });
});

test('loadAuthorization maps session-missing and other errors, and thrown exceptions', async () => {
  const a = stubOAuth({ getAuthorizationDetails: async () => ({ data: null, error: { name: 'AuthSessionMissingError', message: 'Auth session missing!' } }) });
  const r1 = await loadAuthorization(a.supabase, 'auth-1');
  assert.equal(r1.kind, 'error'); assert.match(r1.message, /session missing/i);
  assert.ok(!r1.message.includes('auth-1'));
  const b = stubOAuth({ getAuthorizationDetails: async () => { throw new Error('network down'); } });
  const r2 = await loadAuthorization(b.supabase, 'auth-1');
  assert.equal(r2.kind, 'error'); assert.match(r2.message, /network down/);
  const c = stubOAuth({ getAuthorizationDetails: async () => ({ data: null, error: null }) });
  const r3 = await loadAuthorization(c.supabase, 'auth-1');
  assert.equal(r3.kind, 'error'); assert.ok(r3.message.length > 0);
});

test('decideAuthorization dispatches approve and deny with exactly one argument', async () => {
  const url = 'http://127.0.0.1:8765/callback?code=REDACTED';
  const a = stubOAuth({ approveAuthorization: async () => ({ data: { redirect_url: url }, error: null }), denyAuthorization: async () => { throw new Error('deny must not be called'); } });
  assert.deepEqual(await decideAuthorization(a.supabase, 'auth-1', 'approve'), { kind: 'redirect', redirectUrl: url });
  assert.deepEqual(a.calls, [['approveAuthorization', ['auth-1']]]);

  const d = stubOAuth({ approveAuthorization: async () => { throw new Error('approve must not be called'); }, denyAuthorization: async () => ({ data: { redirect_url: 'http://127.0.0.1:8765/callback?error=access_denied' }, error: null }) });
  const rd = await decideAuthorization(d.supabase, 'auth-1', 'deny');
  assert.equal(rd.kind, 'redirect'); assert.match(rd.redirectUrl, /access_denied/);
  assert.deepEqual(d.calls, [['denyAuthorization', ['auth-1']]]);
});

test('decideAuthorization maps errors and rejects unknown actions without calling Supabase', async () => {
  const e = stubOAuth({ approveAuthorization: async () => ({ data: null, error: { name: 'AuthError', message: 'nope' } }), denyAuthorization: async () => ({ data: null, error: null }) });
  assert.equal((await decideAuthorization(e.supabase, 'auth-1', 'approve')).kind, 'error');
  const u = stubOAuth({ approveAuthorization: async () => ({ data: {}, error: null }), denyAuthorization: async () => ({ data: {}, error: null }) });
  const r = await decideAuthorization(u.supabase, 'auth-1', 'maybe');
  assert.equal(r.kind, 'error'); assert.deepEqual(u.calls, []);
});

test('missing auth.oauth namespace fails closed with a friendly, non-raw message', async () => {
  // Regression for the live failure where a pinned client without the OAuth
  // API surfaced "Cannot read properties of undefined (reading
  // 'getAuthorizationDetails')" to the user.
  for (const supabase of [null, {}, { auth: {} }, { auth: { oauth: {} } }, { auth: { oauth: { getAuthorizationDetails: undefined } } }]) {
    const r = await loadAuthorization(supabase, 'auth-1');
    assert.equal(r.kind, 'error');
    assert.ok(r.message.length > 0);
    assert.ok(!/Cannot read properties/.test(r.message), `raw TypeError leaked: ${r.message}`);
    assert.ok(!/getAuthorizationDetails/.test(r.message), `raw TypeError leaked: ${r.message}`);
  }
  for (const supabase of [{ auth: {} }, { auth: { oauth: {} } }]) {
    for (const action of ['approve', 'deny']) {
      const r = await decideAuthorization(supabase, 'auth-1', action);
      assert.equal(r.kind, 'error');
      assert.ok(!/Cannot read properties/.test(r.message), `raw TypeError leaked: ${r.message}`);
    }
  }
});

test('parseAuthorizationId, formatScopes, isRedirectOnly, describeAuthorization edge cases', () => {
  assert.equal(parseAuthorizationId('?authorization_id=abc-123&other=1'), 'abc-123');
  assert.equal(parseAuthorizationId('?other=1'), null);
  assert.equal(parseAuthorizationId(''), null);
  assert.equal(parseAuthorizationId('?authorization_id='), null);
  assert.equal(parseAuthorizationId('?authorization_id=%20%20'), null);
  assert.equal(parseAuthorizationId('?authorization_id=first&authorization_id=second'), 'first');
  assert.equal(parseAuthorizationId(null), null);
  assert.deepEqual(formatScopes('openid email profile'), ['openid', 'email', 'profile']);
  assert.deepEqual(formatScopes('email'), ['email']);
  assert.deepEqual(formatScopes(''), []); assert.deepEqual(formatScopes(undefined), []);
  assert.deepEqual(formatScopes('  openid   email '), ['openid', 'email']);
  assert.equal(isRedirectOnly({ redirect_url: 'https://x/' }), true);
  assert.equal(isRedirectOnly({ redirect_url: 'https://x/', authorization_id: 'a' }), false);
  assert.equal(isRedirectOnly(null), false); assert.equal(isRedirectOnly({}), false);
  assert.deepEqual(describeAuthorization({}), { clientName: 'Unknown client', clientUri: '', redirectUri: '', scopes: [], userEmail: '' });
  assert.deepEqual(describeAuthorization(null), { clientName: 'Unknown client', clientUri: '', redirectUri: '', scopes: [], userEmail: '' });
});
