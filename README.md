# WiNDS Notes — Smooth Ink & Personal Drive Edition

**Designed by [Alakesh Kalita](https://alakesh-kalita.github.io/)**

A static, tablet-first note-taking website for Apple Pencil, styluses, fingers, and mouse input. Built for GitHub Pages. No backend, database server, or build step is needed for local note taking.

## Features

- Pressure-aware, quadratic-curve handwriting with rapid Apple Pencil pen-up recovery and iPad Safari gesture suppression.
- **Pinch with two fingers on the page** to zoom from 50–350%; move both fingers together to pan. It works with or without Stylus-only mode. The page redraws at higher resolution only when the pinch finishes.
- Horizontal toolbar, ruled/grid/dot/blank paper, portrait/landscape pages, pen, highlighter, eraser, selection, text, lines, shapes, stickers, images, many colors, and custom color picker.
- Per-notebook and per-page management, offline local save, undo/redo, and exports to editable `.winds-notes`, PDF, JPEG and PNG.
- Optional **Google sign-in with personal Google Drive workspace and idle-only sync**. Each Google account has a distinct local IndexedDB workspace and an app-created `WiNDS Notes Workspace.json` file in **that account's own Drive**.
- Google Drive dated backups and import-as-new-notebook copies.

## Deploy on GitHub Pages

1. Create a GitHub repository called `winds-notes` (or reuse your existing repository).
2. Upload **all files and the `assets` folder** from this ZIP to the repository root.
3. In GitHub, select **Settings → Pages → Deploy from a branch → main → /(root)**.
4. Open `https://YOUR-USERNAME.github.io/winds-notes/` once Pages finishes publishing.
5. On iPad, open in Safari and use Share → Add to Home Screen if you prefer the app-style experience.

The application works without a Google sign-in setup: local notebooks and all exports remain available.

## Enable Google sign-in and user-owned Drive storage

A single **public Web OAuth Client ID** is used by the entire website. **Every user signs in with their own Google account**; the OAuth access token belongs to that user. Notebook files are created under their own Google Drive, *not* under the website creator's Drive and not under a shared 'client endpoint'.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. Enable **Google Drive API**.
3. Configure the Google Auth platform **Branding / Audience / Data Access** settings. Select External if the app should support users outside your Google Workspace. Add scopes `openid`, `email`, `profile` and `https://www.googleapis.com/auth/drive.file` as required. Publish the app when ready, and complete any Google verification steps applicable to your OAuth consent screen. While testing, allow the necessary test-user accounts.
4. Create an OAuth client of type **Web application**. Add your exact GitHub Pages **Authorized JavaScript origin** — for example, `https://alakesh-kalita.github.io` (no path suffix). Add other origins if you host elsewhere.
5. Paste only the client ID into `google-config.js`:

   ```js
   window.WINDS_GOOGLE_CLIENT_ID = 'YOUR_PUBLIC_CLIENT_ID.apps.googleusercontent.com';
   ```

6. Publish the edited file to GitHub Pages. Open the WiNDS Notes home page and select **Google Drive → Sign in with Google**. Approve the requested permissions.

**Do not add a Google OAuth client secret, private key, service-account credentials, or refresh token to GitHub Pages.** This app uses Google's browser token flow and never handles the user's password. The access token lives only in browser memory. Reconnecting may be needed after reload or token expiry.

Official docs: [Google Identity Services for Web](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [Google Drive file ownership](https://developers.google.com/workspace/drive/api/guides/create-file), [Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

## How account separation works

| Session | Device storage | Google Drive |
| --- | --- | --- |
| Not signed in | Original local `winds-notes-v2` guest database | None |
| Signed in as Account A | `winds-notes-account-g-{GoogleAccountID}` | Account A's app-created files |
| Signed in as Account B | A *different* IndexedDB database | Account B's app-created files |

Opening a Google account **does not upload the guest notebook library** or reveal Account A's local notes to Account B. Export `.winds-notes` from the guest workspace, sign in to the intended account, and import those files if you want to transfer them. Account local storage is separated for normal app use, but **it is not encrypted against a person who can access the same device and browser profile**.

Cloud sync uploads a compact JSON workspace snapshot when writing and local saving are idle. You may also select **Sync notebooks now**. The workspace file appears in the authorized user's own My Drive; the app uses the limited `drive.file` permission, so it cannot search or modify arbitrary personal Drive files.

Changes on different devices are merged by notebook identifier and modification time. **This is eventual sync, not simultaneous collaborative editing.** Avoid editing the same notebook simultaneously on two devices: later changes to the same notebook can take precedence. Export `.winds-notes` backups of important work regularly. For a second device, sign in to the same Google account and keep the app open long enough to finish syncing. Sync runs only while the website is open and authorized; leaving the app immediately after writing can defer cloud upload until the next visit.

Dated Drive backups remain separate from the synced workspace. Imports create new editable notebook copies without overwriting existing notebooks.

## Handwriting and pinch tips

- Use Pen for handwriting; the smooth vector-derived rendering is used both for live ink and in PDF/JPEG exports.
- Quickly lifting and lowering Apple Pencil is supported; the previous Safari pointer recovery and browser gesture suppression remain in place.
- Pinch **on the notebook page** with two fingers. Opening the page in an embedded browser may behave differently than Safari.
- When Stylus-only is enabled, one finger pans; two fingers pinch and pan in either mode.
- Saved handwriting remains editable via `.winds-notes`. Importing does not flatten strokes into an image.

## Data and update safety

Before installing updates, **export a `.winds-notes` file for important notebooks**, and optionally a full JSON backup. Replacing website files should not erase data on the same origin, but clearing Safari website data, switching browser profiles, or changing the GitHub Pages origin can remove local storage.

The app's service-worker cache version is updated with each release. To load an update on iPad, close the home-screen app and reopen while online. Avoid clearing website data to force a refresh.

## Local testing

The app is static: it can be served with `python3 -m http.server 8000` or uploaded to GitHub Pages. Testing Google OAuth requires an **HTTPS origin registered in Google Cloud**, so it cannot be validated end-to-end by simply opening `index.html` as a local file.

Code and browser-simulated tests for this release cover JavaScript syntax, 100 separate strokes, 2-finger zoom, guest/account A/account B isolation, mocked Drive backup/sync, and account reconnection. **Actual Apple Pencil hardware performance and live Google authorization must be verified on your iPad and production Google Cloud project.**

## License

See `LICENSE`.
