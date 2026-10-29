// Browser glue for the consent page. Pinned supabase-js CDN ESM (plan D1);
// recorded in poc/README.md. All authorization logic lives in consent-core.mjs.
// Never renders or logs the authorization id, any code, or any token: all
// authorization-derived values are assigned via textContent only.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.78.0/+esm";
import { parseAuthorizationId, describeAuthorization, loadAuthorization, decideAuthorization } from "./consent-core.mjs";

window.__consentModuleLoaded = true;
const $ = (id) => document.getElementById(id);
const regions = ['consent-loading', 'consent-signin', 'consent-details', 'consent-deciding', 'consent-error'];
function show(id, message) {
  for (const r of regions) $(r).hidden = r !== id;
  if (id === 'consent-error' && message) $('consent-error').textContent = message;
}

const authorizationId = parseAuthorizationId(window.location.search);

async function main() {
  if (!authorizationId) {
    show('consent-error', 'This page was opened without an authorization request. Start the connection from your companion app.');
    return;
  }
  if (!window.LOOMSPAN_SUPABASE_URL || !window.LOOMSPAN_ANON_KEY
      || window.LOOMSPAN_ANON_KEY === '__LOOMSPAN_ANON_KEY__') {
    show('consent-error', 'This consent page is not configured yet. The public key has not been added to the deployed copy.');
    return;
  }
  let supabase;
  try {
    supabase = createClient(window.LOOMSPAN_SUPABASE_URL, window.LOOMSPAN_ANON_KEY);
  } catch {
    show('consent-error', 'The sign-in library could not be loaded. Check your connection and reload this page.');
    return;
  }

  async function loadDetails() {
    show('consent-loading');
    const result = await loadAuthorization(supabase, authorizationId);
    if (result.kind === 'redirect') { window.location.assign(result.redirectUrl); return; }
    if (result.kind === 'error') {
      if (/session missing/i.test(result.message)) { show('consent-signin'); return; }
      show('consent-error', result.message);
      return;
    }
    const info = describeAuthorization(result.details);
    $('client-name').textContent = info.clientName;
    const meta = [info.clientUri, info.redirectUri].filter(Boolean).join(' — ');
    $('client-meta').hidden = !meta;
    $('client-meta').textContent = meta;
    $('user-email').textContent = info.userEmail || 'Signed-in user';
    const list = $('scope-list');
    list.replaceChildren();
    if (info.scopes.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No specific scopes listed; approving grants this client access to your Loomspan data.';
      list.appendChild(li);
    }
    for (const scope of info.scopes) {
      const li = document.createElement('li');
      li.textContent = scope;
      list.appendChild(li);
    }
    $('approve-button').disabled = false;
    $('deny-button').disabled = false;
    show('consent-details');
  }

  $('signin-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorBox = $('signin-error');
    errorBox.hidden = true;
    $('signin-submit').disabled = true;
    // Form field names are the supabase-js credential keys (email/password).
    const credentials = Object.fromEntries(new FormData(event.currentTarget).entries());
    const { error } = await supabase.auth.signInWithPassword(credentials);
    $('signin-password').value = '';
    $('signin-submit').disabled = false;
    if (error) {
      errorBox.textContent = 'Sign-in failed. Check your email and password and try again.';
      errorBox.hidden = false;
      return;
    }
    await loadDetails();
  });

  for (const [buttonId, action] of [['approve-button', 'approve'], ['deny-button', 'deny']]) {
    $(buttonId).addEventListener('click', async () => {
      $('approve-button').disabled = true;
      $('deny-button').disabled = true;
      $('consent-deciding').hidden = false;
      const result = await decideAuthorization(supabase, authorizationId, action);
      if (result.kind === 'redirect') { window.location.assign(result.redirectUrl); return; }
      $('consent-deciding').hidden = true;
      $('approve-button').disabled = false;
      $('deny-button').disabled = false;
      const box = $('details-error');
      box.textContent = result.message;
      box.hidden = false;
    });
  }

  const { data } = await supabase.auth.getSession();
  if (data?.session) await loadDetails();
  else show('consent-signin');
}

main().catch(() => show('consent-error', 'The consent page could not be loaded. Reload this page or restart the connection from your companion app.'));
