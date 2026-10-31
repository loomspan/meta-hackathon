import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAuthorizationId, isRedirectOnly, formatScopes,
  describeAuthorization, loadAuthorization, decideAuthorization,
  requestEmailCode, verifyEmailCode, signOut, MISSING_OTP_MESSAGE,
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

function stubOtp(impl) {
  const calls = [];
  const auth = { oauth: { getAuthorizationDetails: async () => { calls.push(['getAuthorizationDetails', []]); return { data: detailsData, error: null }; }, approveAuthorization: async () => { calls.push(['approveAuthorization', []]); return { data: {}, error: null }; }, denyAuthorization: async () => { calls.push(['denyAuthorization', []]); return { data: {}, error: null }; } } };
  for (const name of ['signInWithOtp', 'verifyOtp']) {
    if (impl[name]) auth[name] = async (...args) => { calls.push([name, args]); return impl[name](...args); };
  }
  return { supabase: { auth }, calls };
}

test('requestEmailCode sends trimmed email with shouldCreateUser', async () => {
  const { supabase, calls } = stubOtp({ signInWithOtp: async () => ({ data: {}, error: null }) });
  assert.deepEqual(await requestEmailCode(supabase, '  tester@example.invalid '), { kind: 'ok' });
  assert.deepEqual(calls, [['signInWithOtp', [{ email: 'tester@example.invalid', options: { shouldCreateUser: true } }]]]);
});

test('verifyEmailCode maps a wrong-code error without signing in', async () => {
  const { supabase, calls } = stubOtp({ verifyOtp: async () => ({ data: { session: null }, error: { name: 'AuthApiError', message: 'Token has expired or is invalid' } }) });
  const r = await verifyEmailCode(supabase, 'tester@example.invalid', '000000');
  assert.equal(r.kind, 'error');
  assert.ok(!r.message.includes('000000') && !r.message.includes('tester@example.invalid'));
  assert.deepEqual(calls, [['verifyOtp', [{ email: 'tester@example.invalid', token: '000000', type: 'email' }]]]);
});

test('verifyEmailCode expired, thrown, retry and resend', async () => {
  let attempts = 0;
  const { supabase, calls } = stubOtp({
    signInWithOtp: async () => ({ data: {}, error: null }),
    verifyOtp: async () => { attempts++; return attempts < 2 ? { data: null, error: { message: 'expired' } } : { data: { session: {} }, error: null }; },
  });
  assert.equal((await verifyEmailCode(supabase, 'tester@example.invalid', '111111')).kind, 'error');
  assert.equal((await verifyEmailCode(supabase, 'tester@example.invalid', '123456')).kind, 'ok');
  assert.deepEqual(await requestEmailCode(supabase, 'tester@example.invalid'), { kind: 'ok' });
  assert.equal(calls.filter((c) => c[0] === 'signInWithOtp').length, 1);
  assert.ok(!calls.some((c) => ['getAuthorizationDetails', 'approveAuthorization', 'denyAuthorization'].includes(c[0])));
  const thrown = stubOtp({ verifyOtp: async () => { throw new Error('network down'); } });
  assert.equal((await verifyEmailCode(thrown.supabase, 'tester@example.invalid', '123456')).kind, 'error');
});

test('missing OTP methods fail closed with friendly message', async () => {
  for (const supabase of [null, {}, { auth: {} }, { auth: { oauth: {} } }]) {
    for (const r of [await requestEmailCode(supabase, 'tester@example.invalid'), await verifyEmailCode(supabase, 'tester@example.invalid', '123456')]) {
      assert.equal(r.kind, 'error'); assert.equal(r.message, MISSING_OTP_MESSAGE);
      assert.ok(!/Cannot read properties/.test(r.message));
    }
  }
});

test('signOut calls auth.signOut once and maps errors without deciding authorization', async () => {
  const calls = [];
  const ok = { auth: { signOut: async () => { calls.push('signOut'); return { error: null }; }, oauth: { approveAuthorization: async () => { calls.push('approve'); return { data: {}, error: null }; }, denyAuthorization: async () => { calls.push('deny'); return { data: {}, error: null }; } } } };
  assert.deepEqual(await signOut(ok), { kind: 'ok' });
  assert.deepEqual(calls, ['signOut']);
  const failing = { auth: { signOut: async () => ({ error: { message: 'network down' } }) } };
  assert.equal((await signOut(failing)).kind, 'error');
  const thrown = { auth: { signOut: async () => { throw new Error('network down'); } } };
  assert.equal((await signOut(thrown)).kind, 'error');
  for (const supabase of [null, {}, { auth: {} }]) {
    const r = await signOut(supabase);
    assert.equal(r.kind, 'error'); assert.ok(!/Cannot read properties/.test(r.message));
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
