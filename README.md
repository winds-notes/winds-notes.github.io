# WiNDS Notes

**A tablet-first handwriting and drawing application with optional Google Drive storage.**  
Designed by [Alakesh Kalita](https://alakesh-kalita.github.io/).

This is the **complete, editable Codex development workspace**, built from the latest WiNDS Notes Google sign-in edition. It is a static application that runs on GitHub Pages. **No build step, backend, or npm dependency is required to use the website.**

## What works

- **Handwriting:** Apple Pencil / stylus / touch / mouse, pressure samples, low-latency ink layer, smooth pen ribbons with rounded ends and continuous pressure widths, undo/redo, eraser and selection.
- **Two-finger gestures:** pinch zoom and pan (**35%–800%**), preset zoom menu, portrait and landscape notebook pages.
- **Shapes with fills and borders:** Rectangle, exact Square, Ellipse, exact Circle, Triangle, Diamond and Star. Choose separate fill color/opacity, **outline color**, **outline thickness (1–32)** and **solid/dashed/dotted/no-outline** styles. Existing figures can be updated using Select → Fill.
- **Artist mode:** 10 pressure-aware tools: **2H, H, HB, B, 2B, 4B, 6B, Charcoal, Ink Brush, and Color Pencil**. Brush strokes remain editable and export with their chosen style.
- **Notebook workflow:** Multiple notebooks/pages, text, stickers, imported images with **resizable corner handles and exact width controls**, templates, local autosave and export/import in editable `.winds-notes` format.
- **Sharing:** PDF, JPEG, PNG and JSON backups.
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

**Filled figures:** In the editor's horizontal toolbar, click **Fill** → enable solid fill → choose fill color and opacity, then choose a separate border color, line width (up to 32) and border style. Draw a Square or Star. To edit an existing figure, choose **Select**, tap it, reopen **Fill** and change fill/border properties. Line and Arrow remain unfilled (but can have outline styles).

**Artist pencils:** Click **Artist** to see actual brush previews and choose 2H/H (fine detail), HB/B/2B/4B/6B (progressively softer graphite with paper grain), Charcoal (broad, broken texture with soft edges), Ink Brush (continuous pressure-controlled ribbons) or Color Pencil (layered colored pigment). Pressure changes both width and pigment strength where supported. Use the 1–32 line-thickness control as needed. Click regular **Pen** to return to handwriting. Texture remains consistent across the editor, thumbnails, exports and native-file reopening.

**Choose your color:** The extra color palette contains filled light-color cells. Choosing another color replaces the previous selection and updates the current-color preview. Stronger writing colors remain available in the main toolbar.

**Resize images and smileys:** Import an image or insert an emoji, then choose **Select** and tap the object. Drag one of its four corner handles to resize, or use the floating **Width** control / ± buttons for exact sizing. Images preserve their aspect ratio, while smileys stay square. Shapes also support corner resizing.

**Rotate images and smileys:** Choose **Select** and tap the image or smiley. Use **↶ / ↷** in its floating controls to rotate by 90°, or enter an exact **Angle**. Enter **0** to straighten it. Rotation supports undo/redo, resizing, image cropping, save/reopen and exports.

**Crop images:** Choose **Select**, tap an added image and choose **Crop** in its floating controls. Drag the crop corners or enter percentages; drag inside the selection to move it. **Apply crop** updates the image; **Cancel** leaves it unchanged. **Reset → Apply crop** restores the full image. Crops support undo/redo, resizing, native files, backups, Drive workspace data and every export format. The original image is retained so you can adjust the crop later.

**Zoom:** Pinch with two fingers, tap ±, or tap the **zoom percentage** for presets from 50% through 800%. Zoom is only a viewing setting and does not change the saved page dimensions.

**Open/edit later:** Export → **WiNDS Notes notebook** downloads `.winds-notes`. Use **Open notebook** from the dashboard to reopen an editable copy.

**Recover notes:** **Open notebook** and **Notebook options → Restore notebook backup…** both validate the entire file before adding editable copies with fresh IDs. Existing notebooks are never replaced, even when a backup contains matching IDs. Older WiNDS and Folio JSON backups remain supported. A fresh workspace starts with one blank **Untitled notebook**; the original app design is preserved.

## Deploy on GitHub Pages

The repository root itself is the **deployable website**. Commit or upload `index.html`, all `.js`/`.css` files, `manifest.webmanifest`, `.nojekyll`, and `assets/` to the root of the website repository. In GitHub, choose **Settings → Pages → Deploy from a branch → main / (root)**.

If you publish by replacing GitHub files, ensure the updated `creative-tools.js` is included. `sw.js` has an updated cache version so returning visitors can receive the new app shell. Back up important notebooks as `.winds-notes` before updating the deployed app. **Do not clear Safari website data** without a backup.

## Google Drive configuration and privacy

The Google OAuth Web client ID is a **public identifier**; it is in `google-config.js` so this static GitHub Pages app can initiate authorization. **No OAuth client secret, Google API key, access token or refresh token is committed.** Sign-in still requires correct Google Cloud Console settings: permitted website origin, external OAuth audience/test users or public production status, enabled Google Drive API and appropriate scopes. For a different domain, add the exact origin in Google Cloud Console. To test Google sign-in locally, authorize `http://localhost:5173` as another JavaScript origin; otherwise use the deployed GitHub Pages URL.

Each signed-in user's Drive files belong to that Google account, not to a shared developer account. Local guest data is separate. Network saves do not run inside the active Pencil input handlers. This is **single-user workspace sync/backup**, not real-time collaborative editing and not a backend that can reconcile simultaneous edits perfectly.

**Refresh, new tabs and reconnect:** A short-lived Drive access token is kept in each tab's `sessionStorage`. A new tab remembers the last selected account and can obtain its still-valid connection from another open WiNDS tab in the same browser, then verifies the identity with Google before syncing. Tokens are not saved in localStorage, notebook files or the repository; localStorage remembers only the account profile. Existing tabs keep their own account when another tab switches accounts. If the token expires, is rejected, or no connected tab is available, the account's local notebooks remain open and **Reconnect Google Drive** resumes sync. **Sign out / open guest notes** clears recovery for that account and pauses Drive access in its other open tabs without interrupting their writing. Google may still require a reconnect click after all connected tabs close because this static app has no backend to refresh authorization automatically.

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html` | Home page, editor toolbar and menus |
| `styles.css` | Visual design and responsive iPad/phone layout |
| `app.js` | Notebook UI, pointer/gesture input, local storage and exports |
| `creative-tools.js` | Figure geometry/fills and artist graphite rendering (independently testable) |
| `native-file.js` | `.winds-notes` validation, imports and serialization |
| `cloud-drive.js` | Google OAuth and per-account Drive workspace logic |
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
