# Latest verification — v66

Stylus only now starts enabled, keeps mouse drawing/editing available, and remembers an explicit finger-input choice in this browser. Pencil detection does not change that choice. Selection uses a screen-sized hit tolerance and actual shape geometry. Select can leave a handwriting group, and an older queued area result cannot replace a newer selection.

Object moves/resizing sample coordinates without copying the page or recording history in pointer callbacks. The new selection-preview.js builds bounded lower/sprite/upper layers once per gesture and composites swept patches in animation frames, retaining stacking, rotation and eraser masks. The notebook receives one deferred, undoable change after active input ends. A clipped vector fallback remains available if preview allocation fails. Cancelled finger transforms roll back; missing Pencil/mouse releases preserve sampled movement. A delayed lostpointercapture event was reproduced ending a fresh mouse drag before its first move. Selection capture now ignores stale loss or recovers active capture, and canvas capture loss cannot end a contact owned by the floating rotation handle.

`npm run check` passes all 332 tests. Coverage includes cached-layer order and bounded memory, zero per-frame page scans for movement, event coalescing, draft-only resizing, image aspect ratio, masks/pressure/artist metadata, one undo snapshot, queued move deltas, new ink preservation, account/page cancellation, stale selection generations, capture recovery, mouse selection with Stylus only enabled, finger panning, input-preference restore and geometry hits at high zoom. Offline checks cover both copying all 50 unchanged artwork files from the old cache and limiting cold artwork requests to two.

Chrome verification used an isolated guest notebook with 800 dense strokes, a mandala, a rotated erased image, an overlapping upper shape, text and a diagonal line. Pixel checks confirmed the image moved before commit, its previous location left no ghost, and the upper object remained above it. Image/handwriting/text moves, a rotated image resize with fixed opposite anchor, Undo/Redo, completed saving, native version-1 roundtrip and reload passed. The cached-path instrumentation recorded 184 selection callbacks, four preview preparations and 81 preview paints, with zero callback serialization, database transactions or network calls and zero full-page repaints while holding the contact. A missing-preview-module fallback still moved text; a cancelled finger drag left its saved position unchanged. Stylus-only default, explicit preference persistence, one-finger panning and two-finger pinch were verified.

Twenty separate simulated Pencil strokes, including a 256-sample long stroke, were preserved after saving. Drawing/eraser missing-up/down recovery, palm takeover and touch/pinch blocks match v65; all four non-passive Touch Event handlers remain. No uncaught browser errors or download events occurred; downloads stayed disabled.

Physical iPad/Apple Pencil testing was unavailable, so this does not establish physical-device latency. Google authorization and production sync latency were not changed or retested. Native format version 1 and account workspace keys are unchanged. Existing mandala artwork remains versioned v65 and is reused during the v66 offline update.

# Latest verification — v65

Replaced all 50 illustrated mandalas with individually composed animal, bird, ocean and Buddha/Zen line art. The 100-design catalog and existing design IDs remain stable. The 50 original geometric/floral renderers are unchanged. All new illustrations were reviewed as a complete contact sheet and all 25 animals were reviewed separately. Source PNG-to-WebP comparisons confirmed identical RGBA pixels for every illustration, including transparency. Runtime artwork uses script-wrapped WebP data URLs so direct local-file loading keeps the canvas exportable.

The reported live-site insertion failure was diagnosed by reading the public deployed files: the v64 loader requested artwork files that returned HTTP 404. No GitHub files were changed. The complete v65 deployment package includes all 50 assets/mandalas/*.js files and matching versioned root scripts. A second failure was reproduced when a locally opened page drew a file:// WebP directly: canvas.toDataURL threw a tainted-canvas exception. The data-URL loader fixes that local-file path; lion-page insertion was verified from both localhost and a directly opened index.html.

`npm run check` passes all 316 tests. New checks cover request deduplication, serialized decoding, a bounded six-image cache, prepared records surviving eviction, retry after failure, account changes while artwork loads, all fifty distinct valid packed assets, and complete offline asset coverage. The app diff is limited to preparing the artwork and passing its prepared record to the mandala renderer. Existing Pencil handlers, gesture suppression, artist rendering and object-editing code match v63.

Chrome rendered all 100 designs as distinct transparent bitmaps. Each of the 50 illustrations had at least 30 bounded regions at 256px (observed 333–849). Every animal design was individually added to a fresh test notebook; generated pages were removed between cases only inside the temporary browser profile. The full smoke check covered lazy previews, collection/search filters, empty results, Buddha spelling aliases, adding a Buddha page after five separate pen strokes including a longer stroke, coloring two sections, persistent Fill, Undo/Redo, native-file roundtrip, completed saving and reload, and the 390×844 gallery layout. After all 50 runtime assets were cached, network access was disabled and a lion page was successfully added and saved offline. No uncaught browser errors or download events occurred; downloads remained disabled.

Physical iPad/Apple Pencil testing was unavailable. Production Google authorization and sync latency were not changed or retested. Existing colored pages retain their baked artwork and colors; adding a new page uses the revised illustration.

# Latest verification — v63

Added 50 intricate illustrated mandalas, bringing the library to 100: 25 animal portraits, eight birds, seven ocean subjects and ten Buddha/Zen compositions. These include lions, elephants, wolves, pandas, peacocks, owls, sea turtles, koi, seated Buddha figures, a Buddha portrait, a Bodhi tree, Dharma wheel, knot and temple. Their outlined centerpieces have patterned interiors and closed ornamental borders. A preview of all 50 new artworks is included at illustrated-mandalas-preview.png.

`npm run check` passes all 311 tests. Checks cover 100 unique deterministic path compositions, finite geometry, balanced transforms, collection counts, native compatibility and existing editor behavior. A separate comparison confirms every previous mandala retains identical path commands; app.js and the existing artist renderer are unchanged.

Chrome rendered 100 distinct transparent bitmap outputs and checked bounded coloring regions. Each of the 50 new illustrations passed the minimum 30-region check. All new artwork was visually reviewed as a contact sheet. Browser verification covered lazy previews, the Animals collection, elephant search, Buddha spelling aliases, empty-result disabling, adding Buddha in Meditation after a page with five separate pen strokes, independently coloring two sections, persistent Fill, Undo/Redo, native-file roundtrip and completed save/reload. The gallery and footer fit a 390×844 viewport. No uncaught browser errors or download events occurred; file downloads remained disabled.

Physical iPad/Apple Pencil testing was unavailable. Google authorization and production sync latency were not changed or retested. Templates continue using the existing text/image and Drive sharing paths.

# Latest verification — v62

Expanded the offline mandala studio from six to 50 designs, preserving the original six. Added Floral (12), Geometric (12), Celestial (10), Ornamental (10) and Nature (6) collections, search by name/description/difficulty, an empty-results state that disables Add, and visible-only previews painted in small animation-frame batches. The toolbar and persistent Fill workflow are unchanged.

`npm run check` passes all 310 tests. Geometry checks exercise every design for finite coordinates, balanced transforms, closed regions, deterministic rendering, unique IDs/names and 50 different drawing-command compositions. The original six path-command sequences match v61 exactly; app.js and the existing drawing/artist renderer code are unchanged.

Chrome rendered all 50 designs as transparent bitmaps, confirmed all 50 bitmap outputs differ, and found at least three separately bounded fillable regions in each design. Browser checks verified zero rendered thumbnails at startup, lazy visible thumbnails, collection counts, search, no-result disabling, selecting Butterfly Circle from a search and adding it to a new page. Two sections retained their colors through persistent filling, Undo/Redo, native version-1 roundtrip and completed local save/reload, while five original pen strokes remained intact. The mobile gallery, filters and footer fit a 390×844 viewport without horizontal overflow. The full 50-design contact sheet and mobile studio were visually inspected. No uncaught browser exceptions or download events occurred; browser file downloads were disabled.

Physical iPad/Apple Pencil testing was unavailable. This release does not change the input pipeline or Google authorization/sync protocol.

# Latest verification — v61

Fill is now a persistent tool: clicking its main toolbar button selects it immediately without opening a panel or requiring another activation button. An adjacent color input, the toolbar palette and custom colors change fill color while preserving the pen color. A separate caret opens settings, opacity and mandalas. Continue filling dismisses settings without ending the mode; choosing another tool or pressing Escape ends it. Open-area errors and Undo/Redo leave Fill selected. Rapid taps are queued with captured colors/opacities; idle selection allows Drive synchronization, and only processing defers incoming changes.

`npm run check` passes all 309 tests. New checks cover consecutive fills, color independence, idempotent tool selection, open-area recovery, newer save versions, color changes during processing, bounded serial taps, idle synchronization, and compatibility with a cached older boundary module. Original Pencil handlers and non-passive touch suppression match v60.

Chrome verification selected Fill once and colored five Lotus regions using the inline picker, toolbar swatches and custom palette. It verified opacity, recoloring, queued fast taps (including the actual page pixel), Undo/Redo, an open-area retry, Escape/Pan exit, native persistence and reload. Saved fill-image pixels matched the selected colors and opacity. No uncaught browser exceptions occurred. Physical iPad/Apple Pencil testing was unavailable.

The reported `Untitled notebook (16).winds-notes` matched the generated five-stroke export fixture. Earlier Chrome export tests had used the browser's default Downloads folder. Existing test notebooks in that folder were not deleted. Known local browser checks now deny downloads by default; explicit export testing overrides this only with a fresh `/private/tmp` directory. The v61 browser check confirmed an empty isolated download directory throughout mandala creation, coloring and autosave, then exactly one valid native notebook after an explicit Export action. The downloaded native file retained both pages, five original pen strokes and five colored regions. Production export behavior remains explicit and unchanged.

# Latest verification — v60

Added **Fill → Mandala coloring pages…** with six original offline designs: Lotus Bloom, Sunflower, Star Mosaic, Rose Window, Orbit Garden and Peacock Bloom. The studio inserts a new blank page with ordinary editable text and transparent line art, ready for section-by-section color fill. Its mobile gallery scrolls independently while Cancel/Add remain visible.

`npm run check` passes all 302 tests. New coverage checks deterministic closed geometry, balanced renderer transforms, preservation of existing pages, native version-1 compatibility, cancellation/account changes during decoding, missing-page/page-count/backup-size limits, synchronization deferral, and the queued native-dialog close/reopen race.

Chrome verification found at least three separately bounded regions in every design. It checked cancel and quick reopen (including a stale close event), adding a Lotus page after a page containing five pen strokes including a longer stroke, independently coloring two sections, Undo/Redo, completed local persistence, reload, editable native export and a two-page PDF export. Existing handwritten items were unchanged after template creation and reload. Desktop and 390×844 mobile layouts were inspected; the mobile dialog and footer stayed inside the viewport without horizontal overflow. No uncaught browser exceptions occurred.

Physical iPad/Apple Pencil testing was unavailable. The original Pencil event functions and non-passive touch suppression match v59. Live Google authorization/invitation and production sync latency were not retested; the templates use the existing image/text data and shared edit path.

# Latest verification — v59

Added **Fill → choose color/opacity → Tap inside a closed area**. Built-in closed shapes retain independent vector fills and borders. Freehand closed boundaries receive a cropped transparent color layer underneath ink; open boundaries are rejected without modifying the notebook. Recoloring an unchanged region replaces its previous fill, with undo/redo. Filling uses passive tap observers and an idle task, with bounded raster processing and account/page/version checks; original Pencil handlers are unchanged.

All 295 tests pass through `npm run check`. New tests cover closed regions, nested holes, one-pixel leaks, line/outside taps, bounded dimensions, cancellation during yielded work, exact alpha-mask matching, native version-1 and shared replay compatibility, incoming-sync deferral, independent shape outlines, passive event observation, delayed filling, palm contacts, drags and multiple touches.

Chrome verification drew a box using four pen strokes, filled and recolored it at different opacities, verified saved PNG pixels, undid/redid the recolor, rejected a three-sided open box, filled a built-in rectangle without changing its outline, and checked pan/navigation cancellation. All seven pen strokes, the vector fill and the color layer survived a completed local save and reload. The exported PDF was opened as bytes, its embedded JPEG decoded, and the color inside the filled region checked. No uncaught browser exceptions occurred. The final menu was visually inspected. Physical iPad/Apple Pencil testing was unavailable; synthetic palm events are not a substitute for that device check.

# Latest verification — v58

Added an offline Education collection with 50 additional icons, bringing the sticker picker to 100 unique stickers. All, Everyday and Education filters retain the existing editing format; search includes subject keywords. Collection controls are also created when an older HTML shell is served with the updated script. Corrected the generic menu button style overriding sticker artwork size; icons now render at 28 px with 44 px high buttons.

`npm run check` passes all 283 tests. Chrome verification checked 100 unique stickers, exactly 50 in Education, subject search (maths and professor), teacher insertion, undo/redo, native version-1 export, five additional pen strokes including a long stroke, local persistence and reopening. The education icon and all five strokes survived reload. The picker remained within a 390×844 viewport and its layout was visually inspected. No uncaught browser exceptions occurred. Actual physical iPad testing was unavailable; the Pencil event handlers were not changed.

# Latest verification — v57

All 283 automated tests pass through `npm run check`, including syntax checks for the service worker and development server. Browser verification used headless Google Chrome with two isolated origins, mocked Google authorization and Drive responses, and the real editor and IndexedDB implementation.

Verified both collaborators adding five separate pen strokes, including a longer stroke, to the same Notebook.json; both accounts retained all ten strokes after reload. Verified continuous notebook scrolling, opening a dated-backup list, sign-out/sign-in retaining account notes and responsive controls, and startup recovery after a simulated storage-read failure. The failed startup performed zero read/write transactions; Retry reopened the existing library with working controls. The expected simulated error was caught by the recovery screen; no uncaught browser exceptions occurred.

Measured from the final stroke to the recipient's local persistence: approximately 2.58 seconds in either direction in the mocked Drive run. This includes the existing 2.5-second writing-idle guard. These local timings do not measure Google's production network or promise the same speed on devices.

New regression tests cover overlapping forced saves; sequential account activation; failed save/read rollback; blocked and late IndexedDB connections; malformed local storage and missing pages; delayed imports, backup downloads and remote renders crossing account boundaries; and overlapping startup/sign-in interaction locks. A 19,200-point shared notebook performs no native handwriting revalidation or local writes across five unchanged polls, then still receives the next remote edit.

This pass concentrates on asynchronous storage, account isolation, sync work and startup failure handling. It does not establish that every possible defect is absent. No physical iPad/Apple Pencil was available; physical rapid-stroke and long-stroke checks remain necessary. Google consent, invitations, production quotas and actual network delays were not exercised by the mocked browser test. The Pencil event pipeline, account database names, local format and native format version were preserved.

# Latest verification — v49

The selection bar shows two icon buttons, Copy and Cut. The browser checks covered both the older HTML shell and v49, in-app copy and paste, Cut with clipboard access denied by the test fixture, Undo, exact width, Delete selection and on-object Crop. The refreshed Eraser button removed part of a stroke, and native export retained the edit and the nine strokes. All 253 tests passed.

# Latest verification — v48

Sticker selection frames use the visible glyph bounds. Browser checks covered inserting the heart, rotating it, resizing it with the opposite corner fixed, and undo and redo. Native export retained the sticker angle and size and the nine subsequent pen strokes. All 253 tests passed.

# Latest verification — v47

The live site still served v42 HTML. The editor now mounts the transform controls at startup, including on that older HTML. Browser checks verified the lower-right rotation handle, the crop button beside the image, a rotated crop edge drag, and save and reopen. Native export retained both transforms and nine subsequent pen strokes. All 252 tests passed.

# Latest verification — v46

The public deployment served v42 HTML with v45 JavaScript, which failed during startup when binding a missing rotation handle. The v46 build opens notebooks and reaches mock Google authorization when served with the same v42 HTML. Matching v46 assets also show the on-page rotation and crop handles. All 252 automated tests passed. Live Google sign-in requires the updated deployment.

# Latest verification — v45

251 tests pass. Browser checks covered dragging the star rotation handle, resizing its rotated selection, rotating an image, cropping it with an edge and a corner, undo and redo, and cancel after Reset. Reload retained the star angle and size and the image angle and crop. Native export retained both transforms and all nine subsequent pen strokes. The crop regression test covers a rotated edge drag in source coordinates. Physical iPad testing remains outstanding.

# Latest verification — v44

249 tests pass. A regression test reproduced normal Eraser activation retaining a saved Ink only target. The main button and E now select All objects and retain the saved size. Browser checks reproduced the saved-mode skip on v43 and verified partial erasing of text and PNG pasted through the clipboard on v44. Explicit Ink only protected the PNG. Undo and redo, eight short strokes and a long stroke, native export, and reopening after reload passed. The export retained the original text and PNG with area masks.

# Latest verification — v43

248 tests pass. Five regression cases failed against v42 before fixing missing Pencil eraser starts, discarded passes after lost ends/capture, and omitted coalesced/lift-off samples. A sixth check covers a long 1,500-sample movement and palm/stale-event isolation. The real-Canvas browser fixture retained 20/20 rapid synthetic Pencil passes despite intermittent missing events and verified curved/end-position pixels. The app passed erasing, undo/redo, eight short strokes plus a long stroke, native export/reopen and reload with no console errors. Input tests use synthetic events; physical iPad/Pencil behavior and live Google synchronization remain unverified. See [Pencil event recovery](ERASER_SELECTION_SCROLLING.md#pencil-event-recovery-v43).

# Latest verification — v42

242 tests pass. Live eraser Canvas pixels update before gesture completion while original objects remain unchanged. The browser fixture verified untouched regions and fresh writing over a previous erase; app checks covered repeated/overlapping passes, Ink only image protection, undo/redo, eight separate short strokes and a long stroke, native export, save/reload and PNG pixel output. No transient preview fields were exported and no console errors were reported. Production-server routes served the new module, including its versioned URL. No physical iPad/Pencil latency or real Google synchronization was measured. See [Live eraser feedback](ERASER_SELECTION_SCROLLING.md#live-eraser-feedback-v42).

# Latest verification — v41

232 tests pass. Simulated canvas allocation failure reproduced the v40 generic error and its prematurely saved edit; v41 rolls back unsaved changes and history, retries smaller surfaces and recovers on the next operation. Existing masked notes passed repeated erasing, text editing, group move, undo/redo and export in the browser with no console errors. Pixel checks preserved untouched areas. The user’s exact device-specific trigger and physical-device behavior remain unconfirmed. See [Edit recovery](ERASER_SELECTION_SCROLLING.md#edit-failure-recovery-v41).

# Latest verification — v40

224 tests pass. Area erasing preserves the untouched parts of strokes, text, images and shapes; overlapping masks, source retention, paper ruling, undo/redo, copy/paste, reload, native reopen and PNG/JPEG/PDF outputs were verified with synthetic notes. Eraser size persisted and normal selection did not open settings. See [Area eraser verification](ERASER_SELECTION_SCROLLING.md#verification). Physical iPad/Pencil and live Google tests remain unavailable.

# Latest verification — v39

216 tests pass. Pasted text, images and copied handwriting erase in the default mode; slider dragging, exact sizes, presets, ink-only protection, undo, native export/reopen and narrow-screen controls were checked locally. See [Eraser verification](ERASER_SELECTION_SCROLLING.md#v39-pasted-object-eraser-fix). Physical iPad/Pencil testing remains required.

# Latest verification — v38

211 tests pass. See [Eraser, handwriting selection and scrolling verification](ERASER_SELECTION_SCROLLING.md#verification) for current browser checks and device limitations. Earlier release reports follow.

# WiNDS Notes 1.4 — validation report

## Automated Node tests

Run `npm run check` from the repository root. All **202** tests passed on the current development build.

The tests cover:
- Filled closed shapes and outline-only lines
- Border colors, line widths up to 32, dashed/dotted/none border styles
- 25 Artist material profiles, saved flow and deterministic canvas drawing
- `.winds-notes` save/reopen with new fields
- Backward compatibility with old files that do not contain border or new brush attributes
- Editable imported images and stickers with larger sizes
- WiNDS and Folio JSON backup imports with unique notebook/page/object IDs, optional legacy defaults, and whole-file rejection of damaged objects
- Non-destructive crop geometry, constrained crop handles, shared source rectangles and crop metadata validation/round trips
- Continuous pen widths at segment joins, identical live/saved rendering and bounded work for dots, duplicate points, reversals and long segments
- Image/sticker rotation, inverse hit-test coordinates, corner anchoring during rotated resize/crop, and native/backup compatibility
- Deterministic Artist pigment masks, paper grain, live/replay matching, native re-keying, cache reuse, continuous ink widths, bounded rendering and translucent joins

## Editable text and fonts — November 5, 2026

- Added a contextual **Edit text** action for pasted/typed text, an editing dialog and nine local font choices. Content, size, color, bold, italic, underline, alignment, spacing and width update in one undoable operation. Native text editing keeps the chosen font; new text can reuse the last applied settings in the current tab.
- Eleven new checks cover legacy defaults, optional-field native/backup/clipboard/shared round trips, safe font validation, rendering/alignment/underline/spacing, long-word/grapheme wrapping, preview/cancel/apply, invalid values, one undo snapshot, stale account/page/version checks, Drive deferral and keyboard toolbar activation. All 202 checks pass.
- Local browser edited pasted text into Georgia 34, bold/italic/underline, centered, purple, width 560 and spacing 1.6. Undo restored the original content and Arial settings; Redo restored the new styling. A copy pasted on another page retained all formatting and got a fresh ID. Native export/reopen exposed the same editable font values. Inline Text-tool editing retained its CSS font/emphasis/alignment. PNG output and a Poppler-rendered PDF page retained the same typography; the deployable server smoke check served the new text module successfully.
- The formatting panel fitted 768×1024 and 390×844 viewports. Cancel and keyboard toolbar interaction were checked. Drawing after text editing included eight rapid separate strokes and one long stroke. The Pencil/touch/pointer functions remain unchanged.
- Device fonts can fall back when unavailable on another OS. No physical iPad/Apple Pencil or live Google authorization/sync was tested. Cache v37 includes `text-tools.js`; native format and account database keys remain unchanged.

## Copy/paste — November 5, 2026

- Added external editable text/raster-image paste, account-scoped internal object copy/cut/paste, system plain-text/PNG/custom formats, keyboard commands and a touch text-box fallback. All existing object types retain their editable fields; new objects get fresh IDs. Native format and account database keys are unchanged.
- Fifteen new tests cover material/fill/crop/rotation/text preservation, invalid/oversized payloads, coordinate translation and fresh IDs, external data routing, native text inputs, permission fallback, cancellation, account/page changes, delayed-cut version checks, keyboard behavior and Pencil idle deferral. All 191 checks pass.
- Local browser: pasted synthetic text and PNG data, edited existing text using native ⌘A/⌘V, copied an image with plain-text/PNG/editable system formats, copied handwriting to another page with ⌘C, and used cut/undo/redo. A saved native file reopened with all content; validation confirmed unique pasted IDs and unchanged copied stroke width, point count and pressure samples.
- Drew five short separate strokes and one long stroke after pasting/moving an image. The original eight Pencil/touch/pointer functions remain byte-identical to v33. This is not a claim of physical Pencil latency testing.
- The paste fallback fitted a 390×844 viewport and inserted text successfully; tablet controls were checked at 768×1024. Exported/reopened content and contextual Copy/Cut controls were inspected visually. Service-worker v36 includes `clipboard.js`; Node and Docker static paths include it too.
- Physical iPad/Apple Pencil, cross-app clipboard behavior on actual iPadOS and real Google Drive remain device/deployment checks.

## Notebook scrolling and sharing access recovery — November 5, 2026

- Scrolling is available from the Actions menu of every notebook and from Notebook options. Browser verification used an ordinary two-page ruled notebook and a four-page PDF notebook; vertical scroll and return to the selected writing page succeeded. The view uses lazy, bounded canvases and closes on account switch.
- Shared Drive requests declare support for all drives. A folder/data-file 404 or app-authorization error opens recovery with the active email, exact Drive folder, scoped authorization, retry and a new independent sharing-copy option.
- Eight new automated tests cover folder 404 recovery, seed-file targeting, account changes during authorization, shared-drive flags, Picker configuration/resource validation, cancellation and independent-copy preservation/account isolation. All 176 tests pass. Production-server PDF routes, public configuration, auth protection and MIME checks pass.
- Google Picker requires a project-specific public browser key and an enabled Picker API. The key is intentionally blank in source. The access-recovery dialog and missing-key message were also inspected in a browser with a synthetic 404 fixture; no real Google invitation was sent. Real invited-account access was not tested and is not declared fixed solely from mocked tests. See `NOTEBOOK_SHARING.md` for deployment setup and diagnostics.
- No physical iPad/Apple Pencil test was performed. The Pencil touch/pointer functions and native/account database versions are unchanged.

## PDF annotation — November 5, 2026

- Added local, page-range PDF import into a new or existing notebook, with password retry, progress, cancellation and bounded sequential rasterization. Optional backgrounds survive native version-1 files, backups and shared history. Appending preserves existing page objects and sharing state.
- The 21 new checks cover range/memory limits, invalid backgrounds, compatibility, shared replay, staged commit, cancellation/failure, account changes, unchanged append objects, immutable background caches, decode/input guards, export availability after storage failures, download-link lifecycle and the complete offline PDF asset manifest. All 168 checks pass.
- Local browser: imported portrait, landscape and rotated pages; drew 12 separate strokes and one long stroke; highlighted and added text; verified erasing cannot remove printed PDF content; saved/reopened the native file; unlocked a protected PDF after an incorrect password and appended its second page. Native validation confirmed all backgrounds, unique annotation IDs and no stored password.
- Real UI exports were captured by a temporary localhost test-only server because the browser download connector did not return completed files. The repository contains no capture hook. All three exported PDF pages were rendered with Poppler and visually checked. PNG/JPEG retained the page and annotations at 1680×2174 pixels. Native output reopened as editable pages.
- The append test exposed an existing synchronous blur reentrancy bug that could commit a text box twice. Clearing editing state before hiding the box fixes it; automated and browser checks confirmed a single text item.
- Tablet layout at 768×1024 wraps the home controls without horizontal overflow. Service-worker cache v34 includes the bundled reader, worker, fonts, CMaps and WASM. Full runtime assets must be deployed together.
- No physical iPad/Apple Pencil, real Google transfer or public deployment was exercised. Hardware input latency remains a device check, and larger PDF notebooks can take longer to synchronize. See `PDF_ANNOTATION.md`.

- Added **Notebook options → Scroll pages…**, a continuous swipe/wheel reading view with lazy page canvases and per-page annotation buttons. Browser verification scrolled from portrait page 1 to landscape page 2 and reopened page 2 for writing. Account switches close the view and invalidate pending previews; Pencil handlers are unchanged.
- Fixed offline registration after asynchronous startup and guarded asynchronous image exports against account changes. Browser offline reload could not be completed in the available in-app browser; automated asset/registration coverage passes. Production-server routes and MIME types for the PDF reader, worker, WASM, fonts, CMaps and example PDF passed.

## Default width 7 and priority sync — November 5, 2026

- Pen/Artist size and shape-outline defaults are 7 in state and HTML. Width range and stored widths are unchanged. The service-worker cache is v33.
- Automatic synchronization prioritizes the open shared notebook, then the private workspace, then one rotating background shared notebook. New shared edit batches publish before history lookup. Ambiguous replies still reconcile before retry, including a same-session retry; uploads remain durable in the local outbox before sending. Discovery errors have independent backoff.
- Eight additional checks cover request order, fair bounded background work, discovery failures, lost upload replies, resumed writing, manual full sync, account-scoped sync details and controlled retrieval latency. All 147 checks pass.
- Comparing v32 and v33 cloud code in a virtual network model with 350 ms per Drive request and six unrelated shared checks, three poll phases improved from 6.00/5.75/7.80 seconds to 3.85/3.60/4.10 seconds. These are controlled model results, not measurements of the user's reported nine-second delay. Google latency, notebook/history size, input deferral and background tabs can still add time.
- Browser checks with mocked Google responses confirmed pen/Artist/outline controls at 7, 12 rapid Artist strokes plus one long stroke, undo/redo, reopening the saved notebook, and the new Sync details panel. Switch-account and sign-out buttons stayed enabled while polling; no browser errors were reported. Native download verification was interrupted by the browser session; native serialization/compatibility remains covered by automated tests. Physical iPad/Pencil and live Google synchronization were not tested.

## Artist Studio and live backend — November 5, 2026

- Artist Studio expands from 10 to 25 materials, with Graphite/Ink/Pigment collections, actual pressure previews, synchronized size controls and per-stroke flow. Legacy texture hashes remain identical. All new grades and flow round-trip through native and shared validation; live/saved rendering and cached-mask reuse pass for every material. Reduced-flow ink avoids internal cap overdraw.
- Animation-frame callbacks no longer pass their timestamp as a stroke-finalization flag. A regression test checks that only new points render between frames and the tail is finalized explicitly. Browser rapid/long low-flow strokes now remain continuous during drawing.
- Browser testing retained 12 short Artist strokes plus one long stroke through undo/redo, native export and reload. The exported notebook contained all 13 Fountain Pen strokes at flow 0.35, alongside the 13 original pen strokes. The default width remained 10 after reload.
- Two browser tabs exercised the actual relay/auth code with mock Google responses. Thirteen previews were received while an artificially delayed Drive workspace still held zero strokes; after backup/retrieval, the workspace held all 13 and the preview layer cleared. This demonstrates visual preview before backup, not measured production latency or full collaborative editing.
- Relay/client/auth checks cover private-account isolation, shared-folder access and revocation, logout, replay/reset, deduplication, CSRF, slow readers, bounded queues, pen-down deferral, pause and disabled static hosting. Production server startup, public config/policies/assets, authenticated route rejection and private-file protection passed a local HTTP smoke test with mock credentials.
- Docker was unavailable; no container build was run. No real Google account, public deployment, multi-device network measurement or physical iPad/Pencil test was performed. Pencil gesture suppression and event recovery remain unchanged. The Artist panel also fitted 1024×768 and 768×1024 tablet viewports and a 390×844 phone viewport, with its menu repositioning on resize. The three-page, 25-material reference imported and exported to PDF; its pigment page exported correctly to PNG. The service-worker cache is v32.

## Default drawing width — November 4, 2026

- Initial pen thickness and shape outline width are now 10 in both runtime state and HTML controls. The 1–32 range, existing stored stroke widths and native-file compatibility remain unchanged. Service-worker cache advanced to v30.
- All 119 existing checks pass. Browser verification confirmed both initial controls at 10, drew 12 rapid strokes, a long stroke and a rectangle, then saved, reloaded and reopened the notebook. Physical iPad/Apple Pencil testing was unavailable; the input pipeline is unchanged.

## Per-notebook invitations and co-editing — November 4, 2026

- Replaced delete-only card dots with an accessible Actions menu containing Share notebook and Delete. Shared entries have a Shared label and a local Remove from my library action. Added a Gmail invitation dialog, protected app link and homepage Open shared link action.
- Sharing grants writer permission on a dedicated single-notebook Drive folder, never the private workspace file. The seed and immutable edit batches contain only the selected notebook. The invitation requests Google's notification email with the app link.
- Added durable baselines/outboxes and deterministic shared edit replay, preserving independently added concurrent strokes and pages. Retry after an accepted upload with a lost response survives reload without duplicate strokes. Account/session and writing-idle checks remain in force. Native exports strip sharing metadata and remain version 1.
- All 119 automated tests pass, including scoped permissions, two authorized accounts, unauthorized discovery exclusion, concurrent additions, offline/retry recovery, malformed edits, native validation, private-backup isolation, shared undo protection, collision recovery, durable-save failure, revoked permissions, blocked re-sharing and late responses after an account switch.
- Browser-verified using two separate origins and simulated Google accounts: owner drew 12 rapid strokes plus a long stroke, invited the second account using the three-dot menu, and the recipient's app link opened that notebook after sign-in. Both accounts then added four strokes before sync, and both sets appeared together. The shared seed contained only the chosen notebook and the mock permission applied only to its folder. Reload/open retained the notebook on both accounts.
- Real Google notification delivery, per-file OAuth authorization/permission propagation, organizational policies and physical iPad/Apple Pencil remain live deployment/device checks. This implements eventual notebook co-editing, not millisecond live collaboration. Deploy all new/updated assets and service-worker v29.

## Stable Google account dialog — November 4, 2026

- Background polling previously set and cleared the dialog's disabled button states on every request, including Sign out and Switch Google account. With frequent polling or slow requests, the controls flashed and were difficult to click.
- The dialog now updates only when its account/control state changes. Background checks keep account actions and manual-action buttons stable. Explicit Drive actions clicked during a check queue behind it; manual operations retain their own busy state.
- Signing out or completing an account switch aborts the old Drive request and invalidates its operation generation. Old replies, errors and finalizers cannot resurrect the previous account or unlock an unrelated new request.
- Four regression tests cover unchanged control writes/enabled states across polls, sign-out during a delayed request, queued manual sync, and an account switch with both old and new requests in flight. All 99 tests pass, including the existing login, logout, sync and drawing tests.
- Browser-verified with mock authorization and six-second Drive response delays: 16 button-state samples across eight seconds had exactly one unchanged state. Sign out worked during polling, then Sign in reopened the mock account. Guest and signed-in libraries remained separate.
- Drew 12 rapid strokes and one long stroke after re-signing in, then saved, reloaded and reopened the notebook. Browser checks used simulated Google responses; live Google consent and physical iPad/Apple Pencil were not tested. The handwriting pipeline and local workspace keys are unchanged. The service-worker cache is v28.

## Device-to-device latency follow-up — November 4, 2026

- The public website was checked and already served the previous v26 timings (3-second save pause, 2-second poll). The reported 12 seconds therefore cannot be explained simply by an older public script. No live-account transfer was inspected, so its precise delay is not established.
- Reduced the local/cloud idle pause to 2.5 seconds without changing the 2.4-second composition/palm guards. Retrieval now polls at a 1-second cadence measured from check start, rather than adding a full interval after network work. Drawing deferral and failure retry timers remain independent.
- Received changes save locally without becoming a new local edit. Merge reports skip echo uploads while preserving uploads for local-only notebooks, newer local edits and deletion markers; legacy bridge callers retain boolean results and normal save notification behavior.
- All 95 tests pass. New checks cover merge reports, durable-save notification suppression, retained local contributions, request-time-aware polling, and independent device simulations with 350 ms delay per Drive request at three poll phases. Each simulation retrieved the new stroke within five seconds and made only the writer's upload.
- Browser-verified on two separate origins (independent local storage and BroadcastChannels) backed by a shared mock Drive, with 350 ms delay on every Drive request. The measured final stroke to visible incoming notebook update was **4.540 seconds**. Server logs confirmed the upload and subsequent reader download; all five uploads across the test were from the writer, with no reader echo uploads.
- Drew repeated rapid strokes and long strokes (32 total), verified them in the reader, reloaded that independent workspace, and reopened the saved notebook. Both browsers reported no errors.
- This measures the complete local simulated-network path, not a live Google Drive guarantee. A physical iPad/Apple Pencil and real Google transfer timing remain untested. Continuous writing, hidden tabs, large workspaces, slow networks and retry backoff can exceed 3–5 seconds. The deployable service-worker cache is v27; the public website still needs these files published.

## Faster synchronization follow-up — November 4, 2026

- Reduced the writing/local-save idle pause from 5 to 3 seconds, removed the additional 500 ms cloud debounce, and reduced visible/idle retrieval polling from 5 to 2 seconds. Opening, returning to the app and network recovery queue immediate idle-guarded checks.
- Known workspace files use a small direct metadata request; discovery no longer includes dated backups. Missing files are rediscovered, while authorization/service errors retain the known file and the existing failure retry. Matching-account tabs receive an upload notification and schedule their own authorized retrieval without sharing workspace contents.
- Four additional regression tests cover the metadata-only fast path, missing-file replacement, errors without duplicate creation, and account-scoped change notifications that respect drawing and automatic-sync pause. All 90 tests pass.
- Browser-verified using an isolated mock account and HTTP Drive simulator: 12 rapid separate strokes and one long stroke uploaded automatically **3.005 seconds** after the final stroke. A simulated remote rename and blue stroke appeared automatically. All 13 original strokes and the incoming stroke survived local save, reload and reopening; the browser reported no errors.
- This is a local simulated-network measurement, not a live Drive speed guarantee. Physical iPad/Apple Pencil and real Google endpoints were not tested. The Pencil event handlers, composition/palm guards, account database keys and native-file format are unchanged. The service-worker cache version was advanced for deployment.

## Public privacy and terms pages — November 4, 2026

- Added script-free `privacy.html` and `terms.html` pages describing the app's local notebooks, Drive data, account credentials, optional server sessions, deletion controls and service terms. Contact currently uses the existing developer website/support contact route.
- Both pages and `legal.css` were visually inspected in the browser without signing in. Homepage policy links were confirmed, and the persistent-login server returned HTTP 200 for the pages, stylesheet and MIT license without a session.
- Drew 12 short strokes and one long stroke in the isolated local browser workspace, saved, reloaded and reopened all 13 strokes after the homepage changes.
- All 86 tests pass. The policy pages are prepared locally; public hosting, contact confirmation and Google branding submission remain deployment steps.

## Earlier automatic upload and retrieval timings — November 4, 2026

- Local saves now wait for a 5-second writing pause, then queue uploads after 500 ms. Idle retrieval checks run every 5 seconds and promptly on opening/focus/visibility/online events.
- Browser-verified with an isolated mock account and HTTP Drive simulator: 12 short strokes and one long stroke uploaded automatically **5.512 seconds** after writing stopped. This is a local simulated-network measurement, not a guarantee for live Drive or larger notebooks.
- A simulated second device then renamed the notebook and added a blue stroke. Both changes appeared in the open editor automatically on the next retrieval check, without refreshing the page or pressing Sync. All 13 original strokes remained visible with the new stroke.
- New tests cover the shortened durable-save pause, coalescing rapid strokes, automatic startup/poll/focus retrieval and deferral during two-finger zoom. The previous delayed-response, account isolation and in-flight-save/render tests still pass at the faster timings. All 86 tests pass.
- Physical iPad/Apple Pencil input and real Google Drive transfer timing were not tested. Input handlers and local account keys are unchanged.

## Idle Google Drive synchronization — November 4, 2026 (initial timings)

- Automatic sync is enabled by default and waits for the existing 45-second writing/editing idle window and completed local saves.
- Regression tests resume drawing during delayed Drive responses, between short strokes, and while a remote merge's IndexedDB save is pending. Parsing, snapshots, uploads and canvas refreshes defer until idle; current strokes remain intact.
- Tests cover failed uploads, edits saved during an earlier upload, reconnection/visibility retries, explicit auto-sync pause/resume and other-device changes. An unchanged workspace receives metadata checks without repeated content downloads or uploads.
- Browser-verified with a persistent mock Google account and an HTTP Drive simulator: drew 12 separate short strokes and one long stroke, left the editor idle, and observed exactly one automatic upload containing all 13 strokes. The manual Sync button was never pressed. The Drive dialog displayed automatic sync enabled and the successful sync time.
- All 82 automated tests pass, including persistent session restoration/renewal, logout/account isolation, drawing/export compatibility and the new sync timing/race tests.
- The Pencil pointer handlers, non-passive touch suppression, local account database keys and native-file format are unchanged. Real Google Drive endpoints and a physical iPad/Apple Pencil were not exercised; no hardware latency fix is declared complete.

## Artist material upgrade — November 3, 2026

- Browser-inspected all ten grades using the editable Artist Studio sample, including pressure swatches, layered graphite shading and colored-pencil foliage.
- Drew 14 separate Charcoal mouse strokes and one long Charcoal stroke; saved locally, reloaded and reopened them. Added live Ink Brush and Color Pencil strokes and checked undo/redo. The browser reported no errors.
- Verified the Artist chooser displays ten actual material previews and one active grade.
- Automated tests verify material pixels and rendering stay deterministic, including native reopening with fresh object IDs and legacy/unknown grade defaults.
- The browser-style rendering tests verify masks are reused during prepared strokes, pigment colors remain correct, joins have continuous widths, translucent pencils avoid doubled round caps, and degenerate/very long segments have bounded finite output.
- Normal pen geometry, Pencil recovery, touch suppression, Google code and account storage keys are preserved. All 40 tests pass.

Real iPad/Apple Pencil feel, pressure hardware and live Google OAuth/Drive sync still require device/account testing. These changes improve brush rendering; no hardware latency claim is made.

## Image and smiley rotation — November 3, 2026

- Browser-verified image rotation to 90° and 45°, including undo/redo. Selection handles follow the rotated corners.
- Dragged a rotated resize handle and moved the image from a visible area outside its unrotated bounds. Its angle and aspect ratio were retained.
- Cropped the rotated image and confirmed the crop retained the angle. Pure geometry tests also verify that retained content stays in place and Reset restores the original frame.
- Rotated a smiley with a 90° button and an exact -30° input (stored/displayed as 330°), then resized it while preserving its square proportions.
- Saved locally, reloaded and reopened the notebook: the image retained its 45° rotation/crop and the smiley retained its 330° rotation and 140px size.
- Rotation controls appeared for images/stickers and stayed hidden for shapes. Controls fit at widths 320, 390, 768 and 1280px. The browser reported no errors.
- Tests cover rotation/crop fields in native version 1 and Drive-compatible JSON backups; editor, thumbnail and image/PDF export paths use the shared rotation transform.

Physical iPad touch/Apple Pencil testing and live Google OAuth/Drive sync were not exercised. The Pencil event handlers, Google configuration and account isolation code remain unchanged.

## Image crop and smooth pen — November 3, 2026

Verified against the local development server in the in-app browser:

- Imported an image; dragged crop handles; canceled with no change; applied exact percentages; undid/redid the crop; restored the original with Reset; resized the cropped image while retaining its aspect ratio.
- Crop dialog fit at 320, 390, 768 and 1280 pixels; the image preview retained its correct aspect ratio and Apply remained visible.
- Drew 16 separate mouse strokes and one long stroke. All 17 strokes and the crop survived native export, local reload and native reopen.
- Exported PNG/JPEG/PDF and JSON. Pixel checks confirmed the cropped image in PNG/JPEG; native and JSON retained the crop rectangle and original embedded source. The PDF contained a complete image-based page.
- Inspected smooth pressure curves at sizes 3, 12 and 32 with rounded ends and gradual thickness changes.
- Google sign-in remained visible; `cloud-drive.js`, `google-config.js`, account keys and workspace functions were unchanged. Live OAuth/Drive sync were not exercised.

These are browser/mouse and file checks. Physical Apple Pencil responsiveness and touch behavior still require an actual iPad. Existing layout/style rules remain intact; only the image selection control and crop dialog have additions.

## Filled color cells — November 3, 2026

- Confirmed that the general pop-menu button style overrode swatch backgrounds, making the color cells appear white.
- Verified all 28 light preset cells and all 8 shape fill cells display their actual colors.
- Switching from pink to blue clears the previous selected state and updates the current-color preview. The custom color input also updates the selection correctly.
- Drew 6 pink strokes, 6 short blue strokes and a long blue stroke. The native export retained all 13 strokes with their chosen colors, and reopened successfully.
- The original layout, drawing handlers, Google account code and native file format are unchanged by this color fix. All 23 tests pass.

## Local browser verification — November 3, 2026

Verified the following in the in-app browser against the local development server:

- Searching for a missing title shows the empty state; clearing the search restores notebooks.
- Created a notebook, drew 12 separate mouse strokes and one long stroke, and used undo/redo. The exported `.winds-notes` contained all 13 strokes.
- Returned to the library, reloaded, and reopened the notebook with all strokes visible. The native export also reopened successfully.
- **Notebook options → Restore notebook backup…** imported a backup with an existing notebook ID as a separate copy. Importing it again added another copy.
- A multi-notebook backup containing a damaged stroke was rejected with no additional notebooks and no changes to the library's existing IDs.

The earlier search redesign was reverted before image cropping was added, preserving the original design and responsive behavior. A fresh workspace was verified in the browser to start with one blank **Untitled notebook**.

These checks used mouse input, not Apple Pencil hardware. Google OAuth and live Drive sync were not exercised. The Pencil and gesture handlers are unchanged.

## Browser smoke tests (headless Chromium)

A scripted editor session verified the following without uncaught browser errors:
- Created a notebook and opened the editor
- Retained 20 separate simulated stylus strokes
- Opened Artist mode and selected **Ink Brush**
- Increased the size slider to **32**
- Drew a star with **fill #ffaa00**, **outline #2288aa**, **width 17**, and **dashed** border
- Selected **600%** zoom, then returned to 100%
- Imported a PNG and changed its displayed width from 650 to 747 and then 420, retaining its aspect ratio
- Added an emoji, changed its size to 230 using the numeric control and to 278 by dragging its resize grip
- Exported `.winds-notes` and verified the stored stroke/shape/image/sticker objects

The browser session used an in-memory copy of the website because network navigation was restricted in the testing environment. It did not test Google authorization, network synchronization, installed PWA caching, or real Apple Pencil hardware.

## Hardware tests before production release

Test on an actual iPad with Apple Pencil: rapid separate letters, long smooth curves, palm contact, four-handle resize, two-finger pinch up to the maximum zoom level, exporting PDF, cloud sign-in and reconnection. In particular, **do not change or remove** the iPadOS touch gesture suppression and lost pointer event recovery when making future creative-tool changes.
