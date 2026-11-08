# Live handwriting previews and deployment

Status: implemented in this workspace, behind the optional same-origin backend. It has not been deployed to the public site. Static GitHub Pages continues to use automatic Google Drive synchronization. The backend package includes persistent Google login, a bounded in-memory preview relay, Dockerfile and Compose configuration. No hosting account or paid service has been created.

## What arrives quickly

A completed small stroke or shape can travel to another connected client after a 150 ms input-idle opportunity, without waiting for the 2.5-second durable save and Drive upload. The receiver queues a prompt idle check and paints on a separate, temporary canvas. More packets cannot postpone an already scheduled check. Real Google/network latency is additional; there is no measured production millisecond guarantee. Continuous writing and browser background throttling can postpone delivery.

This is **visual preview delivery**, not a replacement for durable notebook synchronization. A preview is not added to notebook data, undo history, local storage or exports. It disappears when the same item arrives through Drive, or expires after about 30 seconds once the receiver is idle. Drive remains the durable recovery path. A relay acknowledgement explicitly says `durable:false`.

Supported preview packets are strokes with at most 512 points (64 for textured Artist strokes) and shapes, at most 32 KiB each. Existing notebooks/pages must already be present on both clients. Initial loading, new notebooks/pages, long strokes, images, text, erasing and resizing still use Drive. Subsequent editing sends an invalidation that clears the sender's affected preview layer. Previews may briefly disappear while waiting for the saved version. The relay does not implement real-time cursors, shared object locks or full collaborative document reconciliation.

## Drawing and account isolation

Input hooks only retain a small reference/scalar queue. Timers serialize/send later; receiving events are queued as raw strings and parsed only after the input-idle check. Rendering is batched with requestAnimationFrame. Pen, pinch, text and crop activity postpone processing. The existing Touch Event suppression, pointer recovery, durable-save delay, native format version and account database keys are retained.

The server verifies the HttpOnly cookie and requested Google subject before accessing any room. Private rooms use the verified subject. Shared rooms additionally check the dedicated notebook folder's app marker and Google Drive editing capability, including on delivery and heartbeat. Shared access checks are cached for up to five seconds, subject to Google's permission propagation. Client-supplied notebook IDs and email addresses do not grant access. Logout closes streams for the affected browser session/account; automatic-sync pause stops live delivery too.

The client opens one private stream and up to three shared streams, prioritizing the open notebook. Other shared notebooks retain automatic Drive sync. The four-stream cap leaves connections available for backup requests on HTTP/1; HTTP/2 is preferable for multiple active tabs. See the browser connection limits in [MDN's SSE guide](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events).

## Processing and retention

Preview payloads pass through the private backend, as authorized for this feature. The provided server does not log or write them to disk. Each room retains at most 64 events / 128 KiB for a 60-second replay window; a 15-second cleanup removes expired entries, so payload retention can reach approximately 75 seconds. Limits also cover rooms, streams, publish rates and slow readers. A restart loses relay history and clients recover via Drive. The encrypted persistent session file contains authorization records, not notebooks. Hosting-provider logging/backups must be configured consistently with the published privacy policy.

Replay gaps cause a reset and idle Drive retrieval. A bounded replay is used instead of buffering unlimited ink. Failed publication retries automatically; failure does not interrupt local writing or disable Drive backup.

## Deploy the prepared package

Use **one continuously running Node.js 22+ process** on the website's HTTPS origin with a persistent writable disk for the encrypted session file. GitHub can store this code; GitHub Pages cannot run the process. This implementation uses process-local relay rooms and a single-process session file, so multiple replicas are not supported. Scaling requires shared pub/sub and a transactional session store.

### Render

1. Put the complete release in a Git repository, including the root `render.yaml`. In Render, select **New → Blueprint**, choose that repository and review the price before creating the service. The Blueprint selects one paid web instance and a 1 GB disk. [Render Blueprints](https://render.com/docs/infrastructure-as-code) · [Pricing](https://render.com/pricing)
2. Enter the existing Google Web OAuth client secret in Render's private settings. The server uses the public client ID from `google-config.js` unless you set `GOOGLE_CLIENT_ID` separately. Render generates the session encryption key and supplies the public origin. Keep the generated key so the server can read existing sessions after a redeploy. If you later use a custom domain, set `WINDS_PUBLIC_ORIGIN` to its HTTPS origin.
3. Copy the service's public URL from Render. Add that origin and its exact `/auth/google/callback` redirect URI to the Google Web OAuth client. Keep the current GitHub Pages settings for users who still open that site. Follow the account and backup steps below before testing on two devices. [Google OAuth web-server setup](https://developers.google.com/identity/protocols/oauth2/web-server)
4. Check `/healthz` for `{"ok":true,"live":true}`. Open the same notebook and page on two devices using the new URL, with automatic sync on. Confirm **Live handwriting previews connected** in the Google Drive dialog. Draw several separate strokes and verify the second device shows them, then verify they remain after the Drive upload and a reload.

### Docker or a direct Node host

1. Configure the origin, Google Web OAuth client and private server settings in [Persistent login](PERSISTENT_LOGIN.md). Add the exact redirect URI `https://YOUR-ORIGIN/auth/google/callback`. Complete the appropriate Google OAuth audience/branding setup for the accounts that will use it.
2. Copy `server/.env.example` into a **gitignored** `.env.production` beside `compose.yaml`, replacing every placeholder privately. Generate a stable 32-byte session encryption key using the command in that file. Never commit or send the resulting secrets. For a direct Node host, use its private environment settings instead.
3. With Docker installed, run `docker compose up -d --build`. The prepared Compose file maps only `127.0.0.1:8080`, stores encrypted sessions in the `winds-data` volume, and enables `WINDS_LIVE_SYNC=true`. Put your HTTPS reverse proxy in front of it. Alternatively set those environment variables and run `npm start` on Node 22+.
4. Forward `/`, `/auth/` and `/live/` to the same process. Preserve cookies and Origin headers. Disable caching, response buffering and compression for `/live/` so SSE frames flush promptly; allow long responses and a read timeout above the 15-second heartbeat. The app sends `X-Accel-Buffering: no`. For Nginx, see its [proxy buffering documentation](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering). A platform that buffers SSE or only supports brief serverless requests is unsuitable for this package.
5. Verify `/healthz` returns `{"ok":true,"live":true}` and public `google-config.js` enables `WINDS_REALTIME_ENABLED`. Open the Drive dialog after signing in: it should say **Live handwriting previews connected. Drive backup saves separately.** Both devices must load the backend-hosted site with automatic sync enabled.

Set `WINDS_LIVE_SYNC=false` and restart to disable the relay while retaining persistent login and Drive backup. The static `google-config.js` does not enable the relay. Do not put server secrets in it.

## Moving from GitHub Pages

Browser storage is scoped to the website origin. Export local-only `.winds-notes` or complete a Drive backup before moving to another domain. Sign in to the same account on the new site and retrieve Drive data or import the export. Do not clear old Safari data before checking the new copy. No account-key migration is required within the same origin.

## Validation and release boundary

`npm run check` covers authenticated isolation, shared permission rejection/revocation, replay/reset, duplicate retries, CSRF and packet/queue limits, logout, active-input deferral, client backoff and preview expiry. A browser test used two tabs, actual relay/auth code and mocked Google responses: 12 separate strokes plus one long stroke were visible as 13 previews while the delayed Drive file still contained zero strokes. Later Drive held all 13 and the preview count fell to zero. Production server startup/config/routes and private-path protection were smoke-tested with mock credentials.

Docker was not available locally, so the container build has not been run. Actual Google OAuth, multi-device public-network latency, HTTPS proxy behavior and physical iPad/Pencil responsiveness still require deployment/device verification. This package does not claim those checks have passed.
