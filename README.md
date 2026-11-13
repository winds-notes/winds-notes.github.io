# WiNDS Notes

**A tablet-first handwriting and drawing application with optional Google Drive storage.**  
Designed by [Alakesh Kalita](https://alakesh-kalita.github.io/).

This is the **complete, editable Codex development workspace**, built from the latest WiNDS Notes Google sign-in edition. It is a static application that runs on GitHub Pages. **No build step, backend, or npm install is required to use the website.** The PDF reader is bundled locally with the app.

Open [Tutorial](tutorial.html) from the library or **Notebook options → Tutorial** for searchable, step-by-step lessons.

## What works

- **Handwriting:** Apple Pencil / stylus / touch / mouse, pressure samples, low-latency ink layer, smooth pen ribbons with rounded ends and continuous pressure widths, undo/redo, eraser and selection.
- **Dark mode (v71):** Choose **Match device**, **Light** or **Dark** with the **Theme** button on the home screen or **Notebook options → Theme**. Only the app around the page turns dark; the paper, ink colours, thumbnails and exports stay exactly the same. The choice is remembered on this device and applies before the first paint.
- **Library extras:** Sort notebooks by *Recently edited*, *Name*, *Newest* or *Oldest*. The library remembers your sort order. **Continue writing** on the home screen opens your last notebook and page for this account in this browser. Press **?** or open **Notebook options → Keyboard shortcuts** for the shortcut list.
- **Notebook menus:** Open **⋯ → Notebook options** and use **Find an action** to find editing, page, import, sync and appearance controls. Use the arrow keys to move through matches and Escape to close. The menu includes page navigation on narrow screens. Rename from the editor or from a notebook card in the library.
- **Input preference:** Stylus only starts enabled. Fingers scroll and pinch; mouse drawing and editing remain available. Turning Stylus only off enables finger drawing and editing, and your explicit choice is remembered in this browser.
- **Two-finger gestures:** pinch zoom and pan (**35%–800%**), preset zoom menu, portrait and landscape notebook pages.
- **Shapes with fills and borders:** Open **Shapes ⌄** to browse 22 figures, including rounded rectangles, polygons, hearts, shields and speech bubbles. Tap **Shapes** or press **R** to use the last chosen shape. Use **Fill settings (⌄)** to choose fill color and opacity, outline color and width (1–32), and solid, dashed, dotted or no outline. Select an existing figure to update its style.
- **Math symbols:** Open **Shapes ⌄ → Math symbols** for stretchable braces, brackets, roots, fraction bars, operators, integrals and set notation. Drag on the page to size a symbol. Use **Select** and the corner handles or **Notebook options → Size and angle** to adjust its width and height independently.
- **Stroke thickness:** Use the toolbar width slider while drawing a shape or after selecting a shape, handwritten stroke, vector path or graph. Thickness changes are undoable.
- **Closed-area color fill:** Select **Fill** once, then keep tapping closed sections. Change color with the adjacent color chip, toolbar swatches or custom palette. The small **⌄ arrow beside Fill** opens opacity, border options and mandalas. Choose another tool or press Escape to finish. Open areas stay unchanged; recoloring and Undo/Redo remain supported.
- **Mandala coloring studio:** 100 designs, including 50 individually composed animal, bird, ocean and Buddha/Zen illustrations with natural anatomy, flowing botanical ornament and coordinated frames, alongside the geometric and floral collections. Includes search and lazy previews. Choose **Fill settings (⌄) → Mandala coloring pages…**, select a design and **Add coloring page**. Each template goes on a new blank page; color its enclosed sections with Fill and use Undo/Redo to try different colors. The local artwork pack is included in offline installation. See the [illustrated-design preview](docs/illustrated-mandalas-preview.png).
- **Artist Studio:** Search 45 materials across Graphite, Ink, Pigment, Paint and Effects. Try calligraphy nibs, watercolor, acrylic, gouache, palette knife, airbrush, splatter and more. Size and Flow update the pressure preview, and strokes remain editable after saving.
- **Text editing and fonts:** Select a text box and tap **Edit text** to change its words, font, size, color, bold/italic/underline, alignment, spacing and width. Works with pasted and typed text, undo/redo, copying and exports. See [Text editing](docs/TEXT_EDITING.md).
- **Copy/paste:** External text and images, editable internal ink/shapes/text/images/stickers, keyboard shortcuts, Copy/Cut selection controls, and a touch paste box with undo/redo. See [Copy and paste](docs/COPY_PASTE.md).
- **Handwriting selection and eraser:** Eraser removes only the brushed area of handwriting, text, images and shapes. Tap Eraser or press E to erase any editable object with your saved size (4–128). Use the small arrow for size settings and optional Ink only protection. Rectangle selection moves/copies/cuts/pastes multiple handwritten strokes. See [Eraser, selection and scrolling](docs/ERASER_SELECTION_SCROLLING.md).
- **Education stickers:** 50 school and study emoji in the Education collection. Use the smiley button to insert, move, resize, rotate or copy them. Available offline.
- **Illustrated stickers:** Open **Stickers → Illustrated** for 127 SVG designs, including cats, woodland and ocean animals, flowers, and school supplies. Browse 24 designs each in **Science**, **Art**, and **Engineering**, or search by subject. The stickers stay sharp when resized and are available offline.
- **Colorable stickers:** Choose **Fill**, pick a color, and tap a colored region of an illustrated sticker. You can undo each region change.
- **Page links:** Select a stroke, text box, sticker, or other object, then choose **Notebook options → Link selection to a page**. Use **Open linked page** on the selection or **Follow links on the page** to tap links directly.
- **Personal page templates:** Use **Notebook options → Page templates** to save the current page and add editable copies to other notebooks. The template library belongs to the current account on this device.
- **Side-by-side PDF study:** Choose **Notebook options → Study beside a PDF**, then pick an imported PDF notebook or import one. Zoom the PDF and writing page independently, or drag the divider to resize the panes. Drag a box around a figure and drop it onto the notebook or choose **Insert figure** to add it with a link to its source page.
- **Presentation:** Choose **Notebook options → Present notebook**. Use **Present here** or open a separate projector window. Hide page objects and reveal them in layer order, or point on the preview to show a temporary laser mark.
- **Notebook workflow:** Multiple notebooks/pages, text, stickers, imported images with **resizable corner handles and exact width controls**, templates, local autosave and export/import in editable `.winds-notes` format. Delete any page with **Delete** beside its heading, or **Notebook options → Delete current page…**. Deletion asks for confirmation; the last page is protected.
- **Selection and dragging:** Selection follows shape geometry with a consistent screen-sized hit area across zoom levels. Object moves and resizing use a cached preview, then commit one undoable change. Tap outside a handwriting group with Select to choose another object.
- **PDF annotation:** Import selected PDF pages into a new or existing notebook, then write, highlight, draw or add text over fixed page backgrounds. Supports password-protected PDFs, mixed page orientations, offline use and annotated exports.
- **Interactive graphs:** Choose **Notebook options → Insert → Insert graph**, enter an equation such as `y = ax²`, and set the axis ranges. Select the graph to adjust its parameter or reopen the equation editor. Write over it with Pen. Editable notebooks preserve the equation and slider, and PDF and image exports capture the visible curve.
- **Vector paths:** Choose **Shapes ⌄ → Draw vector path**. Tap to place anchors, drag from a new anchor for a Bézier curve, and adjust existing anchors or their handles. Use **Snap to grid** or the X and Y fields for precise placement. Select a path to edit it or use **Export → Selected vector path** to download an SVG.
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

Browser export checks must disable file downloads or set `Browser.setDownloadBehavior` to an isolated temporary directory before testing exports. Inspect prepared blobs in-page when possible; do not use Chrome’s default Downloads folder for generated test notebooks.

To work with the **Codex CLI**, open this folder in your terminal or IDE and run Codex from the project root (with Codex installed and authenticated):

```bash
cd winds-notes-codex
codex
```

Codex instructions are in **`AGENTS.md`**. Suggested first task: *"Review the Apple Pencil event-handling invariants in AGENTS.md, then improve Artist brush texture and shape resize UX while keeping rapid Pencil strokes smooth. Add tests."*

## Using the new features

**Annotate a PDF:** On the home page choose **Import PDF**, or in an open notebook choose **Notebook options → Import PDF pages…**. Select pages such as `1-5, 8`, then create a notebook or append to the current one. Use the existing Pen, Artist, Highlighter and Text tools. The eraser removes your marks while the PDF background stays fixed. Export an annotated PDF or an editable `.winds-notes` copy. PDF text, links and form controls are flattened into page images; the source file is unchanged. Limits: **25 MB per source PDF, 50 selected pages per import**. See [PDF annotation](docs/PDF_ANNOTATION.md) for quality, storage and sharing details.

**Drawing width:** New pen strokes and shape outlines start at **7**. The thickness controls still support 1–32; existing saved strokes keep their original widths.

**Filled figures:** In the editor's horizontal toolbar, click the **⌄ arrow beside Fill** → enable solid fill → choose fill color and opacity, then choose a separate border color, line width (up to 32) and border style. Draw a Square or Star. To edit an existing figure, choose **Select**, tap it, open **Fill settings (⌄)** and change fill/border properties. Line and Arrow remain unfilled (but can have outline styles).

**Artist Studio:** Click **Artist**, browse **Graphite (12)**, **Ink (6)** or **Pigment (7)**, then choose a material. Set **Size (1–32)** and **Flow (10–100%)** for future strokes; width starts at 7. The large sample shows light-to-firm pressure. Technical Pen keeps a constant width, Fountain Pen and Ink Brush respond expressively, while charcoal, dry brush, pastel and chalk use distinct textures. Color applies to ink and pigments; graphite and charcoal keep their natural shades. Regular **Pen** returns to handwriting. Existing strokes retain their previous appearance. See [Artist Studio](docs/ARTIST_STUDIO.md).

**Choose your color:** The extra color palette contains filled light-color cells. Choosing another color replaces the previous selection and updates the current-color preview. Stronger writing colors remain available in the main toolbar.

**Resize images and smileys:** Import an image or insert an emoji, then choose **Select** and tap the object. Drag one of its four corner handles to resize, or choose **Notebook options → Size and angle** for an exact width. Images preserve their aspect ratio. Stickers have a square selection frame centered on the visible icon. Shapes also support corner resizing.

**Rotate an object:** Choose **Select**, tap an image, smiley or shape, then drag the round handle just below the bottom-right corner. Hold Shift to snap to 15° increments. The **Angle** field and 90° buttons are in **Notebook options → Size and angle**.

**Crop images:** With an image selected, tap the round crop button beside it. Drag a corner or edge of the frame on the page, or drag inside the frame to reposition it. The shaded area will be removed from view. Choose **Apply crop**, **Cancel** or **Reset**. Expand **Exact crop** to enter percentages. The original image is retained for later adjustments.

**Zoom:** Pinch with two fingers, tap ±, or tap the **zoom percentage** for presets from 50% through 800%. Zoom is only a viewing setting and does not change the saved page dimensions.

**Open/edit later:** Export → **WiNDS Notes notebook** downloads `.winds-notes`. Use **Open notebook** from the dashboard to reopen an editable copy.

**Recover notes:** **Open notebook** and **Notebook options → Restore notebook backup…** both validate the entire file before adding editable copies with fresh IDs. Existing notebooks are never replaced, even when a backup contains matching IDs. Older WiNDS and Folio JSON backups remain supported. A fresh workspace starts with one blank **Untitled notebook**; the original app design is preserved.

## Deploy on GitHub Pages

The repository root itself is the **deployable website**. Commit or upload `index.html`, `tutorial.html`, `privacy.html`, `terms.html`, `LICENSE`, all root `.js`/`.css` files (including `mandala-art.js`, `mandala-tools.js`, `boundary-fill.js`, `eraser-preview.js`, `text-tools.js`, `clipboard.js`, `pdf-import.js` and `legal.css`), `manifest.webmanifest`, `.nojekyll`, `assets/` and the **complete `vendor/pdfjs/` directory** to the root of the website repository. Preserve the vendor fonts, CMaps, WASM and licenses, including filenames beginning with underscores. In GitHub, choose **Settings → Pages → Deploy from a branch → main / (root)**.

If you publish by replacing GitHub files, upload all updated files together, including **workspace-model.js**, **selection-preview.js** and the complete **assets/mandalas/** folder (all 50 artwork `.js` files). Service-worker cache **v72** includes the local PDF reader and the full illustration pack; every local script and stylesheet URL carries the same `?v=72` release (keep `RELEASE` in `sw.js` and `index.html` in step). Also upload **theme.js** and **dark.css**. After editing `styles.css`, run `npm run build:dark` to regenerate `dark.css` (a test checks it). Updates reuse the unchanged v65 artwork already cached on this device. The first offline installation downloads the artwork pack; afterward it is available without a connection. Existing coloring pages retain their saved artwork; add a new coloring page to use a revised design. All collaborators should update before using PDF notebooks. Back up important notebooks as `.winds-notes` before updating the deployed app. **Do not clear Safari website data** without a backup.

## Share a notebook

In **My notebooks**, tap a notebook's **three-dot Actions menu → Share notebook…**, enter the collaborator's Google account email and choose **Share and send invitation**. Only that notebook is shared with editing access. The recipient can use the emailed invitation or sign in and choose **Open shared from Drive** to see a list of shared notebooks. Both people can write and retrieve each other's saved changes automatically while their private notebooks stay separate.

Shared notebooks show a Shared label. Their menu retains **Remove from my library**; the owner manages/revokes Drive permissions in the dedicated shared notebook folder. See [Notebook sharing](docs/NOTEBOOK_SHARING.md) for deployment files, OAuth/test-user requirements, offline recovery and editing limitations. Real Google delivery and recipient access still need deployment verification.

## Google Drive configuration and privacy

The Google OAuth Web client ID is a **public identifier**; it is in `google-config.js` so this static GitHub Pages app can initiate authorization. **No OAuth client secret, access token or refresh token is committed.** The Google Picker browser API key is public by design and must have website and API restrictions in Google Cloud Console. Sign-in still requires correct Google Cloud Console settings: permitted website origin, external OAuth audience/test users or public production status, enabled Google Drive API and appropriate scopes. For a different domain, add the exact origin in Google Cloud Console. To test Google sign-in locally, authorize `http://localhost:5173` as another JavaScript origin; otherwise use the deployed GitHub Pages URL.

**OAuth policy links:** The public `privacy.html` and `terms.html` pages describe this app's data practices and service terms, with links from the homepage and Drive dialog. Publish them with `legal.css` and confirm the contact information before submitting them to Google. For an app at `https://winds-notes.github.io/`, enter `https://winds-notes.github.io/privacy.html` as the Application privacy policy link and `https://winds-notes.github.io/terms.html` as the Application terms of service link. If the app uses a repository subpath or another domain, use that same base URL for both pages. They must be reachable publicly without sign-in; these URLs become live only after deployment.

Each signed-in user's Drive files belong to that Google account, not to a shared developer account. Local guest data is separate. Network saves do not run inside the active Pencil input handlers. Each account keeps its own private workspace. Selected notebooks can be shared explicitly with another Google account for viewing and editing; shared changes synchronize after writing is idle. This does not provide real-time cursors or perfect reconciliation of simultaneous edits to the same object.

**Fast automatic Drive synchronization:** Automatic sync is enabled by default for each account. Edits save locally after a **2.5-second pause in writing**, then queue for upload immediately. Incoming changes are checked automatically every **1 second** while the app is visible and idle, with immediate checks on opening, returning to the app or reconnecting. Same-account tabs notify one another after a completed upload so they can retrieve changes without waiting for the next poll. Once the workspace file is known, checks request only its metadata rather than searching dated backups. No manual Sync or page refresh is needed. A new stroke, text edit or pinch gesture postpones remaining parsing, merging, canvas refreshes and uploads until idle again. Polling includes time already spent on the request, and a receiving device saves incoming changes without uploading the same data again. Individual edits and causally tracked deletion markers merge automatically; an old copy cannot replace a whole notebook merely because its device timestamp is later. Conflicting simultaneous edits are retained in **sync recovery** notebooks. Protected Drive versions recover overlapping uploads. Update all devices to use this protection. Unchanged workspaces are not repeatedly downloaded or uploaded, and failed requests retain their retry delay. The target for a small workspace on two visible, idle devices is roughly 3–5 seconds from the final stroke to retrieval, rather than an upload-only timing. Actual transfer time depends on connection speed, Drive response time and notebook size; active writing, background tabs and failed requests can take longer. Open Google Drive to check the automatic-sync setting and last successful upload time; explicit pause remains supported.

**Priority sync and visibility:** Automatic sync checks the open shared notebook first, then the private workspace, and rotates through one other shared notebook per cycle. Shared edits are merged into the original notebook file after checking its current Drive version. Manual sync still checks every shared notebook. In Google Drive, expand **Sync details** for this tab's last workspace check, received change, successful upload, sync mode and cycle duration. This duration describes one completed check/transfer cycle, not the full time from writing on another device. See [Sync performance](docs/SYNC_PERFORMANCE.md) for controlled timings and limits.

**Reduce private workspace upload size:** Update every device to v77 or newer and enable **Google Drive → Compress Drive workspace uploads** on each browser you write from. The next edit syncs automatically. Check **Sync details → Last workspace upload size** to see the size sent and the original size when compression saved space. The setting is per account and browser. It applies to the private workspace, and savings depend on its contents.

**Persistent login:** The account workspace is remembered across refreshes, new tabs and closing the browser. On static hosting, each account's short-lived Drive credential is saved in this browser's localStorage and reverified with Google on reopening. Its expiry is never extended, so static GitHub Pages hosting still requires renewed Drive authorization after Google expires the token. Credentials are never included in notebook files or source control.

**Offline copy:** Online devices always load the newest files; the offline cache is used only without a connection. Saves started while a page closes or reloads commit immediately, and a reload or an iPad tab discard reopens the notebook and page you were on.

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
| `text-tools.js` | Shared text layout/font renderer and text editing dialog |
| `clipboard.js` | Scoped editable clipboard, system clipboard and touch paste fallback |
| `native-file.js` | `.winds-notes` validation, imports and serialization |
| `cloud-drive.js` | Google OAuth, per-account Drive logic and protected upload recovery |
| `workspace-model.js` | Causal private-notebook merging and conflict recovery |
| `notebook-sharing.js` / `shared-notebook-model.js` | Per-notebook Drive invitations, durable outgoing edits and shared history replay |
| `live-sync.js` / `server/live-relay.mjs` | Optional authenticated, temporary live-ink previews |
| `Dockerfile` / `compose.yaml` | Same-origin server package with persistent encrypted sessions |
| `google-config.js` | Public OAuth Web client ID only |
| `pdf-export.js` | PDF writer |
| `pdf-import.js` / `vendor/pdfjs/` | Local PDF import dialog and bundled Mozilla PDF.js reader |
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

`examples/artist-studio-pro.winds-notes` contains three editable reference pages for the original 25 Artist Studio materials.

`examples/pdf-annotation-demo.pdf` is a small three-page worksheet for trying PDF import, handwriting and highlights, with portrait, landscape and rotated pages.

**Page scrolling:** Notebook pages form a continuous vertical stack in the writing workspace. Choose the hand tool or **Notebook options → Scroll pages…** to drag between pages without drawing. Tap **Pen** to write; page headings activate/focus a page. Only nearby inactive page previews are rendered.

**Notebook scrolling:** A notebook's three-dot **Scroll pages…** action opens the same continuous workspace with the hand tool selected. It works with handwritten pages, PDFs and mixed notebooks.

**Sharing access recovery:** A Drive “File not found” response now opens account/access recovery with a direct Drive check, authorization and retry. If Google requires app authorization, enable Google Picker API and add your project's public browser key in `google-config.js`. See [Sharing recovery and setup](docs/NOTEBOOK_SHARING.md#google-picker-configuration-needed-for-the-authorization-button). The source includes the full recovery flow; no project-specific key or real-account verification is supplied.
