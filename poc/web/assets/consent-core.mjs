// Pure consent logic: no imports, no DOM, no network. Tested by
// poc/web/tests/consent-core.test.mjs. Never logs ids, codes, or tokens.

export function parseAuthorizationId(search) {
  if (typeof search !== 'string' || !search) return null;
  let value;
  try { value = new URLSearchParams(search).get('authorization_id'); } catch { return null; }
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function isRedirectOnly(details) {
  return Boolean(details && typeof details === 'object'
    && typeof details.redirect_url === 'string' && details.redirect_url
    && !details.authorization_id);
}

export function formatScopes(scope) {
  if (typeof scope !== 'string') return [];
  return scope.split(/\s+/).filter(Boolean);
}

export function describeAuthorization(details) {
  const d = details && typeof details === 'object' ? details : {};
  const client = d.client && typeof d.client === 'object' ? d.client : {};
  const user = d.user && typeof d.user === 'object' ? d.user : {};
  return {
    clientName: typeof client.name === 'string' && client.name.trim() ? client.name : 'Unknown client',
    clientUri: typeof client.uri === 'string' ? client.uri : '',
    redirectUri: typeof d.redirect_uri === 'string' ? d.redirect_uri : '',
    scopes: formatScopes(d.scope),
    userEmail: typeof user.email === 'string' ? user.email : '',
  };
}

export const MISSING_OAUTH_MESSAGE = 'The sign-in library does not support authorization requests. Reload this page, or restart the connection from your companion app.';

function oauthMethod(supabase, method) {
  const oauth = supabase?.auth?.oauth;
  if (!oauth || typeof oauth[method] !== 'function') return null;
  return oauth[method].bind(oauth);
}

function errorMessage(error) {
  if (error && typeof error.message === 'string' && error.message) return error.message;
  if (error && typeof error.name === 'string' && error.name) return error.name;
  return 'The authorization request could not be completed.';
}

export async function loadAuthorization(supabase, authorizationId) {
  const getAuthorizationDetails = oauthMethod(supabase, 'getAuthorizationDetails');
  if (!getAuthorizationDetails) return { kind: 'error', message: MISSING_OAUTH_MESSAGE };
  let result;
  try {
    result = await getAuthorizationDetails(authorizationId);
  } catch (err) {
    return { kind: 'error', message: errorMessage(err) };
  }
  if (result?.error || result?.data == null) return { kind: 'error', message: errorMessage(result?.error) };
  if (isRedirectOnly(result.data)) return { kind: 'redirect', redirectUrl: result.data.redirect_url };
  return { kind: 'details', details: result.data };
}

export async function decideAuthorization(supabase, authorizationId, action) {
  if (action !== 'approve' && action !== 'deny') {
    return { kind: 'error', message: 'Unknown consent action.' };
  }
  const method = oauthMethod(supabase, action === 'approve' ? 'approveAuthorization' : 'denyAuthorization');
  if (!method) return { kind: 'error', message: MISSING_OAUTH_MESSAGE };
  let result;
  try {
    result = await method(authorizationId);
  } catch (err) {
    return { kind: 'error', message: errorMessage(err) };
  }
  if (result?.error || result?.data == null) return { kind: 'error', message: errorMessage(result?.error) };
  if (typeof result.data.redirect_url === 'string' && result.data.redirect_url) {
    return { kind: 'redirect', redirectUrl: result.data.redirect_url };
  }
  return { kind: 'error', message: 'No redirect was returned for this decision.' };
}
