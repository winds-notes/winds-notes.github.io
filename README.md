## Apple Pencil missing-letter fix (November 2026)

**Root-cause research:** Safari/WebKit on iPad may absorb rapid successive Pencil contacts as a double-tap gesture before delivering `pointerdown` to the page. This exact symptom and a targeted fix are documented at https://github.com/shravanngoswamii/DrawShare/issues/6 . Apple's Scribble recognition has also caused similar missing events: https://bugs.webkit.org/show_bug.cgi?id=217430 . No JavaScript can reconstruct a stroke for which the browser delivers no events.

**Corrections in this build:**

The app no longer automatically forces Stylus-only mode when a Pencil is first detected. Input modes are now explicitly user-selected; palm contacts are still guarded during active Pencil writing.

1. The writing canvas registers *non-passive* `touchstart`, `touchend`, and `touchmove` listeners and cancels the default handling for single-touch contacts. This suppresses native double-tap zoom recognition without disabling the app's two-finger gestures.
2. Each new Pencil down closes a stale previous stroke if its `pointerup` never arrived. The previous stroke is committed rather than discarded.
3. If Safari delivers a pressed Pencil move but misses the down, the app recovers the stroke from that move.
4. **Notebook options → Apple Pencil input test** opens an optional event monitor. Write successive letters and check that the number of `pointerdown` events increases. The panel logs only while open and does not upload data. If entire Pencil strokes still produce zero events, that is a WebKit/iPadOS input suppression problem, not canvas rendering or storage.
5. The offline shell cache is bumped to v7 so GitHub Pages updates are picked up more reliably.

**Verification note:** Automated tests simulate Pencil pointer events and browser touch cancellation, but physical Apple Pencil validation has not been completed. A web app cannot guarantee all physical-Pencil behavior that a native drawing app can, because the native app receives lower-level Pencil events.

---

# WiNDS Notes — Apple Pencil Gesture Recovery Update

**A refined, private handwriting notebook for iPad, Apple Pencil, Android tablets, and desktop browsers.**

WiNDS Notes is a static, deployable, Goodnotes-inspired web app. It runs on GitHub Pages and requires **no build step, API key, account, backend, or external JavaScript library**. Its home dashboard retains the original notebook gallery and introductory design.

## What's new in the WiNDS Notes tablet edition

The handwriting engine was revised to address interruptions and slow writing on iPad:

- **Separate drawing surfaces.** The paper and already-written notes are rendered on the base canvas; the live pen is drawn on a transparent layer. Moving a pen does not cause a full, high-resolution page redraw.
- **Apple Pencil optimized.** Coalesced pen samples use cached page geometry; finishing a letter does not save or re-render the entire page. Palm touches cannot prevent the next Pencil contact.
- **Continuous across pen lifts.** Every letter is displayed on a lightweight ink layer; only the newly drawn strokes are merged into the high-resolution page **after the writing burst ends**. Supported browsers' coalesced pointer samples preserve finer movement and pressure.
- **Save only after finishing writing.** The app buffers edits in memory, writes after **30 seconds without writing**, and also attempts to save when you return to the notebook gallery or leave the app. Export `.winds-notes` regularly as a separate editable copy. No IndexedDB writes are scheduled between letters. **Important:** an app or tab force-quit during the idle interval may lose the last few seconds of work; use the native editable export as a separate backup.
- **Lighter undo.** A normal new stroke is tracked as a single undoable action, without duplicating the full page history after every letter.
- **Lazy thumbnails.** The page thumbnail panel remains hidden while writing; its previews update after a pause if the panel is open.
- **Safer iPad interaction.** Stylus-only mode is a user choice and does not turn on automatically, avoiding rejection if Safari temporarily misclassifies a Pencil contact. A palm touch cannot block a new pen stroke; Pencil contact preempts lingering one-finger pan gestures. Pointer capture and `touch-action: none` protect the drawing surface.
- **Fit moved to the notebook options menu.** The writing surface no longer has a prominent Fit button adjacent to pen settings. Zoom controls remain in the horizontal top toolbar.
- **Branded as WiNDS Notes**, with a custom scalable logo and iPad home-screen icon.

These changes substantially reduce unnecessary work during handwriting, but actual latency varies by iPad model, iPadOS, browser, and the complexity of each page. **The app has not been physically tested on an iPad.**

## Why the missing-letter issue was addressed

Previously, lifting the pen triggered a large canvas commit and queued a storage write after a short timeout; palm contacts could also retain touch-drag state and prevent the next pen-down event. This release keeps completed pen marks on the live-ink layer until you pause for 2.4 seconds and merges just those new marks, without repainting the whole page and delays persistence until you stop writing for 30 seconds, or navigate away. Notes appear on the page immediately and are editable before they are saved to storage. iPad hardware validation is still required.

## Features

- Apple Pencil, active stylus, finger, and mouse input (pressure when supported)
- Pen, highlighter, whole-stroke eraser, selection and movement, text boxes, and basic geometric shapes
- Notebook covers, rename, search, multiple pages, templates (ruled/grid/dots/blank), **portrait and landscape per page**
- Undo/redo, seven pen colors, stroke thickness, zoom, stylus-only mode, page thumbnails
- Import images and annotate them
- Export complete notebook as **PDF**, or the current page as **JPEG** or **PNG**
- **Save the current notebook as `.winds-notes`**, the app's native, editable document format
- **Open notebook** on the home page, or **Notebook options → Open notebook file…** while editing
- Native files retain every page, stroke, text object, image, shape, and paper style, and reopen as fully editable notebooks
- Open an older `.winds-notes` file or a compatible Folio/WiNDS JSON backup without replacing existing notebooks
- Backup/restore all editable notebooks as a **JSON** file
- Private on-device autosaving in IndexedDB, with a localStorage fallback
- Installable, offline-capable progressive web app (PWA)

**Storage and privacy:** Notes reside in the browser on the current device, not on GitHub. There is no cloud synchronization or account system in this version. Browser data can be deleted by Safari/site-data cleanup or device storage management; export editable JSON backups regularly.

## Deploy to GitHub Pages

1. Create a GitHub repository named, for example, `winds-notes`.
2. Upload the **contents** of this folder to the root of its `main` branch: `index.html`, `styles.css`, `app.js`, `native-file.js`, `pdf-export.js`, `sw.js`, `manifest.webmanifest`, `.nojekyll`, and the complete `assets` folder.
3. On GitHub go to **Settings → Pages → Build and deployment**.
4. Choose **Deploy from a branch**, `main`, `/(root)`, then save.
5. Open `https://YOUR-USERNAME.github.io/winds-notes/` when Pages has published.

The app uses relative URLs and works at a GitHub Pages project subpath. The domain must use HTTPS for the home-screen PWA and offline service worker.

Official GitHub guide: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Install on iPad

1. Open the GitHub Pages address in **Safari**.
2. Tap **Share → Add to Home Screen** (menu labels depend on iPadOS version).
3. Launch **WiNDS Notes** from the home screen and start writing with Apple Pencil.
4. If you want fingers to pan instead of drawing, enable **Stylus only** in the horizontal toolbar.
5. Write on the page, not on the toolbar; tap the notebook options (**•••**) to find **Fit page to width**.

To move **one notebook** to another device, open it and select **Export → WiNDS Notes notebook**. Save the `.winds-notes` file to Files, iCloud Drive or another location using Safari's download controls. On another device, tap **Open notebook** on the WiNDS Notes home screen, choose that file, and continue editing. Import creates a new notebook and does not replace existing notes. To transfer **all notebooks**, use **Notebook options → Back up all notebooks** and **Notebook options → Restore notebook backup…** from an open notebook. PDFs and JPEGs are for sharing, not for reopening as editable notes.

## Update from earlier Folio Notes builds

**Export an editable backup from your previous version before updating.**

WiNDS Notes tries to import notebooks from the earlier `folio-notes-v1` IndexedDB store on the **same website origin**. The former Folio Notes JSON backup format is also accepted by WiNDS Notes' Restore and Open notebook functions. If the website moved to a different origin or browser, bring the JSON file across manually. The new app stores notes in `winds-notes-v2`.

When updating GitHub Pages, replace all old files (including `sw.js` and `manifest.webmanifest`). Reload Safari after publishing; if Safari is still showing the old interface, close the installed app and reopen or refresh once while connected. **Do not clear Safari website data to force an update unless you already have a tested JSON backup.**

## Run locally

From this folder:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/` on your computer. Deploy to GitHub Pages for the proper HTTPS iPad experience. Direct `file://` opening is not a supported installation method.

## Limitations

WiNDS Notes is **not Goodnotes itself**. This release does not include cloud sync, PDF import and annotation, handwriting recognition, searchable handwritten notes, real-time collaboration, or audio recording. The eraser removes whole strokes/objects. Switching an existing page orientation scales its content proportionally to keep it visible. The PDF export uses flattened images of pages, so handwriting is not editable in the exported PDF; retain the JSON backup to keep notes editable.

For best results, use a recent iPadOS version and avoid writing on extremely large pages containing thousands of imported objects. Test with a new blank notebook first to confirm input behavior on your device.

## Files

| File | Use |
|---|---|
| `index.html` | WiNDS Notes interface |
| `styles.css` | Layout, brand, writing page and responsive design |
| `app.js` | Input, drawing, pages, notebooks, on-device storage, export |
| `pdf-export.js` | Offline PDF writer |
| `native-file.js` | Native `.winds-notes` document encoding and validation |
| `sw.js` | Offline app-shell cache |
| `manifest.webmanifest` | Installable web app metadata |
| `assets/icon.svg` | WiNDS Notes icon / favicon |
| `assets/apple-touch-icon.png` | iPad/iPhone home-screen icon |
| `.nojekyll` | GitHub Pages static publishing |

MIT licensed. WiNDS Notes is an independent notebook app, not affiliated with Goodnotes.

## Native WiNDS Notes format and opening previous work

**Save:** Inside a notebook, select **Export → WiNDS Notes notebook**. The download uses the extension `.winds-notes`, which contains one complete, editable notebook. No account or server is needed. The download is not just an image of the handwriting: it retains each individual stroke and page object.

**Open:** On the home page, select **Open notebook** and choose an existing `.winds-notes` file from Files (or from a computer folder). There is an equivalent **Notebook options → Open notebook file…** command in the editor. The notebook is added to the library with a new internal ID to avoid overwriting local work. Its pages and content remain editable. Existing `.json` full-library backups from WiNDS Notes and Folio Notes can also be imported with the Open notebook option.

**All-notebook backup:** In any open notebook, choose **Notebook options (•••) → Back up all notebooks** to download `WiNDS-Notes-backup.json`. Choose **Notebook options (•••) → Restore notebook backup…** to restore a previously saved backup; this may replace notebooks with matching internal IDs after confirmation. Use **Open notebook** on the home page to import without replacing existing notebooks.

**File specification:** `.winds-notes` is UTF-8 JSON with `format: "winds-notes"`, `version: 1`, `exportedAt`, `pageSize`, and one `notebook` object. The contents are directly inspectable, including per-stroke points, text, templates, and embedded images. It is not encrypted; keep sensitive documents in a secure location. Maximum opened file size: 100 MB. Older file versions may require a future compatibility update.

On iPadOS, `.winds-notes` is not automatically associated with the PWA. Use the **Open notebook** button inside WiNDS Notes and choose the file through the system picker. Do not expect double-tapping the file in the Files app to launch the website.

## Clean home-page header update

The home screen header is now intentionally minimal: only the WiNDS Notes brand is displayed. The old device-status/privacy message, download/upload shortcuts, and informational footer were removed. Notebook opening remains available as **Open notebook** on the home page. PDF/image/native export is in **Export** inside a notebook. Back up and restore commands remain available under **Notebook options (•••)**. The editor continues to show a short **Saved** status.

## Portrait and landscape

Choose the page orientation when creating a notebook, or open **Page orientation** (horizontal/vertical sheet icon) in the top writing toolbar. Each page can have its own orientation. Newly added pages inherit the current page orientation. Editable `.winds-notes` files preserve the orientation, and a PDF can have portrait and landscape pages in the same document. Switching an already-filled page scales existing content uniformly and centers it to avoid clipping.

## Test the Pencil fix

Open a new blank notebook on iPad and write `Hello Apple Pencil 123` repeatedly while lifting the Pencil after every letter. Try quick letter-to-letter movements, then write with a palm resting on the screen. The app should keep the pen tool selected and render every stroke without a noticeable pause at pen-up. Also verify that after writing and 30 seconds idle the status changes to Saved. Reopen your notebook and confirm content persists. This build has not been measured on physical iPad hardware; real-device confirmation is essential.
