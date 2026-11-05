# WiNDS Notes

**A tablet-first handwriting and drawing application with optional Google Drive storage.**  
Designed by [Alakesh Kalita](https://alakesh-kalita.github.io/).

This is the **complete, editable Codex development workspace**, built from the latest WiNDS Notes Google sign-in edition. It is a static application that runs on GitHub Pages. **No build step, backend, or npm dependency is required to use the website.**

## What works

- **Handwriting:** Apple Pencil / stylus / touch / mouse, pressure samples, low-latency ink layer, smooth pen ribbons with rounded ends and continuous pressure widths, undo/redo, eraser and selection.
- **Two-finger gestures:** pinch zoom and pan (**35%–800%**), preset zoom menu, portrait and landscape notebook pages.
- **Shapes with fills and borders:** Rectangle, exact Square, Ellipse, exact Circle, Triangle, Diamond and Star. Choose separate fill color/opacity, **outline color**, **outline thickness (1–32)** and **solid/dashed/dotted/no-outline** styles. Existing figures can be updated using Select → Fill.
- **Artist Studio:** 25 materials in Graphite, Ink and Pigment collections, with pressure previews, size and flow controls. Technical/fountain pens, dry brush, pastels, chalk and expanded graphite retain editable strokes and consistent exports.
- **Notebook workflow:** Multiple notebooks/pages, text, stickers, imported images with **resizable corner handles and exact width controls**, templates, local autosave and export/import in editable `.winds-notes` format.
- **Sharing:** PDF, JPEG, PNG and JSON backups; per-notebook Google Drive invitations for another Google account to view and edit.
- **Optional Google Drive:** Google OAuth (public client ID configured in `google-config.js`), separate on-device account workspaces, and backups/sync within each authorized user's own Drive. See `docs/ARCHITECTURE.md` for limitations.

## Run locally (recommended for Codex)

Prerequisite: **Node.js 18+**.

```bash
cd winds-notes-codex
npm run dev
```

Open **http://localhost:5173/**. No `npm install` is required; the development server uses only Node's standard library. You may also use `python3 -m http.server 5173`.

```bash
npm test       # Pure rendering, save/reopen and compatibility tests
npm run check  # JavaScript syntax checks and tests
```

To work with the **Codex CLI**, open this folder in your terminal or IDE and run Codex from the project root (with Codex installed and authenticated):

```bash
cd winds-notes-codex
codex
```

Codex instructions are in **`AGENTS.md`**. Suggested first task: *"Review the Apple Pencil event-handling invariants in AGENTS.md, then improve Artist brush texture and shape resize UX while keeping rapid Pencil strokes smooth. Add tests."*

## Using the new features

**Drawing width:** New pen strokes and shape outlines start at **7**. The thickness controls still support 1–32; existing saved strokes keep their original widths.

**Filled figures:** In the editor's horizontal toolbar, click **Fill** → enable solid fill → choose fill color and opacity, then choose a separate border color, line width (up to 32) and border style. Draw a Square or Star. To edit an existing figure, choose **Select**, tap it, reopen **Fill** and change fill/border properties. Line and Arrow remain unfilled (but can have outline styles).

**Artist Studio:** Click **Artist**, browse **Graphite (12)**, **Ink (6)** or **Pigment (7)**, then choose a material. Set **Size (1–32)** and **Flow (10–100%)** for future strokes; width starts at 7. The large sample shows light-to-firm pressure. Technical Pen keeps a constant width, Fountain Pen and Ink Brush respond expressively, while charcoal, dry brush, pastel and chalk use distinct textures. Color applies to ink and pigments; graphite and charcoal keep their natural shades. Regular **Pen** returns to handwriting. Existing strokes retain their previous appearance. See [Artist Studio](docs/ARTIST_STUDIO.md).

**Choose your color:** The extra color palette contains filled light-color cells. Choosing another color replaces the previous selection and updates the current-color preview. Stronger writing colors remain available in the main toolbar.

**Resize images and smileys:** Import an image or insert an emoji, then choose **Select** and tap the object. Drag one of its four corner handles to resize, or use the floating **Width** control / ± buttons for exact sizing. Images preserve their aspect ratio, while smileys stay square. Shapes also support corner resizing.

**Rotate images and smileys:** Choose **Select** and tap the image or smiley. Use **↶ / ↷** in its floating controls to rotate by 90°, or enter an exact **Angle**. Enter **0** to straighten it. Rotation supports undo/redo, resizing, image cropping, save/reopen and exports.

**Crop images:** Choose **Select**, tap an added image and choose **Crop** in its floating controls. Drag the crop corners or enter percentages; drag inside the selection to move it. **Apply crop** updates the image; **Cancel** leaves it unchanged. **Reset → Apply crop** restores the full image. Crops support undo/redo, resizing, native files, backups, Drive workspace data and every export format. The original image is retained so you can adjust the crop later.

**Zoom:** Pinch with two fingers, tap ±, or tap the **zoom percentage** for presets from 50% through 800%. Zoom is only a viewing setting and does not change the saved page dimensions.

**Open/edit later:** Export → **WiNDS Notes notebook** downloads `.winds-notes`. Use **Open notebook** from the dashboard to reopen an editable copy.

**Recover notes:** **Open notebook** and **Notebook options → Restore notebook backup…** both validate the entire file before adding editable copies with fresh IDs. Existing notebooks are never replaced, even when a backup contains matching IDs. Older WiNDS and Folio JSON backups remain supported. A fresh workspace starts with one blank **Untitled notebook**; the original app design is preserved.

## Deploy on GitHub Pages

The repository root itself is the **deployable website**. Commit or upload `index.html`, `privacy.html`, `terms.html`, `LICENSE`, all `.js`/`.css` files (including `legal.css`), `manifest.webmanifest`, `.nojekyll`, and `assets/` to the root of the website repository. In GitHub, choose **Settings → Pages → Deploy from a branch → main / (root)**.

If you publish by replacing GitHub files, ensure the updated `creative-tools.js` is included. `sw.js` has an updated cache version so returning visitors can receive the new app shell. Back up important notebooks as `.winds-notes` before updating the deployed app. **Do not clear Safari website data** without a backup.

## Share a notebook

In **My notebooks**, tap a notebook's **three-dot Actions menu → Share notebook…**, enter the collaborator's Google account email and choose **Share and send invitation**. Only that notebook is shared with editing access. Google emails the invitation and app link; the recipient opens the app link and signs in with the invited account. **Open shared link** also opens a WiNDS invitation link. Both people can write and retrieve each other's saved changes automatically while their private notebooks stay separate.

Shared notebooks show a Shared label. Their menu retains **Remove from my library**; the owner manages/revokes Drive permissions in the dedicated shared notebook folder. See [Notebook sharing](docs/NOTEBOOK_SHARING.md) for deployment files, OAuth/test-user requirements, offline recovery and editing limitations. Real Google delivery and recipient access still need deployment verification.

## Google Drive configuration and privacy

The Google OAuth Web client ID is a **public identifier**; it is in `google-config.js` so this static GitHub Pages app can initiate authorization. **No OAuth client secret, Google API key, access token or refresh token is committed.** Sign-in still requires correct Google Cloud Console settings: permitted website origin, external OAuth audience/test users or public production status, enabled Google Drive API and appropriate scopes. For a different domain, add the exact origin in Google Cloud Console. To test Google sign-in locally, authorize `http://localhost:5173` as another JavaScript origin; otherwise use the deployed GitHub Pages URL.

**OAuth policy links:** The public `privacy.html` and `terms.html` pages describe this app's data practices and service terms, with links from the homepage and Drive dialog. Publish them with `legal.css` and confirm the contact information before submitting them to Google. For an app at `https://winds-notes.github.io/`, enter `https://winds-notes.github.io/privacy.html` as the Application privacy policy link and `https://winds-notes.github.io/terms.html` as the Application terms of service link. If the app uses a repository subpath or another domain, use that same base URL for both pages. They must be reachable publicly without sign-in; these URLs become live only after deployment.

Each signed-in user's Drive files belong to that Google account, not to a shared developer account. Local guest data is separate. Network saves do not run inside the active Pencil input handlers. Each account keeps its own private workspace. Selected notebooks can be shared explicitly with another Google account for viewing and editing; shared changes synchronize after writing is idle. This does not provide real-time cursors or perfect reconciliation of simultaneous edits to the same object.

**Fast automatic Drive synchronization:** Automatic sync is enabled by default for each account. Edits save locally after a **2.5-second pause in writing**, then queue for upload immediately. Incoming changes are checked automatically every **1 second** while the app is visible and idle, with immediate checks on opening, returning to the app or reconnecting. Same-account tabs notify one another after a completed upload so they can retrieve changes without waiting for the next poll. Once the workspace file is known, checks request only its metadata rather than searching dated backups. No manual Sync or page refresh is needed. A new stroke, text edit or pinch gesture postpones remaining parsing, merging, canvas refreshes and uploads until idle again. Polling includes time already spent on the request, and a receiving device saves incoming changes without uploading the same data again. Newer local notebooks and deletion markers are still merged and uploaded. Unchanged workspaces are not repeatedly downloaded or uploaded, and failed requests retain their retry delay. The target for a small workspace on two visible, idle devices is roughly 3–5 seconds from the final stroke to retrieval, rather than an upload-only timing. Actual transfer time depends on connection speed, Drive response time and notebook size; active writing, background tabs and failed requests can take longer. Open Google Drive to check the automatic-sync setting and last successful upload time; explicit pause remains supported.

**Priority sync and visibility:** Automatic sync checks the open shared notebook first, then the private workspace, and rotates through one other shared notebook per cycle. New shared edits are published before polling history; uncertain replies are reconciled before retrying. Manual sync still checks every shared notebook. In Google Drive, expand **Sync details** for this tab's last workspace check, received change, successful upload, sync mode and cycle duration. This duration describes one completed check/transfer cycle, not the full time from writing on another device. See [Sync performance](docs/SYNC_PERFORMANCE.md) for controlled timings and limits.

**Persistent login:** The account workspace is remembered across refreshes, new tabs and closing the browser. On static hosting, each account's short-lived Drive credential is saved in this browser's localStorage and reverified with Google on reopening. Its expiry is never extended, so static GitHub Pages hosting still requires renewed Drive authorization after Google expires the token. Credentials are never included in notebook files or source control.

**Automatic renewal after expiry:** The optional server in `server/` provides a persistent HttpOnly session cookie and stores Google refresh credentials encrypted outside the website directory. It restores the same account after all tabs close and renews Drive access automatically while writing is idle. See **[Persistent login deployment](docs/PERSISTENT_LOGIN.md)** for the required hosting and Google OAuth configuration. Uploading JavaScript to GitHub Pages alone cannot enable this server feature.

**Sign out / open guest notes** clears the selected account's browser credentials and, in server mode, its server session. Other tabs immediately stop Drive access without interrupting writing. Offline server logout is completed before a later session restore, and old suspended tabs cannot revive a logged-out session. Existing tabs keep their own account when another tab switches accounts. Google can still require fresh permission after access is revoked or the OAuth application's test authorization expires.

**Optional live previews:** The prepared backend relays small completed strokes/shapes to another connected client after a short idle opportunity, while local saving and Drive backup remain separate. Previews are temporary until confirmed by Drive; erasing, large content and initial loading still follow durable sync. See [Live previews and deployment](docs/REALTIME_SYNC.md) for the Docker/Compose package, private environment settings and limitations. It is not enabled by uploading files to GitHub Pages alone.

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html` | Home page, editor toolbar and menus |
| `styles.css` | Visual design and responsive iPad/phone layout |
| `app.js` | Notebook UI, pointer/gesture input, local storage and exports |
| `creative-tools.js` | Figure geometry/fills and artist graphite rendering (independently testable) |
| `native-file.js` | `.winds-notes` validation, imports and serialization |
| `cloud-drive.js` | Google OAuth and per-account Drive workspace logic |
| `notebook-sharing.js` / `shared-notebook-model.js` | Per-notebook Drive invitations, durable outgoing edits and shared history replay |
| `live-sync.js` / `server/live-relay.mjs` | Optional authenticated, temporary live-ink previews |
| `Dockerfile` / `compose.yaml` | Same-origin server package with persistent encrypted sessions |
| `google-config.js` | Public OAuth Web client ID only |
| `pdf-export.js` | PDF writer |
| `sw.js` | Service worker / offline cache |
| `tests/` | Node built-in unit tests |
| `tools/dev-server.mjs` | Local zero-dependency server |
| `AGENTS.md` | Instructions and safety invariants for Codex |
| `docs/` | Architecture and feature notes |

## Important validation limits

The project passes JavaScript syntax checks, unit tests, and a browser-simulation smoke test of drawing, color fills, Artist mode, and native save/reopen. Real Apple Pencil responsiveness must still be verified on an iPad. Live Google authorization is controlled by your Google Cloud configuration and was not exercised in the local smoke test.

Licensed under MIT. The previous UI, Pencil event-recovery logic and designer credit are retained.

## Try an example notebook

The file `examples/creative-demo.winds-notes` is an editable sample containing styled filled figures and several Artist brush strokes. Open it with **Open notebook** to try every new feature immediately.

`examples/artist-studio.winds-notes` is a two-page Artist sample: all ten materials with light-to-heavy pressure, plus a graphite study and a colored-pencil botanical drawing. Every mark is an editable stroke. Open it after updating the app to try the new materials.

`examples/artist-studio-pro.winds-notes` contains three editable reference pages for all **25 Artist Studio materials**.
