# Codex agent guidance — WiNDS Notes

## Primary objective
Improve a stable iPad-first handwriting application while keeping input handling smooth, local data compatible and Google accounts isolated.

## Non-negotiable input invariants
- The Apple Pencil **missing-letter bug has previously been fixed on a physical iPad**. Preserve the non-passive Touch Event handlers (`touchstart`, `touchmove`, `touchend`, `touchcancel`) and default-gesture suppression on `#inkCanvas`. These prevent Safari/WebKit swallowing successive stylus contacts.
- Preserve missing `pointerup` recovery in `pointerDown`, and lost `pointerdown` recovery in `pointerMove`. Do not auto-switch to stylus-only mode.
- Keep Pointer Events and two-finger zoom independent. Palm touches must not discard a Pencil stroke.
- No network request, IndexedDB transaction, full-page re-render, or heavy serialization during pen-down, move, or up. Batch Canvas updates with `requestAnimationFrame` and delay durable saves until idle.
- Test many separate rapid strokes and long individual strokes. Test with an actual iPad/Apple Pencil before declaring a latency fix complete.

## New creative features
- Geometry and graphite rendering live in `creative-tools.js`. Prefer making creative rendering changes there, not in `pointerDown` or `pointerMove`.
- Artist mode tools: 2H, H, HB, B, 2B, 4B, 6B, Charcoal, Ink Brush, Color Pencil. Each stroke retains `tool:'artist'` and `grade`, including in `.winds-notes` and Google Drive data.
- Closed shapes can have `fillColor` and `fillOpacity` independently from outline `color`, `size`, and `strokeStyle` (`solid`, `dashed`, `dotted`, `none`). Lines and arrows are always unfilled.
- Square/Circle lock width and height during pointer movement. Keep this behavior in `updateShapeDraft`.
- Selection resizing uses only the `select` tool: four corner handles and a contextual width control. Images must retain aspect ratio and emoji stickers must remain square. Preserve pointer capture and undo/redo for these edits.
- Drawing width reaches 32; zoom goes from 35% to 800% (presets and pinch). Do not expand the backing canvas based on zoom.
- Maintain deterministic graphite texture: same item renders consistently in the editor, thumbnail and exports.

## Persistence and compatibility
- Older `.winds-notes` files without `fillColor`, `fillOpacity`, `strokeStyle` or `grade` must continue importing. The native-file format version remains 1 because the fields are optional additions.
- New objects must survive `.winds-notes` serialization, all export types, reload, undo/redo and Drive sync.
- Do not store OAuth secrets or user tokens in the Git repository. `google-config.js` contains only a public OAuth client ID.
- Drive account A and B must never share an on-device workspace. Do not change account keys without migration tests.

## Workflow
1. Read `README.md` and `docs/ARCHITECTURE.md` before refactoring.
2. Make small, reviewable changes; avoid rewriting the working Pencil input code for purely visual features.
3. Run `npm run check` after each change.
4. For UI work, test drawing interactions and save/open in a browser and physically on an iPad when available.
5. When changing deployable files, update `sw.js`'s `CACHE` version to force fresh offline assets.
6. Preserve accessible toolbar labels and the app's clean single-row writing workspace.

## Useful starting tasks
- Improve object resize handles and add optional image rotation with reliable undo and deterministic export.
- Add more graphite rendering profiles or an optional watercolor brush in `creative-tools.js` without modifying the Pencil event pipeline.
- Build automated end-to-end tests using Playwright and mocked Google responses.
- Add conflict-aware Drive versioning without putting network operations into the drawing path.
