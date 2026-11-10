const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(require.resolve('../cloud-drive.js'), 'utf8');
const SESSION_KEY = 'winds-drive-session-v1';
const ACCOUNT_KEY = 'winds-drive-last-account-v1';
const PERSIST_PREFIX = 'winds-drive-persistent-session-v1-';
const LOGOUT_PREFIX = 'winds-drive-logout-v1-';
const CLIENT_ID = 'test-public-client-id';
const A = {sub: '1111111111', email: 'a@example.test', name: 'Account A'};
const B = {sub: '2222222222', email: 'b@example.test', name: 'Account B'};

function storage() {
  const data = new Map();
  return {getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key)};
}

function channels() {
  const clients = new Set();
  return class BroadcastChannel {
    constructor(name) { this.name = name; clients.add(this); }
    postMessage(data) {
      for (const peer of clients) if (peer !== this && peer.name === this.name) {
        queueMicrotask(() => peer.onmessage?.({data: structuredClone(data)}));
      }
    }
    close() { clients.delete(this); }
  };
}

async function flushMessages() {
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

function workspace(title='Physics') {
  return {format:'winds-notes-backup',version:2,deleted:{},notebooks:[{
    id:'notebook-a',title,updatedAt:'2026-11-04T10:00:00.000Z',pages:[{
      id:'page-a',items:[{id:'stroke-a',type:'stroke',tool:'pen',color:'#123456',size:3,points:[[10,10,.5],[30,30,.8]]}]
    }]
  }]};
}

function fakeDrive() {
  let data=null,revision=0,fileId='workspace-file';
  const uploads=[];
  const metadata=()=>({id:fileId,name:'WiNDS Notes Workspace.json',
    modifiedTime:new Date(Date.UTC(2026,10,4,10,0,revision)).toISOString(),appProperties:{windsNotesWorkspace:'1'}});
  return {uploads,
    replace(value,id=fileId){data=structuredClone(value);fileId=id;revision++;},
    async fetch(url,options){
      if(url.includes('/upload/')){
        const multipart=await options.body.text();
        data=JSON.parse(multipart.split('\r\n\r\n')[2].split('\r\n--')[0]);
        uploads.push(structuredClone(data));revision++;
        return Response.json(metadata());
      }
      if(url.includes('alt=media'))return Response.json(data);
      if(new URL(url).pathname.endsWith('/'+fileId))return Response.json(metadata());
      if(new URL(url).pathname!=='/drive/v3/files')return Response.json({error:{message:'File not found'}},{status:404});
      return Response.json({files:data?[metadata()]:[]});
    }
  };
}

function browser({sessionStorage = storage(), localStorage = storage(), now = Date.now(),
  offline = false, identity = null, driveStatus = 200, BroadcastChannel, profileGate, server = false, serverProvider,
  driveProvider, getData, mergeWorkspace, scheduler, sharing, activeBookId} = {}) {
  if(scheduler)now=scheduler.now;
  const elements = new Map(), requests = [], switches = [], merges = [], timers = new Map(), navigations = [],uiWrites=[],requestSignals=[];
  const listeners = new Map();
  const workspaces = new Map([[null, ['guest']], [A.sub, ['A notes']], [B.sub, ['B notes']]]);
  let oauth, account = null, timerId = 0, drawing = false, saving = false, editing = false, waitForIdle = 0, snapshotReads = 0;
  const errors=[];
  const element = id => {
    if (!elements.has(id)) elements.set(id, new Proxy({hidden: false, disabled: false, textContent: '',
      classList: {toggle() {}}, addEventListener() {}},{set(target,key,value){uiWrites.push({id,key,value});target[key]=value;return true;}}));
    return elements.get(id);
  };
  class Clock extends Date { static now() { return scheduler?scheduler.now:now; } }
  const global = {
    WINDS_GOOGLE_CLIENT_ID: CLIENT_ID, sessionStorage, BroadcastChannel,AbortController,WindsSharing:sharing,
    WINDS_GOOGLE_AUTH_SERVER: server, location: {assign: value => navigations.push(value)},
    navigator: {onLine: !offline},
    addEventListener(type, callback) { listeners.set(type, callback); },
    google: {accounts: {oauth2: {
      initTokenClient(options) {
        oauth = {...options, requests: [], requestAccessToken(value) { this.requests.push(value); }};
        return oauth;
      },
      revoke(token, callback) { global.revoked = token; callback(); }
    }}}
  };
  const bridge = {
    sharing:sharing?{activeId:()=>activeBookId}:undefined,
    async switchWorkspace(sub) { switches.push(sub); account = sub; },
    async mergeWorkspace(data) { merges.push({account, data}); return mergeWorkspace?.(data); },
    getData: () => { snapshotReads++; return getData?getData():{format: 'winds-notes-backup', notebooks: []}; },
    isWriting: () => drawing || editing || waitForIdle > 0, isDrawingNow: () => drawing,
    isEditing: () => editing, isSaving: () => saving,
    syncIdleDelay: () => drawing || editing ? 2500 : saving ? 1000 : waitForIdle,
    toast() {}
  };
  const document = {getElementById: element, hidden: false, addEventListener: (type,callback)=>listeners.set(type,callback)};
  vm.runInNewContext(source, {window: global, document,
    localStorage, crypto: {randomUUID: () => 'test-device'}, Date: Clock, URLSearchParams,
    Headers, Blob, TextDecoder, console: {error(...args) { errors.push(args); }},
    setTimeout(callback, delay) {
      const id=++timerId,task={callback,delay};timers.set(id,task);
      if(scheduler)task.handle=scheduler.setTimeout(()=>{timers.delete(id);return callback();},delay);
      return id;
    },
    clearTimeout(id) {const task=timers.get(id);if(task&&scheduler)scheduler.clearTimeout(task.handle);timers.delete(id);},
    async fetch(url, options) {
      requestSignals.push(options.signal);
      requests.push({url, account, authorization: options.headers.get?.('Authorization') || options.headers.Authorization});
      if (offline) throw new Error('Offline');
      if (url.startsWith('/auth/google/')) {
        if (serverProvider) return serverProvider(url, options, now);
        return {ok: true, json: async () => ({profile: A, access_token: 'token-a', expires: now + 3600000})};
      }
      if (url.includes('/userinfo')) {
        if (profileGate) await profileGate;
        return {ok: true, json: async () => ({
          ...(identity || (options.headers.Authorization === 'Bearer token-b' ? B : A)), email_verified: true})};
      }
      if(driveProvider)return driveProvider(url,options);
      return Response.json({files: [], error: {message: 'Drive unavailable'}},{status:driveStatus});
    }
  });
  return {
    global, sessionStorage, localStorage, requests, switches, merges, elements, timers, navigations, errors,uiWrites,requestSignals,
    init: () => global.WindsDrive.init(bridge), element,
    get account() { return account; }, get notes() { return workspaces.get(account); },
    get oauth() { return oauth; },
    get saved() { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); },
    get persistent() { return JSON.parse(localStorage.getItem(PERSIST_PREFIX + account)); },
    get snapshotReads() { return snapshotReads; },
    storageEvent: key => listeners.get('storage')?.({key}),
    setDrawing: value => { drawing = value; },
    setOffline: value => { offline = value; global.navigator.onLine = !value; },
    setSaving: value => { saving = value; },
    setEditing: value => { editing = value; },
    setIdleDelay: value => { waitForIdle = value; },
    setHidden: value => { document.hidden = value; },
    emit: type => listeners.get(type)?.(),
    async runTimer(delay) {
      const entry = [...timers].find(([,timer])=>timer.delay === delay);
      assert.ok(entry, 'expected a timer with delay '+delay);
      timers.delete(entry[0]); return entry[1].callback();
    },
    tick: value => { now += value; },
    async signIn(token = 'token-a', switchAccount = false) {
      element(switchAccount ? 'googleSwitchAccount' : 'googleConnect').onclick();
      await oauth.callback({access_token: token, expires_in: 3600});
    }
  };
}

test('refresh restores the same account, verifies the token and waits for idle before Drive sync', async () => {
  const first = browser(); await first.init(); await first.signIn();
  assert.deepEqual(first.switches, [A.sub]);
  assert.equal(first.saved.token, 'token-a');
  assert.equal(first.localStorage.getItem(SESSION_KEY), null);
  const refreshed = browser({sessionStorage: first.sessionStorage}); await refreshed.init();
  assert.deepEqual(refreshed.notes, ['A notes']);
  assert.deepEqual(refreshed.switches, [A.sub]);
  assert.equal(refreshed.element('googleConnect').hidden, true);
  assert.equal(refreshed.requests.length, 1);
  assert.match(refreshed.requests[0].url, /userinfo$/);
  refreshed.setDrawing(true);
  await [...refreshed.timers.values()].find(timer => timer.delay === 0).callback();
  assert.equal(refreshed.requests.length, 1, 'no Drive work while the user is writing');
  assert.ok([...refreshed.timers.values()].some(timer => timer.delay === 1000));
});

test('expired sessions retain the account notes and offer a hinted reconnect instead of opening guest notes', async () => {
  const first = browser(); await first.init(); await first.signIn();
  const refreshed = browser({sessionStorage: first.sessionStorage, now: Date.now() + 3600001});
  await refreshed.init();
  assert.deepEqual(refreshed.notes, ['A notes']);
  assert.equal(refreshed.requests.length, 0);
  assert.equal(refreshed.saved.token, null);
  assert.equal(refreshed.element('googleConnect').textContent, 'Reconnect Google Drive');
  assert.equal(refreshed.element('googleDisconnect').hidden, false);
  refreshed.element('googleConnect').onclick();
  assert.equal(refreshed.oauth.requests[0].hint, A.sub);
  assert.equal(refreshed.oauth.requests[0].prompt, '');
  await refreshed.oauth.callback({error: 'access_denied'});
  assert.deepEqual(refreshed.notes, ['A notes']);
  refreshed.element('googleSwitchAccount').onclick();
  assert.equal(refreshed.oauth.requests[1].prompt, 'select_account');
});

test('offline refresh and failed reconnect preserve local account data', async () => {
  const first = browser(); await first.init(); await first.signIn();
  const refreshed = browser({sessionStorage: first.sessionStorage, offline: true});
  await refreshed.init();
  assert.deepEqual(refreshed.notes, ['A notes']);
  assert.match(refreshed.element('cloudConnectionText').textContent, /authorization needed/);
  await refreshed.signIn();
  assert.equal(refreshed.saved.profile.sub, A.sub);
  assert.deepEqual(refreshed.notes, ['A notes']);
  assert.ok(!refreshed.switches.includes(null));
});

test('a mismatched cached token cannot sync another account into the remembered workspace', async () => {
  const first = browser(); await first.init(); await first.signIn();
  const refreshed = browser({sessionStorage: first.sessionStorage, identity: B});
  await refreshed.init();
  assert.deepEqual(refreshed.notes, ['A notes']);
  assert.equal(refreshed.saved.token, null);
  assert.equal(refreshed.requests.length, 1);
  assert.equal(refreshed.merges.length, 0);
  assert.equal(refreshed.element('googleSync').hidden, true);
  await refreshed.signIn('token-b', true);
  assert.equal(refreshed.saved.profile.sub, B.sub);
  assert.deepEqual(refreshed.notes, ['B notes']);
  const drive = refreshed.requests.filter(request => request.url.includes('/drive/'));
  assert.ok(drive.length > 0);
  assert.ok(drive.every(request => request.account === B.sub && request.authorization === 'Bearer token-b'));
});

test('Drive service failures do not discard a successfully verified account session', async () => {
  const app = browser({driveStatus: 503}); await app.init(); await app.signIn();
  assert.deepEqual(app.notes, ['A notes']);
  assert.equal(app.saved.profile.sub, A.sub);
  assert.equal(app.element('googleConnect').hidden, true);
  assert.match(app.element('cloudMessage').textContent, /503/);
});

test('Drive rejection clears only authorization, keeping account notes available for reconnect', async () => {
  const app = browser({driveStatus: 401}); await app.init(); await app.signIn();
  assert.deepEqual(app.notes, ['A notes']);
  assert.equal(app.saved.token, null);
  assert.equal(app.element('googleConnect').textContent, 'Reconnect Google Drive');
  assert.equal(app.element('googleSync').hidden, true);
});

test('explicit sign-out clears tab recovery and returns to the separate guest workspace', async () => {
  const first = browser(); await first.init(); await first.signIn();
  await first.element('googleDisconnect').onclick();
  assert.equal(first.saved, null);
  assert.equal(first.global.revoked, 'token-a');
  assert.deepEqual(first.notes, ['guest']);
  const refreshed = browser({sessionStorage: first.sessionStorage}); await refreshed.init();
  assert.equal(refreshed.requests.length, 0);
  assert.equal(refreshed.account, null);
  const newTab = browser(); await newTab.init();
  assert.equal(newTab.account, null);
});

test('auto-sync preference survives refresh and expiry updates the reconnect state', async () => {
  const first = browser(); await first.init(); await first.signIn();
  first.localStorage.setItem(`winds-drive-auto-${A.sub}`, 'false');
  const refreshed = browser({sessionStorage: first.sessionStorage, localStorage: first.localStorage});
  await refreshed.init();
  assert.equal(refreshed.element('cloudAutoBackup').checked, false);
  const expiry = [...refreshed.timers.values()].find(timer => timer.delay > 3000000);
  refreshed.tick(3600001); expiry.callback();
  // The library account button turns into a one-tap reconnect for the same account.
  assert.equal(refreshed.element('cloudEntryLabel').textContent, 'Resume Drive sync');
  assert.equal(refreshed.element('syncChipLabel').textContent, 'Resume sync');
  assert.equal(refreshed.element('googleSync').hidden, true);
  assert.deepEqual(refreshed.notes, ['A notes']);
});

test('invalid, foreign-client or unavailable session storage falls back safely to guest', async () => {
  for (const value of ['invalid json', JSON.stringify({profile: A}), JSON.stringify({
    clientId: 'another-client', profile: A, token: 'token-a', expires: Date.now() + 3600000})]) {
    const saved = storage(); saved.setItem(SESSION_KEY, value);
    const app = browser({sessionStorage: saved}); await app.init();
    assert.equal(app.account, null); assert.equal(app.requests.length, 0);
    assert.equal(saved.getItem(SESSION_KEY), null);
  }
  const blocked = {getItem() { throw new Error('Storage blocked'); },
    setItem() { throw new Error('Storage blocked'); }, removeItem() { throw new Error('Storage blocked'); }};
  const app = browser({sessionStorage: blocked}); await app.init(); await app.signIn();
  assert.deepEqual(app.notes, ['A notes']);
  assert.equal(app.element('googleConnect').hidden, true);
});

test('a fresh tab reuses an open account connection without asking Google to log in again', async () => {
  const BroadcastChannel = channels();
  const first = browser({BroadcastChannel}); await first.init(); await first.signIn();
  first.setDrawing(true);
  const second = browser({BroadcastChannel, localStorage: first.localStorage});
  await second.init();
  assert.deepEqual(second.notes, ['A notes']);
  assert.equal(second.saved.token, 'token-a');
  assert.equal(second.element('googleConnect').hidden, true);
  assert.equal(second.oauth, undefined, 'no authorization popup or token request');
  assert.equal(second.requests.length, 1, 'verify identity before allowing Drive sync');
  assert.match(second.requests[0].url, /userinfo$/);
  assert.equal(first.requests.length, 2, 'answering a peer performs no network or storage work');
  const remembered = JSON.parse(first.localStorage.getItem(ACCOUNT_KEY));
  assert.equal(remembered.profile.sub, A.sub);
  assert.equal(remembered.token, undefined);
  assert.equal(first.localStorage.getItem(SESSION_KEY), null);
});

test('closing every tab and reopening restores Drive without another login', async () => {
  const first = browser(); await first.init(); await first.signIn();
  const reopened = browser({localStorage: first.localStorage}); await reopened.init();
  assert.deepEqual(reopened.notes, ['A notes']);
  assert.equal(reopened.saved.token, 'token-a');
  assert.equal(reopened.requests.length, 1);
  assert.equal(reopened.oauth, undefined);
  assert.equal(reopened.element('googleConnect').hidden, true);
  assert.equal(reopened.persistent.expires, first.persistent.expires, 'reopening never extends Google token expiry');
});

test('browser restart with an expired credential retains the workspace without using an expired token', async () => {
  const first = browser(); await first.init(); await first.signIn();
  const reopened = browser({localStorage: first.localStorage, now: Date.now() + 3600001});
  await reopened.init();
  assert.deepEqual(reopened.notes, ['A notes']);
  assert.equal(reopened.saved.token, null);
  assert.equal(reopened.requests.length, 0);
});

test('logout removes durable credentials and invalidates a suspended tab even without a channel', async () => {
  const first = browser(); await first.init(); await first.signIn();
  const suspended = storage(); suspended.setItem(SESSION_KEY, JSON.stringify(first.saved));
  const peer = browser({localStorage: first.localStorage}); await peer.init(); peer.setDrawing(true);
  await first.element('googleDisconnect').onclick();
  assert.equal(first.localStorage.getItem(PERSIST_PREFIX + A.sub), null);
  peer.storageEvent(LOGOUT_PREFIX + A.sub);
  assert.equal(peer.saved, null);
  assert.deepEqual(peer.switches, [A.sub]);
  const reopened = browser({sessionStorage: suspended, localStorage: first.localStorage}); await reopened.init();
  assert.equal(reopened.account, null);
  assert.equal(reopened.requests.length, 0);
});

test('a temporary offline reopen does not discard a valid durable credential', async () => {
  const first = browser(); await first.init(); await first.signIn();
  const offline = browser({localStorage: first.localStorage, offline: true}); await offline.init();
  assert.deepEqual(offline.notes, ['A notes']);
  assert.equal(offline.persistent.token, 'token-a');
  const online = browser({localStorage: first.localStorage}); await online.init();
  assert.equal(online.element('googleConnect').hidden, true);
  assert.equal(online.oauth, undefined);
});

test('different account tabs stay isolated and new tabs follow the last explicitly selected account', async () => {
  const BroadcastChannel = channels();
  const first = browser({BroadcastChannel}); await first.init(); await first.signIn();
  const second = browser({BroadcastChannel, localStorage: first.localStorage}); await second.init();
  await second.signIn('token-b', true);
  assert.deepEqual(first.notes, ['A notes']);
  assert.deepEqual(second.notes, ['B notes']);
  const refreshedA = browser({BroadcastChannel, localStorage: first.localStorage, sessionStorage: first.sessionStorage});
  await refreshedA.init();
  assert.deepEqual(refreshedA.notes, ['A notes']);
  assert.equal(JSON.parse(first.localStorage.getItem(ACCOUNT_KEY)).profile.sub, B.sub);
  const third = browser({BroadcastChannel, localStorage: first.localStorage}); await third.init();
  assert.deepEqual(third.notes, ['B notes']);
  assert.equal(third.saved.token, 'token-b');
  assert.deepEqual(third.switches, [B.sub]);
  await first.element('googleDisconnect').onclick(); await flushMessages();
  assert.equal(third.element('googleConnect').hidden, true, 'signing out A leaves B authorized');
  assert.equal(refreshedA.saved, null, 'other A tabs discard their tab credentials');
  assert.equal(JSON.parse(first.localStorage.getItem(ACCOUNT_KEY)).profile.sub, B.sub);
});

test('sign-out invalidates peer tabs without interrupting a stroke or restoring stale credentials', async () => {
  const BroadcastChannel = channels();
  const first = browser({BroadcastChannel}); await first.init(); await first.signIn();
  const second = browser({BroadcastChannel, localStorage: first.localStorage}); await second.init();
  second.setDrawing(true);
  await first.element('googleDisconnect').onclick(); await flushMessages();
  assert.deepEqual(second.notes, ['A notes']);
  assert.deepEqual(second.switches, [A.sub], 'no save or workspace switch while writing');
  assert.equal(second.saved, null);
  assert.equal(second.element('googleSync').hidden, true);
  assert.match(second.element('cloudMessage').textContent, /Signed out in another tab/);
  const third = browser({BroadcastChannel, localStorage: first.localStorage}); await third.init();
  assert.equal(third.account, null);
  assert.equal(third.requests.length, 0);
});

test('sign-out during peer token verification cannot resurrect authorization', async () => {
  const BroadcastChannel = channels();
  const first = browser({BroadcastChannel}); await first.init(); await first.signIn();
  let release;
  const profileGate = new Promise(resolve => { release = resolve; });
  const second = browser({BroadcastChannel, localStorage: first.localStorage, profileGate});
  const initializing = second.init(); await flushMessages();
  assert.equal(second.requests.length, 1);
  await first.element('googleDisconnect').onclick(); await flushMessages();
  release(); await initializing;
  assert.equal(second.saved, null);
  assert.equal(second.element('googleSync').hidden, true);
});

test('unavailable peers time out and never borrow a different account connection', async () => {
  const BroadcastChannel = channels();
  const first = browser({BroadcastChannel}); await first.init(); await first.signIn();
  const shared = storage();
  shared.setItem(ACCOUNT_KEY, JSON.stringify({clientId: CLIENT_ID, profile: B}));
  const second = browser({BroadcastChannel, localStorage: shared});
  const initializing = second.init(); await flushMessages();
  [...second.timers.values()].find(timer => timer.delay === 750).callback();
  await initializing;
  assert.deepEqual(second.notes, ['B notes']);
  assert.equal(second.saved.token, null);
  assert.equal(second.requests.length, 0);
  assert.equal(second.element('googleConnect').hidden, false);
});

test('server-backed login reopens after expiry without an authorization popup or local refresh token', async () => {
  const first = browser({server: true}); await first.init();
  assert.deepEqual(first.notes, ['A notes']);
  assert.equal(first.oauth, undefined);
  assert.equal(first.element('googleConnect').hidden, true);
  assert.equal(first.persistent.token, null);
  const reopened = browser({server: true, localStorage: first.localStorage, now: Date.now() + 7200000});
  await reopened.init();
  assert.deepEqual(reopened.notes, ['A notes']);
  assert.equal(reopened.element('googleConnect').hidden, true);
  assert.equal(reopened.oauth, undefined);
  assert.equal(reopened.requests.length, 1);
  assert.match(reopened.requests[0].url, /^\/auth\/google\/session/);
});

test('automatic server renewal waits until writing is idle and keeps the same account store', async () => {
  const app = browser({server: true}); await app.init();
  const renew = [...app.timers.values()].find(timer => timer.delay > 3500000 && timer.delay < 3550000);
  assert.ok(renew);
  app.tick(3540001); app.setDrawing(true); await renew.callback();
  assert.equal(app.requests.length, 1);
  app.setDrawing(false);
  await [...app.timers.values()].find(timer => timer.delay === 1000).callback();
  assert.equal(app.requests.length, 2);
  assert.deepEqual(app.switches, [A.sub]);
  assert.equal(app.element('googleConnect').hidden, true);
});

test('offline server logout is completed before an old cookie can restore the account', async () => {
  let active = true;
  const serverProvider = async (url, options, now) => {
    if (url.endsWith('/logout')) { active = false; return {ok: true}; }
    return active ? {ok: true, json: async () => ({profile: A, access_token: 'token-a', expires: now + 3600000})} : {ok: false, status: 401};
  };
  const first = browser({server: true, serverProvider}); await first.init(); first.setOffline(true);
  await first.element('googleDisconnect').onclick();
  assert.equal(first.account, null);
  assert.equal(active, true);
  const reopened = browser({server: true, serverProvider, localStorage: first.localStorage}); await reopened.init();
  assert.equal(active, false);
  assert.equal(reopened.account, null);
  assert.match(reopened.requests[0].url, /logout$/);
  assert.match(reopened.requests[1].url, /session$/);
  assert.equal(reopened.element('googleConnect').hidden, false);
});

test('a server outage keeps the remembered account and retries without asking the user to log in', async () => {
  const first = browser({server: true}); await first.init();
  const offline = browser({server: true, localStorage: first.localStorage, offline: true}); await offline.init();
  assert.deepEqual(offline.notes, ['A notes']);
  assert.equal(offline.element('cloudEntryLabel').textContent, A.email);
  assert.equal(offline.element('googleConnect').hidden, true);
  offline.setOffline(false);
  await [...offline.timers.values()].find(timer => timer.delay === 45000).callback();
  assert.equal(offline.element('googleSync').hidden, false);
  assert.equal(offline.oauth, undefined);
});

test('startup server recovery waits instead of switching workspaces during writing', async () => {
  const app = browser({server: true}); app.setDrawing(true); await app.init();
  assert.equal(app.account, null);
  assert.deepEqual(app.switches, []);
  app.setDrawing(false);
  await [...app.timers.values()].find(timer => timer.delay === 1000).callback();
  assert.deepEqual(app.notes, ['A notes']);
  assert.equal(app.element('googleConnect').hidden, true);
});

test('logout wins over a delayed server response even before the new tab knows the account', async () => {
  const first = browser({server: true}); await first.init();
  first.localStorage.removeItem(ACCOUNT_KEY);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const unknown = browser({server: true, localStorage: first.localStorage,
    serverProvider: async (url, options, now) => {
      await gate; return {ok: true, json: async () => ({profile: A, access_token: 'token-a', expires: now + 3600000})};
    }});
  const initializing = unknown.init(); await flushMessages();
  await first.element('googleDisconnect').onclick(); release(); await initializing;
  assert.equal(unknown.account, null);
  assert.equal(unknown.saved, null);
  assert.equal(unknown.element('googleConnect').hidden, false);
});

test('automatic sync uploads saved edits after the remaining idle delay without manual action', async () => {
  const drive=fakeDrive(),app=browser({server:true,driveProvider:drive.fetch,getData:()=>workspace()});
  await app.init();assert.equal(app.element('cloudAutoBackup').checked,true);
  app.setIdleDelay(7000);app.global.WindsDrive.onLocalSave();
  await app.runTimer(0);
  assert.equal(app.snapshotReads,0);assert.equal(drive.uploads.length,0);
  app.tick(7000);app.setIdleDelay(0);await app.runTimer(7000);
  assert.equal(drive.uploads.length,1);
  assert.equal(drive.uploads[0].notebooks[0].pages[0].items.length,1);
  assert.match(app.element('cloudMessage').textContent,/synced automatically/);
});

test('automatic synchronization waits for local saving and active text editing', async () => {
  const drive=fakeDrive(),app=browser({server:true,driveProvider:drive.fetch,getData:()=>workspace()});
  await app.init();app.setSaving(true);await app.runTimer(0);
  assert.equal(app.requests.length,1);assert.equal(app.snapshotReads,0);
  app.setSaving(false);app.setEditing(true);await app.runTimer(1000);
  assert.equal(app.requests.length,1);
  app.setEditing(false);await app.runTimer(1000);
  assert.equal(drive.uploads.length,1);
});

test('a delayed Drive response cannot trigger parsing, merging or uploading after writing resumes', async () => {
  let release,bodyReads=0;
  const gate=new Promise(resolve=>{release=resolve;}),drive=fakeDrive();
  let delayed=true;
  const app=browser({server:true,getData:()=>workspace(),driveProvider:async(url,options)=>{
    if(delayed){
      await gate;
      return {ok:true,text:async()=>{bodyReads++;return '{invalid JSON';}};
    }
    return drive.fetch(url,options);
  }});
  await app.init();const syncing=app.runTimer(0);await flushMessages();
  app.setDrawing(true);release();await syncing;
  assert.equal(bodyReads,0);assert.equal(app.snapshotReads,0);assert.equal(app.merges.length,0);
  assert.equal(app.errors.length,0);assert.equal(drive.uploads.length,0);
  delayed=false;app.setDrawing(false);await app.runTimer(1000);
  assert.equal(drive.uploads.length,1);
});

test('workspace JSON waits for idle even when the Pencil is briefly lifted between strokes', async () => {
  const drive=fakeDrive();drive.replace(workspace('From another device'));
  let delayBody=true;
  const app=browser({server:true,getData:()=>workspace(),driveProvider:async(url,options)=>{
    if(delayBody&&url.includes('alt=media'))return {ok:true,headers:new Headers(),text:async()=>{
      app.setIdleDelay(45000);return '{invalid JSON';
    }};
    return drive.fetch(url,options);
  }});
  await app.init();await app.runTimer(0);
  assert.equal(app.merges.length,0);assert.equal(app.snapshotReads,0);assert.equal(app.errors.length,0);
  delayBody=false;app.setIdleDelay(0);await app.runTimer(45000);
  assert.equal(app.merges.length,1);assert.equal(drive.uploads.length,1);
});

test('a deferred Drive check retries when the remaining idle delay is under one second', async () => {
  const drive=fakeDrive();let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const app=browser({server:true,getData:()=>workspace(),driveProvider:async(url,options)=>{
    await gate;return drive.fetch(url,options);
  }});
  await app.init();const syncing=app.runTimer(0);await flushMessages();
  app.setIdleDelay(200);release();await syncing;
  assert.equal(drive.uploads.length,0);
  app.setIdleDelay(0);await app.runTimer(200);
  assert.equal(drive.uploads.length,1);
});

test('writing during a remote merge save postpones the upload until the next idle period', async () => {
  const drive=fakeDrive();drive.replace(workspace('Remote edits'));
  let release;const gate=new Promise(resolve=>{release=resolve;});
  const app=browser({server:true,driveProvider:drive.fetch,getData:()=>workspace(),mergeWorkspace:()=>gate});
  await app.init();const syncing=app.runTimer(0);await flushMessages();
  assert.equal(app.merges.length,1);
  app.setDrawing(true);release();await syncing;
  assert.equal(app.snapshotReads,0);assert.equal(drive.uploads.length,0);assert.equal(app.errors.length,0);
  app.setDrawing(false);await app.runTimer(1000);
  assert.equal(drive.uploads.length,1);
});

test('idle polling picks up other-device changes without repeatedly downloading or uploading an unchanged workspace', async () => {
  const drive=fakeDrive();let local=workspace();
  const app=browser({server:true,driveProvider:drive.fetch,getData:()=>structuredClone(local),mergeWorkspace:data=>{
    local=data;app.global.WindsDrive.onLocalSave();return true;
  }});
  await app.init();await app.runTimer(0);
  assert.equal(drive.uploads.length,1);
  const before=app.requests.length;await app.runTimer(1000);
  assert.equal(app.requests.length,before+1);assert.equal(app.merges.length,0);assert.equal(drive.uploads.length,1);
  drive.replace(workspace('Updated on iPad B'));await app.runTimer(1000);
  assert.equal(app.merges.length,1);assert.equal(local.notebooks[0].title,'Updated on iPad B');
  assert.equal(drive.uploads.length,2);
  await app.runTimer(1000);assert.equal(drive.uploads.length,2);
});

test('network recovery and returning to the app retry pending changes automatically', async () => {
  const drive=fakeDrive(),app=browser({server:true,driveProvider:drive.fetch,getData:()=>workspace()});
  await app.init();app.setOffline(true);await app.runTimer(0);
  assert.equal(app.requests.length,1);
  app.setOffline(false);app.emit('online');await app.runTimer(0);
  assert.equal(drive.uploads.length,1);
  app.global.WindsDrive.onLocalSave();app.setHidden(true);await app.runTimer(0);
  assert.equal(drive.uploads.length,1);
  app.setHidden(false);app.emit('visibilitychange');await app.runTimer(0);
  assert.equal(drive.uploads.length,2);
});

test('a failed upload is retried, and changes saved during an upload remain queued', async () => {
  const drive=fakeDrive();let failed=false,pause=false,release;
  const gate=new Promise(resolve=>{release=resolve;});let local=workspace('First edits');
  const app=browser({server:true,getData:()=>structuredClone(local),driveProvider:async(url,options)=>{
    if(url.includes('/upload/')&&!failed){failed=true;return Response.json({error:{message:'Try later'}},{status:503});}
    if(url.includes('/upload/')&&pause)await gate;
    return drive.fetch(url,options);
  }});
  await app.init();await app.runTimer(0);assert.equal(drive.uploads.length,0);
  pause=true;const retry=app.runTimer(45000);await flushMessages();
  local=workspace('New edits saved while uploading');app.global.WindsDrive.onLocalSave();release();await retry;
  assert.equal(drive.uploads.length,1);assert.equal(drive.uploads[0].notebooks[0].title,'First edits');
  pause=false;await app.runTimer(0);
  assert.equal(drive.uploads.length,2);assert.equal(drive.uploads[1].notebooks[0].title,'New edits saved while uploading');
});

test('automatic sync respects an explicit pause and resumes when enabled', async () => {
  const localStorage=storage();localStorage.setItem(`winds-drive-auto-${A.sub}`,'false');
  const drive=fakeDrive(),app=browser({server:true,localStorage,driveProvider:drive.fetch,getData:()=>workspace()});
  await app.init();app.global.WindsDrive.onLocalSave();app.emit('online');
  assert.equal(app.requests.length,1);assert.equal([...app.timers.values()].some(timer=>timer.delay===0),false);
  app.element('cloudAutoBackup').onchange({target:{checked:true}});await app.runTimer(0);
  assert.equal(drive.uploads.length,1);
});

test('opening the app retrieves Drive immediately and later remote edits arrive on the one-second poll',async()=>{
  const drive=fakeDrive();drive.replace(workspace('Latest cloud version'));
  let local=workspace('Old local version');
  const app=browser({server:true,driveProvider:drive.fetch,getData:()=>structuredClone(local),mergeWorkspace:data=>{
    local=data;app.global.WindsDrive.onLocalSave();return true;
  }});
  await app.init();await app.runTimer(0);
  assert.equal(local.notebooks[0].title,'Latest cloud version');
  drive.replace(workspace('Another device changed this'));
  app.tick(1000);await app.runTimer(1000);
  assert.equal(local.notebooks[0].title,'Another device changed this');
  assert.equal(app.errors.length,0);
});

test('returning focus retrieves remote edits automatically without waiting for the next poll',async()=>{
  const drive=fakeDrive();let local=workspace();
  const app=browser({server:true,driveProvider:drive.fetch,getData:()=>structuredClone(local),mergeWorkspace:data=>{
    local=data;app.global.WindsDrive.onLocalSave();return true;
  }});
  await app.init();await app.runTimer(0);
  drive.replace(workspace('Updated while this window was inactive'));
  app.emit('focus');await app.runTimer(0);
  assert.equal(local.notebooks[0].title,'Updated while this window was inactive');
  assert.equal(app.errors.length,0);
});

test('warm retrieval reads only workspace metadata and never scans dated backups',async()=>{
  const drive=fakeDrive(),app=browser({server:true,driveProvider:drive.fetch,getData:()=>workspace()});
  await app.init();await app.runTimer(0);
  const discovery=app.requests.find(request=>new URL(request.url,'https://app.test').searchParams.has('q'));
  const query=new URL(discovery.url).searchParams.get('q');
  assert.match(query,/windsNotesWorkspace/);assert.doesNotMatch(query,/windsNotesBackup/);
  const before=app.requests.length,reads=app.snapshotReads;
  await app.runTimer(1000);
  const requests=app.requests.slice(before);
  assert.equal(requests.length,1);
  assert.match(requests[0].url,/\/files\/workspace-file\?fields=/);
  assert.equal(app.snapshotReads,reads,'unchanged metadata does not serialize the workspace');
  assert.equal(drive.uploads.length,1);
});

test('a missing cached file is rediscovered and its replacement is merged before upload',async()=>{
  const drive=fakeDrive();let local=workspace();
  const app=browser({server:true,driveProvider:drive.fetch,getData:()=>local,mergeWorkspace:data=>{
    local=data;app.global.WindsDrive.onLocalSave();
  }});
  await app.init();await app.runTimer(0);
  drive.replace(workspace('Replacement workspace'),'replacement-file');
  const before=app.requests.length;await app.runTimer(1000);
  const requests=app.requests.slice(before);
  assert.match(requests[0].url,/\/files\/workspace-file\?fields=/);
  assert.ok(new URL(requests[1].url).searchParams.has('q'));
  assert.equal(local.notebooks[0].title,'Replacement workspace');
  assert.match(requests.at(-1).url,/\/files\/replacement-file\?uploadType=/);
  assert.equal(drive.uploads.length,2);assert.equal(app.errors.length,0);
});

test('failed metadata checks retain the known file and cannot create duplicate workspaces',async()=>{
  for(const status of [403,503]){
    const drive=fakeDrive();let fail=false;
    const app=browser({server:true,getData:()=>workspace(),driveProvider:(url,options)=>{
      if(fail)return Response.json({error:{message:'Try later'}},{status});
      return drive.fetch(url,options);
    }});
    await app.init();await app.runTimer(0);
    const before=app.requests.length;fail=true;await app.runTimer(1000);
    assert.equal(app.requests.length,before+1);assert.equal(drive.uploads.length,1);
    fail=false;await app.runTimer(45000);
    assert.match(app.requests.at(-1).url,/\/files\/workspace-file\?fields=/);
    assert.equal(drive.uploads.length,1);
  }
});

test('successful uploads notify same-account tabs promptly while input, account and pause guards remain active',async()=>{
  const BroadcastChannel=channels(),peer=new BroadcastChannel(SESSION_KEY),messages=[];
  peer.onmessage=event=>messages.push(event.data);
  const drive=fakeDrive();let local=workspace();
  const app=browser({server:true,BroadcastChannel,driveProvider:drive.fetch,getData:()=>local,mergeWorkspace:data=>{
    local=data;app.global.WindsDrive.onLocalSave();
  }});
  await app.init();await app.runTimer(0);await flushMessages();
  const notification=messages.find(data=>data.type==='workspace-updated');
  assert.equal(notification.sub,A.sub);assert.ok(notification.revision);
  assert.deepEqual(Object.keys(notification).sort(),['clientId','revision','sub','type']);
  drive.replace(workspace('Written in another tab'));
  const before=app.requests.length;
  peer.postMessage({type:'workspace-updated',clientId:CLIENT_ID,sub:B.sub,revision:'new'});await flushMessages();
  assert.equal([...app.timers.values()].some(timer=>timer.delay===0),false);
  app.setDrawing(true);
  peer.postMessage({...notification,revision:'new'});await flushMessages();await app.runTimer(0);
  assert.equal(app.requests.length,before,'a change hint cannot start a request while drawing');
  app.setDrawing(false);await app.runTimer(1000);
  assert.equal(local.notebooks[0].title,'Written in another tab');
  app.element('cloudAutoBackup').onchange({target:{checked:false}});
  peer.postMessage({...notification,revision:'newer'});await flushMessages();
  assert.equal([...app.timers.values()].some(timer=>timer.delay===0),false);
});

test('read-only merges do not echo an upload, while retained local changes still reach Drive',async()=>{
  const drive=fakeDrive();drive.replace(workspace('Remote original'));
  let local=workspace(),retainLocal=false;
  const app=browser({server:true,driveProvider:drive.fetch,getData:()=>local,mergeWorkspace:data=>{
    if(!retainLocal)local=data;
    return {changed:true,needsUpload:retainLocal};
  }});
  await app.init();await app.runTimer(0);
  assert.equal(drive.uploads.length,0,'opening a workspace already on Drive does not upload it again');
  drive.replace(workspace('Remote update'));await app.runTimer(1000);
  assert.equal(local.notebooks[0].title,'Remote update');assert.equal(drive.uploads.length,0);
  local=workspace('Newer local contribution');retainLocal=true;
  drive.replace(workspace('Other device version'));await app.runTimer(1000);
  assert.equal(drive.uploads.length,1);
  assert.equal(drive.uploads[0].notebooks[0].title,'Newer local contribution');
});

test('network time is included in the poll interval without overlapping requests',async()=>{
  const drive=fakeDrive(),app=browser({server:true,getData:()=>workspace(),driveProvider:(url,options)=>{
    app.tick(350);return drive.fetch(url,options);
  }});
  await app.init();await app.runTimer(0);
  assert.ok([...app.timers.values()].some(task=>task.delay===300),'discovery and upload used 700 ms of the first interval');
  await app.runTimer(300);
  assert.ok([...app.timers.values()].some(task=>task.delay===650),'metadata used 350 ms of the next interval');
  assert.equal(drive.uploads.length,1);
});

function virtualScheduler(){
  let now=Date.UTC(2026,10,4,12),id=0;const tasks=new Map(),errors=[];
  return {
    get now(){return now;},
    setTimeout(callback,delay){const next=++id;tasks.set(next,{callback,at:now+delay});return next;},
    clearTimeout:handle=>tasks.delete(handle),
    async advance(milliseconds){
      const target=now+milliseconds;
      while(true){
        const next=[...tasks].sort((a,b)=>a[1].at-b[1].at)[0];
        if(!next||next[1].at>target)break;
        now=next[1].at;tasks.delete(next[0]);
        Promise.resolve().then(next[1].callback).catch(error=>errors.push(error));
        await flushMessages();
      }
      now=target;await flushMessages();assert.deepEqual(errors,[]);
    }
  };
}

test('independent devices retrieve saved handwriting within five seconds with 350 ms per Drive request',async()=>{
  const idle=Number(readFileSync(require.resolve('../app.js'),'utf8').match(/const SAVE_IDLE_MS = (\d+)/)[1]);
  for(const phase of [0,250,750]){
    const scheduler=virtualScheduler(),drive=fakeDrive();drive.replace(workspace('Before writing'));
    let written=workspace('Before writing'),read=workspace('Before writing'),receivedAt=null;
    const request=async(url,options)=>{
      await new Promise(resolve=>scheduler.setTimeout(resolve,350));
      return drive.fetch(url,options);
    };
    // Separate storage and no BroadcastChannel: these represent different devices.
    const writer=browser({server:true,scheduler,driveProvider:request,getData:()=>written,mergeWorkspace:data=>{
      written=data;return {changed:true,needsUpload:false};
    }});
    const reader=browser({server:true,scheduler,driveProvider:request,getData:()=>read,mergeWorkspace:data=>{
      read=data;if(data.notebooks[0].title==='New handwriting')receivedAt=scheduler.now;
      return {changed:true,needsUpload:false};
    }});
    await writer.init();await reader.init();await scheduler.advance(2500+phase);
    assert.equal(drive.uploads.length,0);
    writer.setDrawing(true);written.notebooks[0].title='New handwriting';
    written.notebooks[0].pages[0].items.push({id:'new-stroke',type:'stroke',points:[[10,10,.5],[100,100,.7]]});
    writer.setDrawing(false);writer.setIdleDelay(idle);
    const finishedAt=scheduler.now;
    scheduler.setTimeout(()=>{writer.setIdleDelay(0);writer.global.WindsDrive.onLocalSave();},idle);
    await scheduler.advance(5500);
    assert.ok(receivedAt!==null);assert.ok(receivedAt-finishedAt<=5000,`phase ${phase}: ${receivedAt-finishedAt} ms`);
    assert.ok(receivedAt-finishedAt>=idle);
    assert.equal(read.notebooks[0].pages[0].items.length,2);
    assert.equal(drive.uploads.length,1,'the reader must not upload the received workspace again');
    assert.equal(writer.errors.length,0);assert.equal(reader.errors.length,0);
  }
});

test('background polling keeps account actions enabled and does not rewrite the dialog controls',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve;}),drive=fakeDrive();
  const app=browser({server:true,getData:()=>workspace(),driveProvider:async(url,options)=>{await gate;return drive.fetch(url,options);}});
  await app.init();app.global.WindsDrive.open();
  const relevant=()=>app.uiWrites.filter(write=>['googleConnect','googleDisconnect','googleSwitchAccount','googleSync','googleBackup','googleRestore','cloudConnectionText','cloudEntryLabel'].includes(write.id));
  const before=relevant().length;
  const poll=app.runTimer(0);await flushMessages();
  for(const id of ['googleDisconnect','googleSwitchAccount','googleSync','googleBackup','googleRestore'])assert.equal(app.element(id).disabled,false,id);
  assert.equal(relevant().length,before);
  release();await poll;
  for(let i=0;i<3;i++)await app.runTimer(1000);
  assert.equal(relevant().length,before,'unchanged account controls are not rewritten on each poll');
});

test('sign-out works during a delayed poll, aborts its request and ignores the stale reply',async()=>{
  let release,bodyReads=0;const gate=new Promise(resolve=>{release=resolve;});
  const app=browser({server:true,driveProvider:async()=>{
    await gate;return {ok:true,text:async()=>{bodyReads++;return '{invalid JSON';}};
  }});
  await app.init();const poll=app.runTimer(0);await flushMessages();
  const signal=app.requestSignals.at(-1);
  assert.equal(app.element('googleDisconnect').disabled,false);
  await app.element('googleDisconnect').onclick();
  assert.equal(signal.aborted,true);assert.equal(app.account,null);assert.equal(app.saved,null);
  release();await poll;
  assert.equal(bodyReads,0);assert.equal(app.errors.length,0);
  assert.equal(app.element('googleConnect').hidden,false);assert.equal(app.element('googleConnect').disabled,false);
  assert.match(app.element('cloudMessage').textContent,/Signed out/);
});

test('manual sync clicked during a background check is queued and runs after the check',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve;}),drive=fakeDrive();let delayed=true;
  const app=browser({server:true,getData:()=>workspace(),driveProvider:async(url,options)=>{
    if(delayed)await gate;return drive.fetch(url,options);
  }});
  await app.init();const poll=app.runTimer(0);await flushMessages();
  const before=app.requests.length;await app.element('googleSync').onclick();
  assert.equal(app.requests.length,before);assert.match(app.element('cloudMessage').textContent,/Finishing/);
  delayed=false;release();await poll;
  await app.runTimer(0);
  assert.equal(drive.uploads.length,2,'one automatic upload followed by the requested manual sync');
  assert.equal(app.element('googleDisconnect').disabled,false);
});

test('switching accounts during a poll cannot let its late completion unlock a newer in-flight operation',async()=>{
  let releaseA,releaseB;
  const gateA=new Promise(resolve=>{releaseA=resolve;}),gateB=new Promise(resolve=>{releaseB=resolve;});
  let slowA=false,slowB=false,staleBodyReads=0;
  const app=browser({driveProvider:async(url,options)=>{
    const token=options.headers.get('Authorization');
    if(token==='Bearer token-a'&&slowA){await gateA;return {ok:true,text:async()=>{staleBodyReads++;return '{invalid JSON';}};}
    if(token==='Bearer token-b'&&slowB)await gateB;
    return Response.json({files:[]});
  }});
  await app.init();await app.signIn();slowA=true;
  const oldPoll=app.runTimer(0);await flushMessages();const oldSignal=app.requestSignals.at(-1);
  assert.equal(app.element('googleSwitchAccount').disabled,false);
  await app.signIn('token-b',true);assert.equal(oldSignal.aborted,true);assert.equal(app.account,B.sub);
  slowB=true;const newPoll=app.runTimer(0);await flushMessages();
  releaseA();await oldPoll;
  const before=app.requests.length;await app.element('googleSync').onclick();
  assert.equal(app.requests.length,before,'old completion cannot unlock the newer request');
  slowB=false;releaseB();await newPoll;await app.runTimer(0);
  assert.equal(staleBodyReads,0);assert.equal(app.saved.profile.sub,B.sub);assert.equal(app.errors.length,0);
  assert.match(app.element('cloudConnectionText').textContent,/b@example.test/);
});

test('automatic sync prioritizes the open notebook, then the private workspace, then bounded background work',async()=>{
  const drive=fakeDrive(),order=[];
  const sharing={init(){},cancel(){},resume(){},async sync(s,manual,options){order.push(manual?'all-shared':options.only?'priority:'+options.only:'background:'+options.limit+':'+options.exclude);}};
  const app=browser({server:true,sharing,activeBookId:'current-notebook',getData:()=>workspace(),driveProvider:(url,options)=>{
    order.push(url.includes('/upload/')?'upload-private':'read-private');return drive.fetch(url,options);
  }});
  await app.init();await app.runTimer(0);
  assert.deepEqual(order,['priority:current-notebook','read-private','upload-private','background:1:current-notebook']);
  order.length=0;await app.element('googleSync').onclick();
  assert.deepEqual(order,['all-shared','read-private','upload-private'],'manual sync still checks all shared notebooks');
});

test('sync details show confirmed transfers and reset when switching Google accounts',async()=>{
  const drive=fakeDrive(),app=browser({getData:()=>workspace(),driveProvider:(url,options)=>drive.fetch(url,options)});
  await app.init();await app.signIn();await app.runTimer(0);
  app.element('cloudSyncDetails').open=true;app.element('cloudBackdrop').hidden=false;app.element('cloudSyncDetails').ontoggle();
  assert.notEqual(app.element('cloudLastUploaded').textContent,'None in this tab yet');
  assert.notEqual(app.element('cloudLastChecked').textContent,'None in this tab yet');
  assert.match(app.element('cloudSyncMode').textContent,/Drive only/);
  assert.match(app.element('cloudCycleDuration').textContent,/seconds/);
  app.setIdleDelay(2500);await app.signIn('token-b',true);app.element('cloudSyncDetails').ontoggle();
  assert.equal(app.element('cloudLastUploaded').textContent,'None in this tab yet');
  assert.equal(app.element('cloudLastReceived').textContent,'None in this tab yet');
  assert.equal(app.element('cloudLastChecked').textContent,'None in this tab yet');
});

test('unrelated shared checks cannot delay private handwriting past five seconds in the controlled network model',async()=>{
  for(const phase of [0,250,750]){
    const scheduler=virtualScheduler(),drive=fakeDrive();drive.replace(workspace('Before'));
    let written=workspace('Before'),read=workspace('Before'),receivedAt=null;
    const wait=()=>new Promise(resolve=>scheduler.setTimeout(resolve,350));
    const request=async(url,options)=>{await wait();return drive.fetch(url,options);};
    const sharing=()=>({init(api){this.api=api;},resume(){},cancel(){},async sync(s,manual,options){
      if(options?.only)return;
      for(let i=0;i<(options?.limit||6);i++){this.api.check(s,manual);await wait();this.api.check(s,manual);}
    }});
    const writer=browser({server:true,scheduler,sharing:sharing(),activeBookId:'private-book',driveProvider:request,getData:()=>written,mergeWorkspace:data=>{written=data;return {changed:true,needsUpload:false};}});
    const reader=browser({server:true,scheduler,sharing:sharing(),activeBookId:'private-book',driveProvider:request,getData:()=>read,mergeWorkspace:data=>{read=data;if(data.notebooks[0].title==='After')receivedAt=scheduler.now;return {changed:true,needsUpload:false};}});
    await writer.init();await reader.init();await scheduler.advance(15000+phase);
    written.notebooks[0].title='After';writer.setIdleDelay(2500);const finished=scheduler.now;
    scheduler.setTimeout(()=>{writer.setIdleDelay(0);writer.global.WindsDrive.onLocalSave();},2500);
    await scheduler.advance(10000);
    assert.ok(receivedAt!==null);assert.ok(receivedAt-finished<=5000,`phase ${phase}: ${receivedAt-finished} ms`);
    assert.equal(drive.uploads.length,1,'no received-data upload echo');
    assert.equal(writer.errors.length,0);assert.equal(reader.errors.length,0);
  }
});
