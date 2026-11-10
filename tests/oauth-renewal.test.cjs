// Silent Google Drive reconnection on static hosting (oauth-redirect.js,
// oauth-callback.html and their use from cloud-drive.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const oauthSource = readFileSync(require.resolve('../oauth-redirect.js'), 'utf8');
const driveSource = readFileSync(require.resolve('../cloud-drive.js'), 'utf8');
const callbackHtml = readFileSync(require.resolve('../oauth-callback.html'), 'utf8');
const callbackSource = callbackHtml.match(/<script>([\s\S]*?)<\/script>/)[1];

const CLIENT_ID = 'test-public-client-id';
const ORIGIN = 'https://notes.example';
const A = {sub: '1111111111', email: 'a@example.test', name: 'Account A'};
const B = {sub: '2222222222', email: 'b@example.test', name: 'Account B'};
const ACCOUNT_KEY = 'winds-drive-last-account-v1';
const PERSIST_PREFIX = 'winds-drive-persistent-session-v1-';
const SESSION_KEY = 'winds-drive-session-v1';

function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {data, getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key)};
}
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };

/* ------------------------------------------------------------------ */
/* oauth-redirect.js                                                    */
/* ------------------------------------------------------------------ */
function oauthWindow({local = storage(), session = storage(), now = Date.now(), online = true, config = {},
  fetchImpl = async () => ({}), path = '/', autostart = false} = {}) {
  const navigations = [], listeners = new Map(), appended = [];
  const docEl = {classList: {set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }}, dataset: {}};
  const window = {
    WINDS_GOOGLE_CLIENT_ID: CLIENT_ID, WINDS_OAUTH_AUTOSTART: autostart, ...config,
    localStorage: local, sessionStorage: session,
    location: {href: ORIGIN + path, origin: ORIGIN, protocol: 'https:', hostname: 'notes.example', pathname: path, search: '',
      replace: url => navigations.push({replace: url}), assign: url => navigations.push({assign: url})},
    navigator: {onLine: online},
    document: {visibilityState: 'visible', head: {appendChild: el => appended.push(el)}, documentElement: docEl,
      createElement: () => ({style: {}}), body: null},
    crypto: {getRandomValues: bytes => { bytes.fill(7); return bytes; }},
    fetch: fetchImpl, AbortController,
    addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: () => {},
  };
  window.top = window; window.self = window;
  class Clock extends Date { static now() { return now; } }
  vm.runInNewContext(oauthSource, {window, globalThis: window, Date: Clock, URL, URLSearchParams, Uint8Array, setTimeout, clearTimeout, JSON, Math, Number, String, Array, Boolean, Object, Promise});
  return {window, oauth: window.WindsOAuth, navigations, local, session, docEl, listeners, advance: ms => { now += ms; }};
}
function rememberExpired(local, profile = A, expires = Date.now() - 1000) {
  local.setItem(ACCOUNT_KEY, JSON.stringify({clientId: CLIENT_ID, profile}));
  local.setItem(PERSIST_PREFIX + profile.sub, JSON.stringify({clientId: CLIENT_ID, profile, token: 'old-token', expires, logoutStamp: ''}));
}

test('authorization URLs use the registered callback, silent prompt, account hint and random state', () => {
  const {oauth} = oauthWindow({path: '/index.html'});
  const url = new URL(oauth.buildUrl({state: 'abc', hint: A.email, prompt: 'none'}));
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('client_id'), CLIENT_ID);
  assert.equal(url.searchParams.get('redirect_uri'), ORIGIN + '/oauth-callback.html');
  assert.equal(url.searchParams.get('response_type'), 'token');
  assert.equal(url.searchParams.get('prompt'), 'none');
  assert.equal(url.searchParams.get('login_hint'), A.email);
  assert.equal(url.searchParams.get('state'), 'abc');
  assert.match(url.searchParams.get('scope'), /drive\.file/);
});

test('top-level redirects stay off until the callback URL is verified, so Google error pages cannot strand users', () => {
  const local = storage();rememberExpired(local);
  const {oauth, navigations} = oauthWindow({local});
  assert.equal(oauth.enabled(), true);
  assert.equal(oauth.redirectReady(), false);
  assert.equal(oauth.launchCandidate(), null);
  assert.equal(oauth.begin({mode: 'silent', sub: A.sub}), false);
  assert.deepEqual(navigations, []);
  oauth.markVerified();
  assert.equal(oauth.redirectReady(), true);
  assert.equal(oauth.launchCandidate().sub, A.sub);
});

test('an explicitly configured same-origin callback is trusted; a foreign one is ignored', () => {
  assert.equal(oauthWindow({config: {WINDS_GOOGLE_REDIRECT_URI: ORIGIN + '/auth/back.html'}}).oauth.redirectReady(), true);
  const foreign = oauthWindow({config: {WINDS_GOOGLE_REDIRECT_URI: 'https://evil.example/cb.html'}}).oauth;
  assert.equal(foreign.redirectUri(), ORIGIN + '/oauth-callback.html');
  assert.equal(foreign.redirectReady(), false);
  assert.equal(oauthWindow({config: {WINDS_GOOGLE_AUTH_SERVER: true}}).oauth.enabled(), false, 'server mode keeps its refresh flow');
});

test('launch renewal runs only for an expired remembered account, once per few minutes, never after a silent failure', () => {
  const local = storage();
  const w = oauthWindow({local});w.oauth.markVerified();
  assert.equal(w.oauth.launchCandidate(), null, 'guest users never bounce');
  rememberExpired(local, A, Date.now() + 30 * 60000);
  assert.equal(w.oauth.launchCandidate(), null, 'valid token');
  rememberExpired(local, A, Date.now() + 60000);
  assert.equal(w.oauth.launchCandidate().sub, A.sub, 'renews shortly before expiry');
  assert.equal(w.oauth.begin({mode: 'silent', sub: A.sub, hint: A.email}), true);
  assert.match(w.navigations[0].replace, /prompt=none/);
  assert.equal(w.oauth.launchCandidate(), null, 'an unresolved bounce is not repeated');
  w.oauth.consume();
  assert.equal(w.oauth.launchCandidate(), null, 'rate limited');
  w.advance(4 * 60000);
  w.oauth.markVerified();
  assert.equal(w.oauth.launchCandidate().sub, A.sub);
  w.oauth.blockSilent(A.sub, 'interaction_required');
  assert.equal(w.oauth.launchCandidate(), null, 'blocked until the account signs in again');
  w.oauth.unblockSilent(A.sub);
  w.window.navigator.onLine = false;
  assert.equal(w.oauth.launchCandidate(), null, 'offline');
});

test('a logged-out or foreign-client account is not renewed at launch', () => {
  const local = storage();rememberExpired(local);
  const w = oauthWindow({local});w.oauth.markVerified();
  local.setItem(ACCOUNT_KEY, JSON.stringify({clientId: 'another-client', profile: A}));
  assert.equal(w.oauth.launchCandidate(), null);
  local.removeItem(ACCOUNT_KEY);
  assert.equal(w.oauth.launchCandidate(), null);
});

test('redirect results require the matching state and are consumed exactly once', () => {
  const w = oauthWindow();w.oauth.markVerified();
  w.oauth.begin({mode: 'silent', sub: A.sub, hint: A.email});
  const state = new URL(w.navigations[0].replace).searchParams.get('state');
  w.session.setItem(w.oauth.RESULT_KEY, JSON.stringify({type: 'winds-oauth', state, access_token: 'fresh', expires_in: '3599'}));
  assert.deepEqual({...w.oauth.consume()}, {mode: 'silent', sub: A.sub, token: 'fresh', expiresIn: 3599, scope: undefined});
  assert.equal(w.oauth.consume(), null, 'single use');
  w.oauth.begin({mode: 'silent', sub: A.sub});
  w.session.setItem(w.oauth.RESULT_KEY, JSON.stringify({state: 'forged', access_token: 'attacker'}));
  const forged = w.oauth.consume();
  assert.equal(forged.error, 'state_mismatch');assert.equal(forged.token, undefined);
});

test('a silent bounce that never returned disables redirects; an interactive Back does not', () => {
  const w = oauthWindow();w.oauth.markVerified();
  w.oauth.begin({mode: 'interactive', sub: null, prompt: 'select_account'});
  assert.equal(w.oauth.consume().error, 'no_response');
  assert.equal(w.oauth.redirectReady(), true);
  w.oauth.begin({mode: 'silent', sub: A.sub});
  assert.equal(w.oauth.consume().error, 'no_response');
  assert.equal(w.oauth.redirectReady(), false, 'probably an unregistered callback URL');
});

test('return paths stay on this origin', () => {
  const {oauth} = oauthWindow();
  assert.equal(oauth.safeReturnPath('/notes/?shared=abc'), '/notes/?shared=abc');
  for (const bad of ['//evil.example/', '/\\evil.example', 'https://evil.example/', 'javascript:alert(1)', '/a b'])
    assert.equal(oauth.safeReturnPath(bad), '', bad);
});

test('launch bounce shows a splash, checks connectivity and falls back to the app when Google is unreachable', async () => {
  const local = storage();rememberExpired(local);
  local.setItem('winds-oauth-redirect-verified-v1', JSON.stringify({key: `${CLIENT_ID} ${ORIGIN}/oauth-callback.html`, at: 1}));
  const offline = oauthWindow({local, autostart: true, fetchImpl: async () => { throw new Error('no network'); }});
  assert.equal(offline.docEl.classList.set.has('winds-auth-wait'), true);
  assert.equal(await offline.oauth.launching(), false);
  assert.equal(offline.docEl.classList.set.has('winds-auth-wait'), false);
  assert.deepEqual(offline.navigations, []);
  const local2 = storage();rememberExpired(local2);
  local2.setItem('winds-oauth-redirect-verified-v1', local.getItem('winds-oauth-redirect-verified-v1'));
  const online = oauthWindow({local: local2, autostart: true});
  assert.equal(await online.oauth.launching(), true);
  assert.match(online.navigations[0].replace, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?.*prompt=none/);
  assert.match(online.navigations[0].replace, /login_hint=a%40example\.test/);
});

/* ------------------------------------------------------------------ */
/* oauth-callback.html                                                  */
/* ------------------------------------------------------------------ */
function runCallback({hash, parent = null, pending = null}) {
  const session = storage(), local = storage(), navigations = [], posted = [], history = [];
  if (pending) local.setItem('winds-oauth-pending-v1', JSON.stringify(pending));
  const window = {};
  window.parent = parent ? {postMessage: (data, origin) => posted.push({data, origin})} : window;
  vm.runInNewContext(callbackSource, {window, location: {hash, search: '', pathname: '/oauth-callback.html', origin: ORIGIN,
    replace: url => navigations.push(url)}, history: {replaceState: (...args) => history.push(args)},
  sessionStorage: session, localStorage: local, URLSearchParams, JSON, String});
  return {session, local, navigations, posted, history};
}

test('the callback page stores the response for this tab, clears the token from history and returns to the notebook', () => {
  const r = runCallback({hash: '#state=s1&access_token=tok&expires_in=3599&token_type=Bearer', pending: {returnTo: '/?resume=1'}});
  assert.equal(r.history[0][2], '/oauth-callback.html');
  const saved = JSON.parse(r.session.getItem('winds-oauth-result-v1'));
  assert.equal(saved.state, 's1');assert.equal(saved.access_token, 'tok');
  assert.deepEqual(r.navigations, ['/?resume=1']);
  assert.deepEqual(runCallback({hash: '#error=access_denied', pending: {returnTo: '//evil.example'}}).navigations, ['./']);
});

test('inside the renewal iframe the callback page only messages its same-origin parent', () => {
  const r = runCallback({hash: '#state=s2&access_token=tok2&expires_in=100', parent: true});
  assert.equal(r.posted.length, 1);
  assert.equal(r.posted[0].origin, ORIGIN);
  assert.equal(r.posted[0].data.access_token, 'tok2');
  assert.deepEqual(r.navigations, []);
  assert.equal(r.session.getItem('winds-oauth-result-v1'), null);
});

/* ------------------------------------------------------------------ */
/* cloud-drive.js integration                                          */
/* ------------------------------------------------------------------ */
function driveApp({local = storage(), session = storage(), now = Date.now(), redirect = null, ready = false, iframe = null} = {}) {
  const elements = new Map(), timers = new Map(), requests = [], switches = [], calls = {iframe: [], begin: [], block: [], prepare: 0};
  let timerId = 0, drawing = false, account = null, oauthClient;
  const element = id => {
    if (!elements.has(id)) elements.set(id, {id, hidden: false, disabled: false, textContent: '', className: '', title: '',
      classList: {set: new Set(), toggle(c, on) { on ? this.set.add(c) : this.set.delete(c); }}, addEventListener() {}});
    return elements.get(id);
  };
  const WindsOAuth = {
    enabled: () => true, redirectReady: () => ready, verified: () => true, probeDue: () => false, noteProbe() {},
    consume: () => { const value = redirect; redirect = null; return value; },
    launching: async () => false, unblockSilent() {}, blockSilent: (sub, reason) => calls.block.push({sub, reason}),
    silentIframe: async options => { calls.iframe.push(options); return iframe ? iframe(options) : {error: 'login_required'}; },
    begin: options => { calls.begin.push(options); return true; }
  };
  class Clock extends Date { static now() { return now; } }
  const global = {
    WINDS_GOOGLE_CLIENT_ID: CLIENT_ID, sessionStorage: session, AbortController, WindsOAuth,
    location: {assign() {}}, navigator: {onLine: true}, addEventListener() {},
    google: {accounts: {oauth2: {initTokenClient(options) { oauthClient = {...options, requests: [], requestAccessToken(v) { this.requests.push(v); }}; return oauthClient; }}}}
  };
  const bridge = {
    async switchWorkspace(sub) { switches.push(sub); account = sub; },
    async mergeWorkspace() { return false; }, getData: () => ({format: 'winds-notes-backup', notebooks: []}),
    isWriting: () => drawing, isDrawingNow: () => drawing, isEditing: () => false, isSaving: () => false,
    syncIdleDelay: () => drawing ? 2500 : 0, toast() {},
    async prepareNavigation() { calls.prepare++; }
  };
  vm.runInNewContext(driveSource, {window: global, document: {getElementById: element, hidden: false, addEventListener() {}},
    localStorage: local, crypto: {randomUUID: () => 'device'}, Date: Clock, URLSearchParams, Headers, Blob, TextDecoder,
    console: {error() {}},
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, {callback, delay}); return id; },
    clearTimeout(id) { timers.delete(id); },
    async fetch(url, options) {
      const auth = options.headers.get?.('Authorization') || options.headers.Authorization;
      requests.push({url, auth});
      if (url.includes('/userinfo')) return {ok: true, json: async () => ({...(auth === 'Bearer token-b' ? B : A), email_verified: true})};
      return Response.json({files: []});
    }});
  return {global, local, session, element, timers, requests, switches, calls,
    init: () => global.WindsDrive.init(bridge), get account() { return account; }, get oauth() { return oauthClient; },
    setDrawing: value => { drawing = value; },
    runTimer: async delay => { const entry = [...timers].find(([, t]) => t.delay === delay); assert.ok(entry, 'timer ' + delay); timers.delete(entry[0]); return entry[1].callback(); }};
}
const connected = app => app.element('googleConnect').hidden === true;

test('a launch-time silent renewal reconnects the remembered account without any prompt', async () => {
  const local = storage();rememberExpired(local);
  const app = driveApp({local, redirect: {mode: 'silent', sub: A.sub, token: 'fresh', expiresIn: 3599}});
  await app.init();
  assert.deepEqual(app.switches, [A.sub]);
  assert.equal(connected(app), true);
  assert.equal(app.requests[0].auth, 'Bearer fresh', 'identity verified with the new token');
  assert.equal(JSON.parse(local.getItem(PERSIST_PREFIX + A.sub)).token, 'fresh');
  assert.equal(app.oauth, undefined, 'no Google popup was opened');
  assert.equal(app.element('syncChip').hidden, false);
  assert.notEqual(app.element('syncChipLabel').textContent, 'Resume sync');
});

test('a silent token for a different account is never applied to the remembered workspace', async () => {
  const local = storage();rememberExpired(local);
  const app = driveApp({local, redirect: {mode: 'silent', sub: B.sub, token: 'token-b', expiresIn: 3599}});
  await app.init();
  assert.deepEqual(app.switches, [A.sub]);
  assert.equal(connected(app), false);
  assert.ok(!app.requests.some(r => r.auth === 'Bearer token-b'));
  assert.equal(app.element('syncChipLabel').textContent, 'Resume sync');
});

test('an interactive redirect sign-in opens the chosen account like the popup flow', async () => {
  const local = storage();rememberExpired(local);
  const app = driveApp({local, redirect: {mode: 'interactive', sub: null, token: 'token-b', expiresIn: 3599}});
  await app.init();
  assert.deepEqual(app.switches, [B.sub]);
  assert.equal(connected(app), true);
  assert.equal(JSON.parse(app.session.getItem(SESSION_KEY)).profile.sub, B.sub);
});

test('a failed silent bounce stops further launch bounces for that account', async () => {
  const local = storage();rememberExpired(local);
  const app = driveApp({local, redirect: {mode: 'silent', sub: A.sub, error: 'interaction_required'}});
  await app.init();
  assert.deepEqual(app.calls.block, [{sub: A.sub, reason: 'interaction_required'}]);
  assert.equal(connected(app), false);
});

test('an expired session renews in a hidden frame once writing is idle', async () => {
  const local = storage();rememberExpired(local);
  const app = driveApp({local, iframe: () => ({token: 'renewed', expiresIn: 3600})});
  await app.init();
  assert.equal(connected(app), false);
  app.setDrawing(true);
  await app.runTimer(4000);
  assert.equal(app.calls.iframe.length, 0, 'no renewal work while the Pencil is down');
  app.setDrawing(false);
  await app.runTimer(1000); // Pencil-down recheck interval
  assert.deepEqual(app.calls.iframe.map(c => c.hint), [A.email]);
  assert.equal(connected(app), true);
  assert.equal(JSON.parse(local.getItem(PERSIST_PREFIX + A.sub)).token, 'renewed');
  assert.ok([...app.timers.values()].some(t => t.delay > 50 * 60000), 'next renewal is scheduled before the new expiry');
});

test('a hidden-frame token for another Google account is rejected', async () => {
  const local = storage();rememberExpired(local);
  const app = driveApp({local, iframe: () => ({token: 'token-b', expiresIn: 3600})});
  await app.init();await app.runTimer(4000);await flush();
  assert.equal(connected(app), false);
  assert.equal(app.element('syncChipLabel').textContent, 'Resume sync');
});

test('Resume sync reconnects in one tap: same-tab redirect when verified, otherwise the hinted popup', async () => {
  const local = storage();rememberExpired(local);
  const redirecting = driveApp({local, ready: true});
  await redirecting.init();
  redirecting.element('syncChip').onclick();await flush();
  assert.equal(redirecting.calls.prepare, 1, 'notes are saved before leaving the page');
  assert.deepEqual({...redirecting.calls.begin[0]}, {mode: 'interactive', sub: A.sub, hint: A.email, prompt: ''});
  const local2 = storage();rememberExpired(local2);
  const popup = driveApp({local: local2, ready: false});
  await popup.init();
  popup.element('syncChip').onclick();
  assert.equal(popup.oauth.requests[0].prompt, '');
  assert.equal(popup.oauth.requests[0].hint, A.sub);
  assert.equal(popup.calls.begin.length, 0);
});
