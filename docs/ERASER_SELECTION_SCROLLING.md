# Area eraser, handwriting selection and notebook scrolling — v44

## Area eraser and saved settings

Tap **Eraser (E)** and brush over the part you want to remove. Only that circular contact area is erased; the rest of the stroke, text box, image, shape or sticker remains. Overlapping passes remain erased. The page template and fixed PDF background stay intact.

Tapping **Eraser** or pressing **E** selects **All objects**, including when a prior Ink only choice was saved. Use the **small arrow beside Eraser** to change its diameter (4–128), exact size, presets or target. The size badge shows the saved value across notebook changes, reloads and new tabs when browser storage is available. Pen width remains independent (default 7).

**All objects** includes pasted text and images. Choose **Ink only** in settings to limit erasing to handwriting. Tap **Eraser** again to return to All objects. Tap Done, click outside or press Escape to close settings. The erased area updates in animation frames while you brush. The durable edit commits after lifting and a short idle interval so geometry and storage stay out of the Pencil event pipeline. Undo/redo restores/reapplies one complete eraser gesture.

Erased regions are non-destructive, object-relative masks: original text, image data and pressure samples stay editable, and masks follow move, resize, rotation, cropping and copying. Native files and Drive data retain the source and masks. Exported PNG/JPEG/PDF show the erased result. This is a visual editing feature; editable source files still contain the original content.

## Scroll between notebook pages

All handwritten and PDF pages now form one vertical stack in the writing workspace. Use the mouse wheel/trackpad, two-finger pan, or the **hand / Scroll notebook pages (S)** tool to drag without drawing. **Notebook options → Scroll pages…** and a notebook card's **Scroll pages…** select the same hand tool. Tap **Pen** to write again.

The page nearest the reading position becomes active after scrolling stops. Tap a page's heading to focus it, or tap its preview to activate it at the current scroll position. The active page says **Writing here**. Inactive pages use nearby previews; only one page has the live writing canvas. The first contact on an inactive preview activates it; begin writing after activation. At page boundaries, choose the intended page heading before writing.

## Select, move and copy handwriting

1. Choose **Area select handwriting (L)**, next to the hand tool.
2. Drag a rectangle around the complete strokes of a word, sentence or drawing. The selection count appears above the page. This selects ink rather than converting handwriting to typed text.
3. Drag inside the outlined box to move all selected strokes together.
4. Use **Copy**, **Cut**, or the keyboard shortcuts. Switch pages/notebooks if needed, then choose **Notebook options → Paste copied object** for an editable copy. Ordinary Paste also supports the system clipboard where available.
5. Use **Clear** or Escape to dismiss the selection. Delete removes the selected group. Move, cut, delete and paste each support undo/redo.

Selection supports up to 100 complete strokes per group and clipboard payloads up to 10 MB. Copies receive fresh object IDs and retain pressure, artist material and other stroke properties. Internal copies are account-scoped and clear on account change. Existing single-object selection and image resize/crop/rotation remain available.

## Verification

`npm run check`: **249 passing tests**. Coverage includes partial area geometry, normalized masks under move/resize/rotation/crop, native v1/backup/clipboard/shared replay, legacy files, malformed payload limits, queued gestures on the same object, fresh-ink/account isolation, one-step undo snapshots, preferences and input-idle image decoding.

Local browser checks used a synthetic page with text, one continuous stroke, a PNG and a filled rectangle. A 40-unit brush removed strips/holes while all four original objects remained editable. Two overlapping image passes stayed erased. Pixel comparisons confirmed untouched pixels, 527 erased text pixels, white holes and visible paper ruling. Native export retained the original text/pressure/image and mask counts [1,1,2,1]. Undo/redo, reload, native export/reopen and copying the masked image to another page preserved the result. PNG/JPEG and a rendered two-page PDF retained the holes. Sixteen rapid separate strokes and one long stroke remained on the second page. Browser console checks found no errors.

Selecting Eraser after a reload retained size 40 and left the settings panel closed. Physical iPad/Apple Pencil and real Google accounts were unavailable; no hardware latency or live sync claim is made. Non-passive touch suppression and missing Pencil event recovery are preserved. An eraser-specific cleanup removes a canceled finger preview when a two-finger pinch starts; palm touches do not cancel a Pencil eraser.

## Upload

Upload the complete v44 archive. Updating an existing v43 deployment requires **app.js, index.html and sw.js** together. The existing eraser-preview.js remains required. Earlier deployments also need the v41 renderer, v40 validators and v42 preview module; use the full archive when unsure. Existing vendor files remain required. All collaborators should update so older validators do not discard the optional mask fields. Native format version remains 1; account database keys and OAuth configuration are unchanged.

## Edit failure recovery (v41)

The reported generic error did not include its underlying exception; the exact device-specific trigger is unconfirmed. Public index/script files matched v40. A simulated null Canvas 2D allocation reproduced a concrete failure: v40 saved the failed edit before its repaint threw.

v41 reuses one bounded eraser canvas instead of allocating a new canvas for every masked object. It resets compositing state between objects, avoids temporary oversized allocations when switching aspect ratios, retries at smaller sizes if a 2D context is unavailable, and supports contexts without getTransform. Optional selection previews tolerate allocation failure. Failed deferred edits restore items, selection and undo/redo before any save is scheduled; pending work always clears and a subsequent eraser action can succeed. Error messages now include the cause.

New tests cover null/exhausted contexts, recovery on a later edit, surface reuse, missing getTransform, temporary allocation bounds, rollback and versioned offline script URLs. Browser verification covered repeated erasing on existing masked notes, text editing followed by erasing, masked handwriting movement, undo/redo and export; there were no console errors. Pixel checks confirmed untouched areas and the new holes. Physical device/Google verification remains unavailable.

## Live eraser feedback (v42)

The former path showed deletion only after the idle edit job. The new optional preview caches protected paper/PDF pixels (plus non-ink objects in Ink only mode) outside active input. Each animation frame copies only the round swept brush region and clears only the previous cursor region. A spatial index limits candidate lookup; frames process at most 64 segments and check a four-millisecond budget between segments. This is a work limit, not a guaranteed frame time. Temporary masks preserve feedback across repainting and are discarded after commit, cancellation or failure. New writing stops old preview patches. Geometry, undo snapshots, serialization, storage and synchronization remain deferred until idle.

Ten additional tests cover patch copying, source retention, transient masks, later writing, account scope, bounded work, allocation fallback, cursor regions, cancellation and finger-pinch/Pencil isolation. The real-Canvas browser fixture `tests/fixtures/live-eraser-check.html` confirmed changed pixels while the gesture was still active, before completion or saving, with untouched areas and later red ink preserved. App checks covered repeated/overlapping erasing, Ink only image protection, undo/redo, eight separate short strokes and a long stroke, native export and save/reload. Exported data contained original objects and durable masks with no transient preview fields; fresh handwriting had no old masks. PNG pixel checks confirmed preserved fresh ink and holes in old ink, images and shapes. No browser errors were reported. No physical iPad/Pencil latency or real Google synchronization was measured.

## Pencil event recovery (v43)

Three application defects were reproduced against v42: missing pointerdown recovery did not include Eraser, missing end/capture recovery marked Pencil erasing as canceled and discarded it, and eraser movement ignored coalesced intermediate samples and the final pointerup position. These could omit an entire pass or replace a curved movement with a straight chord. The fix extends recovery to a pressed Pencil eraser (including a new pointer ID after a missed end/start), retains sampled Pencil erasing after cancel/lost capture as handwriting already does, and passes coalesced samples and lift-off positions into both live and durable paths. Hover does not start erasing. Finger cancellation and finger-to-pinch rollback remain separate. The non-passive touch handlers, drawing recovery and palm guard are preserved.

Six new tests cover missing starts, lost ends/capture, explicit cancellation, curved coalesced paths, lift-off, twenty rapid passes, a long 1,500-sample movement, palm contact and stale finger ends. Five initial regression tests failed against v42 before the fix. All 248 tests now pass. The real-browser `tests/fixtures/eraser-pencil-check.html` fixture exercised the actual source input functions with synthetic Pencil events and actual Canvas pixels: 20/20 passes survived intermittent missing events; curved and final pixels erased while untouched pixels stayed intact. This tests app routing, not physical WebKit event delivery. Normal browser erasing, undo/redo, eight short pen strokes and a long stroke, native export/reopen and reload were checked. The native version remained 1 with 23 objects, four masks on the original stroke, and no masks on later writing. No console errors were reported. Actual iPad/Pencil testing remains required.
