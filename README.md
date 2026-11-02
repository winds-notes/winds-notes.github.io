# Folio Notes — iPad / Tablet Handwriting Web App

A polished, responsive, Goodnotes-inspired personal notebook app that you can deploy directly to **GitHub Pages**. No backend, sign-in, build tools, npm, database server, or paid hosting is needed.

## Features

- Write with **Apple Pencil, other active styluses, finger, or mouse** using Pointer Events; supports pressure sensitivity for compatible styluses.
- Pen, translucent highlighter, stroke/object eraser, select-and-move, text boxes, rectangle, ellipse, and straight line.
- Multiple notebooks with six covers, multiple pages, page thumbnails, duplicate/delete pages, notebook search.
- Ruled, graph, dotted, and blank paper.
- Undo/redo; thickness adjustment; seven ink colors; zoom; basic pinch-zoom and one-finger scrolling in stylus-only mode.
- Add images directly to a page, then move them with Select.
- **PDF export**: full notebook as a standard multi-page PDF (A4 pages).
- **JPEG/PNG export**: current page as a 1680×2376 image.
- **Editable backup/restore**: download all notebooks as JSON and import them on a different device.
- Offline-capable PWA app shell. On supported browsers, install to the home screen.
- Autosave in this device's **IndexedDB**; works without cloud sync or tracking.

## Deploy to GitHub Pages (no command line needed)

1. On GitHub create a new repository, for example `folio-notes`.
2. Upload **the contents of this folder** (not the containing folder) to the repository root. Keep `index.html`, `app.js`, `styles.css`, `pdf-export.js`, `sw.js`, `manifest.webmanifest`, `.nojekyll`, and the `assets` folder together.
3. Open the repository's **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**, choose `main`, select `/(root)`, then **Save**.
5. Visit `https://YOUR-USERNAME.github.io/folio-notes/` after GitHub finishes deploying. Your site works with repository subpaths because all asset references are relative.

Official guide: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

### Local testing

Run the following command inside the folder:

```bash
python3 -m http.server 8000
```

Visit `http://localhost:8000/` on a computer. To use it from an iPad, deploy with HTTPS on GitHub Pages. **Do not open `index.html` directly as a local file** if you expect offline caching/installation to work.

### Add to iPad home screen

Open the GitHub Pages URL in Safari on iPad → Share → **Add to Home Screen**. You can then open it like an app. Apple Pencil works through supported Safari pointer events. For best results, use iPadOS/Safari updated to a recent version.

## Important data and product limitations

- **Storage is per browser and per device.** GitHub Pages hosts the application files, *not your notebooks*. Notes written on one iPad do not appear on a separate device automatically. Regularly tap the **backup** button in the notebook library and keep the JSON file safely, especially before clearing Safari history/site data.
- Avoid Safari private mode for work you want to keep. Private browsing and low-storage cleanup can remove browser data; request persistent storage in browser settings where available.
- This is a functional, lightweight Goodnotes-*inspired* app, **not an exact Goodnotes replica**. It does not include cloud sync, simultaneous collaboration, handwriting recognition, searchable handwritten text, audio recording, or PDF-document import/markup. JPEG/PNG images can be imported and annotated.
- The eraser removes a whole intersected object/stroke, rather than erasing only part of the ink path.
- PDF export converts pages into high-resolution JPEG-backed PDF pages. The exported PDF is shareable and printable, but handwriting and text are flattened (not editable PDF text). Use JSON backups to retain editability.
- The app doesn't upload personal notes to GitHub, but **published website code is public**. Never commit a notebook backup to a public repository.
- Browser download behavior varies on iPadOS. If a downloaded PDF/JPEG opens in a preview, use the iOS Share menu to save it to Files or Photos.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App structure and interface |
| `styles.css` | Responsive UI, tablet layout, page templates |
| `app.js` | Notebook editor, pointer input, autosave, export UI |
| `pdf-export.js` | Dependency-free PDF export engine |
| `sw.js` | Offline caching of static application files |
| `manifest.webmanifest` | PWA metadata |
| `assets/icon.svg` | App icon |
| `.nojekyll` | Prevents unnecessary Jekyll processing on GitHub Pages |

## License

MIT. You may customize and publish the code for your teaching, personal, or institutional use. Folio Notes is an independent app; it is not affiliated with Goodnotes.
