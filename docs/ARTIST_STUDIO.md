# Artist Studio

The Artist button opens a material library with 25 tools, grouped into three collections. Each card and the larger pressure preview use the same renderer as the editor, thumbnails, PNG/JPEG and PDF exports.

| Collection | Materials |
| --- | --- |
| Graphite · 12 | 4H, 3H, 2H, H, F, HB, B, 2B, 3B, 4B, 6B, 8B |
| Ink · 6 | Technical Pen, Fineliner, Fountain Pen, Ink Brush, Brush Marker, Dry Brush |
| Pigment · 7 | Charcoal, Vine Charcoal, Compressed Charcoal, Color Pencil, Soft Pastel, Oil Pastel, Chalk |

Choose a collection and material. **Size** uses the same 1–32 control as the writing toolbar; the initial width is 7. **Flow** controls pigment deposition from 10–100% for new Artist strokes. Lower flow builds lighter layers, and crossing/repeated marks accumulate pigment. The preview shows increasing pressure left to right. Pressure variation requires a pressure-capable stylus; mouse input uses a stable fallback pressure.

Technical Pen keeps a fixed width, Fineliner has a small pressure variation, Fountain Pen is more expressive and Ink Brush has the widest response. Dry Brush uses broken bristle channels. Pastel, waxy oil pastel and chalk use different deterministic pigment masks. These are lightweight Canvas material simulations; tilt, wet paint diffusion and physical paper mixing are not implemented.

Ink and colored pigments follow the selected ink color; graphite and charcoal retain their natural shades. Default masks are prepared before drawing, and custom colored-material masks are prepared on color selection in a bounded cache. Rendering remains incremental, with at most 96 deposits per new curve.

The original ten materials retain their previous texture and pressure settings. A saved Artist item still uses `tool:'artist'`, `grade`, `color`, `size` and pressure points, with an optional `flow` field. Missing flow means 100%, including older notebooks. Native format version remains 1. Material and flow survive native imports/exports, local reload, undo/redo and Drive/shared notebook data. Texture depends on geometry rather than IDs, so importing a separately re-keyed copy preserves its appearance.

Open `examples/artist-studio-pro.winds-notes` for three editable material-reference pages containing every tool. The older sample notebooks remain available.

Validation covers all 25 materials, deterministic legacy-mask fingerprints, cache reuse, live-versus-saved rendering, bounded long segments, animation-frame/finalization separation, flow round trips, native/shared validation and pressure-response differences. Browser checks cover material collections, flow, rapid drawing, undo/redo, export/import and reload. Physical Apple Pencil/iPad checks remain required before claiming a hardware latency improvement.
