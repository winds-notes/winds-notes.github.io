# Persistent Google Drive login

The server implementation keeps an account connected after refreshing, opening a new tab, closing every tab and reopening the website. Google access tokens still expire normally; the server renews them using an encrypted refresh credential, without another login popup. Logout removes the selected account's server and browser credentials.

This feature is implemented and covered by mocked OAuth/server/browser tests. It is **not enabled on the existing GitHub Pages deployment** until the server is hosted and Google OAuth settings are configured. Google can independently revoke permission, and browsers can clear cookies or website data; no application can override those events.

## Static hosting: automatic reconnection

GitHub Pages cannot keep a refresh token, so Google's browser-only access token lasts about an hour. `oauth-redirect.js` renews it without the user tapping *Reconnect*, using Google's documented client-side OAuth flow with `prompt=none` and the account as `login_hint`:

1. **At launch.** If the remembered account's token is expired (or expires within five minutes), a tiny script in `<head>` checks that Google is reachable, shows a "Reconnecting Google Drive…" splash and bounces once through Google to `oauth-callback.html`, which hands the token back and returns to the app. Nothing is shown by Google while the user is signed in to Google in that browser and has granted access before.
2. **While the app is open.** About five minutes before expiry, and after returning to the app, a hidden iframe makes the same silent request once writing is idle. Browsers that block Google's sign-in cookies in frames (Safari/iPadOS) fail quickly and retry at most every 30 minutes; the next launch renews with step 1.
3. **Fallback.** When Google needs interaction, the amber **Resume sync** chip (editor) or **Resume Drive sync** button (library) reconnects the same account in one tap, saving local notes first. The notebook and page reopen after the bounce.

**Setup (once):** in Google Cloud Console → Google Auth Platform → Clients → the Web client, add the exact redirect URI `https://<your site>/oauth-callback.html` (for this deployment `https://winds-notes.github.io/oauth-callback.html`). Then set `window.WINDS_GOOGLE_REDIRECT_URI` to the same URL in `google-config.js` and redeploy `index.html`, `google-config.js`, `oauth-redirect.js`, `oauth-callback.html`, `cloud-drive.js`, `app.js`, `styles.css` and `sw.js` together.

**Safety rules.** Google shows an "Access blocked: redirect_uri_mismatch" page instead of redirecting when the callback URL is not registered, so top-level redirects run only when the URL is configured explicitly or a hidden-iframe probe has received a real Google response on this device. Every request uses a random `state` that must match on return. A silent token is applied only if its verified Google `sub` equals the remembered account. A silent attempt that fails (for example `interaction_required`) stops launch bounces for that account until it signs in again; launch bounces are limited to one per three minutes; a silent bounce that never returned marks redirects broken on that device. The token is removed from the address bar immediately and is stored exactly like the existing short-lived session. No refresh token or secret exists in the browser, and nothing runs from the Pencil handlers. Set `window.WINDS_GOOGLE_SILENT_RENEWAL = false` to disable the feature.

The server mode below remains the option for renewal without any Google cookie dependence.

## Hosting

Run the website and authentication endpoints together on one HTTPS origin using Node.js 22 or newer. Start one server process with `npm start`. No npm dependencies or build step are needed.

Use a persistent writable disk for the encrypted session file. An ephemeral deployment filesystem will lose saved login sessions when the server restarts. Keep the encryption key stable across deployments. This implementation supports one process; do not run multiple replicas against the same file. Use a shared transactional session store before scaling beyond one process.

Set these values in the hosting service's private environment settings:

| Variable | Value |
| --- | --- |
| `WINDS_PUBLIC_ORIGIN` | Exact public HTTPS origin, for example `https://notes.example.com` |
| `GOOGLE_CLIENT_ID` | Public Google Web OAuth client ID; defaults to the ID in `google-config.js` |
| `GOOGLE_CLIENT_SECRET` | The Web OAuth client's secret, stored only on the server |
| `WINDS_SESSION_KEY` | 32 random bytes encoded as base64 |
| `WINDS_SESSION_FILE` | Absolute path on persistent storage outside the website, such as `/var/lib/winds-notes/sessions.enc` |
| `WINDS_LIVE_SYNC` | Optional `true` to enable temporary live handwriting previews; default off |
| `PORT` | Internal HTTP port, default `8080` |
| `HOST` | Default `127.0.0.1`; set `0.0.0.0` when the hosting platform requires it |

Generate a private encryption key on the deployment machine or in its secrets manager:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Keep the client secret, encryption key and session file out of Git, the public website and chat messages. The server refuses a session-file path inside the website. Put an HTTPS reverse proxy or the hosting platform's HTTPS endpoint in front of the HTTP listener.

For local development, `WINDS_PUBLIC_ORIGIN=http://localhost:8080` is allowed. Production origins must use HTTPS. The static `npm run dev` server remains available for handwriting/UI work; it does not provide refresh-token authorization.

## Google OAuth configuration

For the configured Google Web OAuth client, add this exact **authorized redirect URI**, using the new website origin:

```text
https://notes.example.com/auth/google/callback
```

Enable the Drive API and configure the OAuth audience/scopes for `openid`, `email`, `profile` and `https://www.googleapis.com/auth/drive.file`. Use the intended consent-screen production status for ongoing usage. Google may expire testing or revoked refresh grants independently of the app session.

Under Google Auth Platform → Branding, use the deployed site's public homepage and policy URLs. For the example origin above, the privacy link is `https://notes.example.com/privacy.html` and the terms link is `https://notes.example.com/terms.html`. The server serves both pages and `legal.css` without requiring a session. Publish the updated homepage links, review the policy/contact details, and check that these exact URLs open without Google sign-in before submitting branding verification. On GitHub Pages, upload the HTML pages and stylesheet alongside `index.html`; the local files are not automatically published.

The running server supplies `WINDS_GOOGLE_AUTH_SERVER=true` through its public `google-config.js` response. Do not enable this flag in a GitHub Pages-only deployment: `/auth/google/session` must be served by the real backend on the same origin. A separate cross-site cookie backend is intentionally avoided so Safari's third-party-cookie restrictions do not become another login failure.

After deployment, sign in once to authorize offline access. Subsequent sessions use the persistent cookie and automatic server renewal. The server retains accounts separately within the browser's device session, so selecting account B in a new tab cannot send account A's notebooks to B.

## Preserve existing notes when changing domains

Browser storage is isolated by website origin. Before moving from GitHub Pages to a different domain, export local-only notebooks as `.winds-notes`, or finish syncing them to the correct Google account. On the new origin, sign in to the same account and open its Drive workspace or import the exported notebooks. The existing notebook format and per-account database keys are unchanged; changing hosting origins does not automatically transfer IndexedDB contents.

## Verification

Run `npm run check`. Tests exercise encrypted persistence across server restarts, access-token renewal, concurrent refresh/logout, Google revocation, separate accounts, offline logout, stale tab recovery and renewal deferral while writing. Browser testing with mock Google responses covers closing the only app tab, reopening, automatic renewal after simulated expiry, handwritten strokes and save/open. Real Google consent, HTTPS hosting and a physical iPad still require deployment/device verification.

Google documents why browser-only tokens require user-driven renewal in its [token model guide](https://developers.google.com/identity/oauth2/web/guides/use-token-model), and the server refresh mechanism in its [web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server).

## Packaged deployment and live previews

The repository includes a Dockerfile, `compose.yaml` and `server/.env.example`. See [Live previews and deployment](REALTIME_SYNC.md) for private configuration, persistent volume, HTTPS/SSE requirements, single-process limits and validation boundaries. The relay processes temporary ink previews in memory; the updated privacy policy describes this optional path.
