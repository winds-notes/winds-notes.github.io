# WiNDS Notes

**A tablet-first handwriting and drawing application with optional Google Drive storage.**  
Designed by [Alakesh Kalita](https://alakesh-kalita.github.io/).

This is the **complete, editable Codex development workspace**, built from the latest WiNDS Notes Google sign-in edition. It is a static application that runs on GitHub Pages. **No build step, backend, or npm dependency is required to use the website.**

## What works

- **Handwriting:** Apple Pencil / stylus / touch / mouse, pressure samples, low-latency ink layer, stroke smoothing, undo/redo, eraser and selection.
- **Two-finger gestures:** pinch zoom and pan, portrait and landscape notebook pages.
- **Shapes with fills:** Rectangle, exact Square, Ellipse, exact Circle, Triangle, Diamond, Star. Choose a custom fill color and opacity while keeping an independent outline color; existing shapes can be recolored using Select.
- **Artist mode:** Open **Artist** in the top toolbar and choose **HB**, **2B**, or **4B** graphite pencils. Pressure changes width and darkness; all artwork stays editable.
- **Notebook workflow:** Multiple notebooks/pages, text, stickers, image imports, templates, local autosave and export/import in editable `.winds-notes` format.
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

Codex instructions are in **`AGENTS.md`**. Suggested first task: *"Review the Apple Pencil event-handling invariants in AGENTS.md, then improve graphite pencil realism without adding any synchronous work to pointermove or pointerup. Add tests."*

## Using the new features

**Filled figures:** In the editor's horizontal toolbar, click **Fill** → enable solid fill → choose a color, opacity and shape (e.g. Square or Star). Draw. To recolor a shape you've already drawn, tap **Select** → tap the shape → **Fill** → change settings. Line and Arrow stay outline-only.

**Artist pencils:** Click **Artist** and choose HB (light), 2B (soft/darker) or 4B (darkest). The pen thickness slider still applies. Click the regular Pen to return to colored handwriting.

**Open/edit later:** Export → **WiNDS Notes notebook** downloads `.winds-notes`. Use **Open notebook** from the dashboard to reopen an editable copy.

## Deploy on GitHub Pages

The repository root itself is the **deployable website**. Commit or upload `index.html`, all `.js`/`.css` files, `manifest.webmanifest`, `.nojekyll`, and `assets/` to the root of the website repository. In GitHub, choose **Settings → Pages → Deploy from a branch → main / (root)**.

If you publish by replacing GitHub files, ensure the new `creative-tools.js` is included. `sw.js` has an updated cache version so returning visitors can receive the new app shell. Back up important notebooks as `.winds-notes` before updating the deployed app. **Do not clear Safari website data** without a backup.

## Google Drive configuration and privacy

The Google OAuth Web client ID is a **public identifier**; it is in `google-config.js` so this static GitHub Pages app can initiate authorization. **No OAuth client secret, Google API key, access token or refresh token is committed.** Sign-in still requires correct Google Cloud Console settings: permitted website origin, external OAuth audience/test users or public production status, enabled Google Drive API and appropriate scopes. For a different domain, add the exact origin in Google Cloud Console. To test Google sign-in locally, authorize `http://localhost:5173` as another JavaScript origin; otherwise use the deployed GitHub Pages URL.

Each signed-in user's Drive files belong to that Google account, not to a shared developer account. Local guest data is separate. Network saves do not run inside the active Pencil input handlers. This is **single-user workspace sync/backup**, not real-time collaborative editing and not a backend that can reconcile simultaneous edits perfectly.

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

The file `examples/creative-demo.winds-notes` is an editable sample containing filled shapes and HB/2B/4B strokes. Open it with **Open notebook** to try every new feature immediately.
