# PDF annotation

## Import and write

1. Choose **Import PDF** on the home page, or **Notebook options → Import PDF pages…** while editing.
2. Choose a PDF from the device's file picker. If it is password-protected, enter its existing password in the import dialog.
3. Choose pages, for example `1-5, 8`. Duplicates are removed and pages follow their original order. The first 50 pages are selected by default in a longer document.
4. Create a new notebook or append to the notebook that was open when import started. Import progress and cancellation are available; cancellation leaves existing notes unchanged.
5. Write with Pen or Artist, highlight, add text, or add shapes/images/stickers using the existing tools. Undo/redo, selection and zoom work on your annotation objects.

PDF pages remain fixed beneath your marks. The eraser removes annotations, and selection moves/resizes annotation objects. Page orientation follows the PDF, including its rotation; paper-template and orientation controls are disabled on those pages. You can still add ordinary blank notebook pages and duplicate a PDF page with its annotations.

Try `examples/pdf-annotation-demo.pdf` for portrait, landscape and rotated examples.

## Save, export and synchronize

- Local autosave stores the background and editable marks in the current guest or Google-account workspace.
- **Export → WiNDS Notes notebook** preserves editable annotations and embedded PDF page images in native format version 1. Reopen with **Open notebook**. Older notebooks without backgrounds remain supported.
- **Export → PDF** exports all notebook pages with their annotations flattened into page images. PNG/JPEG export the current page. A prepared download link stays in the export menu for five minutes if the browser needs another tap.
- Enabled Google Drive sync includes PDF page images and annotations. Shared notebooks retain the same backgrounds and independent annotation objects. All collaborators should update to this release before opening PDF notebooks; older clients do not understand the new backgrounds.

Importing and saving a large PDF increases notebook size and Drive transfer time. PDF import and incoming cloud merges are deferred from active writing. This feature does not change the Drive service's network latency or enable the optional live backend on GitHub Pages.

## Quality and limits

PDF pages are rasterized locally at twice the app's standard page budget, bounded to 1680×2376 pixels (2376×1680 for landscape), while retaining their aspect ratio. This keeps tablet memory and storage bounded. Very fine text can soften at high zoom; this is not a vector PDF editor. PDF text, hyperlinks, form controls and existing PDF annotations become pixels rather than editable/searchable elements. A new annotated export does not preserve the source file's signatures, forms, layers or document structure.

| Limit | Value |
| --- | --- |
| Source PDF size | 25 MB |
| Selected pages per import | 50 |
| Combined rendered image data per import | 60 MB |
| Resulting serialized notebook | 100 MB |
| Pages in destination notebook | 750 |

Pages are rendered sequentially and staged before import commits. A malformed file, render failure or account change aborts the import. If device storage fails after commit, the pages remain open and the app asks you to export a backup. Browser storage quotas can be lower than the limits above.

## Local processing and deployment

The local reader processes PDF bytes on the device. It stores only rendered selected pages, source filename/page numbers and your annotations; it does not retain the original PDF or password. Enabled Drive backup or explicit notebook sharing includes those rendered pages. The app's privacy policy describes the complete storage and sharing behavior.

Publish `pdf-import.js`, all updated core app files and **the whole `vendor/pdfjs/` directory**, including its fonts, CMaps, WASM, ICC data and licenses. Keep `.nojekyll` so GitHub Pages serves underscored font filenames. Cache v34 preloads the reader assets; offline PDF import works after the new service worker has installed successfully. Source PDFs do not need to be uploaded to the website.

The bundled reader is Mozilla [PDF.js](https://mozilla.github.io/pdf.js/), distributed as official `pdfjs-dist` 6.5.438. Its matching legacy reader and worker are pinned together; see `vendor/pdfjs/README.md` for provenance and hashes. No runtime CDN or npm install is required.

## Verification

The automated suite covers page ranges, raster budgets, failure/cancellation, account changes, safe append, native/shared background round trips, export idle guards and offline asset coverage. Browser checks covered rapid separate strokes, a long stroke, highlighting, text, erasing over printed content, all three page orientations, password retry, append, native reopen and PDF/PNG/JPEG output. Exported PDF pages were rendered with Poppler and visually inspected.

Physical iPad/Apple Pencil and live Google Drive were not available for this change. Test rapid letters, long strokes, palm contact, pinch zoom, PDF import/export and account sync on the deployment devices before a production release. The existing Pencil pointer/touch handlers remain unchanged.

**Page scrolling:** Choose **Notebook options → Scroll pages…** to swipe or scroll vertically through the notebook. Tap **Write on this page** to annotate a selected page, or **Back to writing** to resume. Only nearby page previews are rendered to bound memory.
