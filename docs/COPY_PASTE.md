# Copy, cut and paste

## Text and images from other apps

Open a notebook page, finish any active writing, then press **⌘V** on Mac/iPad keyboards or **Ctrl+V** on Windows/Linux. Plain text becomes an editable Text object. A PNG, JPEG, WebP or GIF image becomes an editable image that supports moving, resizing, rotation and cropping. Pasting while a normal text field is focused keeps that field's native text-editing behavior.

On touch devices, choose **Notebook options → Paste…**. If the browser asks, use its Paste action. If direct clipboard reading is restricted, a paste box opens: long-press inside it, choose the device's **Paste** command, then tap **Insert text**. An empty clipboard also opens this box. Close or Cancel discards the draft. The app does not change browser permissions or monitor the clipboard automatically.

Text initially pastes as plain text; external rich formatting is not retained. Select the pasted text and choose **Notebook options → Edit selected text…** to modify its content and set font, size, color and formatting. See [Text editing](TEXT_EDITING.md). Web addresses remain text, and pasted HTML/script-looking text is never executed. Document files use **Import PDF** or **Open notebook**, rather than clipboard insertion. Images keep transparency when converted to PNG; animated images become a still image. Source images are limited to 25 MB and reduced to at most 1500 pixels on their longest side. Text is limited to 100,000 characters per paste.

## Editable objects within WiNDS Notes

1. Choose **Select** and tap a text object, stroke, shape, image or sticker.
2. Use its **Copy / Cut** controls, **⌘C / ⌘X** (or Ctrl), or the commands in **Notebook options**.
3. Open the destination page or notebook in the same account and choose **Notebook options → Paste copied object**. This preserves editable object data even when the browser's system clipboard cannot carry custom formats. It works with ordinary notebook pages and PDF annotation pages.
4. Drag the pasted object with Select. Repeated pastes are offset slightly so copies are visible. Paste/cut support Undo and Redo.

Selection currently targets one object at a time. Each pasted object receives a new ID; Artist material/flow/pressure, shape fill/border, image crop/rotation and sticker data remain intact. PDF backgrounds remain fixed and are not selection objects. **Duplicate current page** copies a whole PDF page with its annotations.

When supported, system Copy includes editable WiNDS data and a PNG representation of non-text objects for other apps. Text also provides `text/plain`. Browser support for custom clipboard formats varies; **Paste copied object** is the reliable editable route inside the current tab. If system writing is denied, the app explicitly reports that the copy/cut is within WiNDS.

## Persistence and account isolation

Inserted content is ordinary notebook data: local autosave, native version-1 files, exports and enabled Drive synchronization retain it. The internal copied-object buffer is temporary and clears on refresh or account switch/sign-out. It is not saved to localStorage or uploaded. The system clipboard remains under the device's control; explicitly copied content can remain there until the user replaces it. An explicit system paste into another account is a new user action; internal account buffers are never carried over automatically.

Asynchronous clipboard/image work captures the destination account, notebook and page, then rechecks them before insertion. Cancelling a pending paste prevents insertion. Cutting verifies that neither the selected object nor the notebook version changed while system copying was pending. Image conversion, validation and full canvas updates run after active input, with a brief Pencil quiet interval. No clipboard work was added to Pencil pointer or touch handlers.

## Deployment and verification

Publish the updated core app files **and `clipboard.js`**, along with all existing PDF assets. The service-worker cache is v40. Static GitHub Pages and the optional Node/Docker server both support the new module; no backend is needed for clipboard use. Browser clipboard APIs generally need HTTPS or localhost and user interaction. See [WebKit's clipboard guidance](https://webkit.org/blog/10855/async-clipboard-api/) and the [Clipboard API standard](https://www.w3.org/TR/clipboard-apis/).

Automated tests cover data preservation and validation, fresh IDs, translation, external text/image routing, native input fields, keyboard commands, permission fallback, cancellation, account/page changes, delayed cuts and input deferral. Browser verification covered text and PNG paste, native text editing, copying ink between pages, cut/undo/redo, system PNG/custom formats, native export/reopen and the touch paste box. Physical iPad/Apple Pencil and real Google transfer were not available.

Multi-stroke handwriting selection is available through **Area select handwriting (L)**. Box complete strokes, move them as a group, and use the same Copy/Cut/Paste commands. See [Selection and scrolling](ERASER_SELECTION_SCROLLING.md).

**Erase pasted content:** Tap **Eraser** and leave its target on **All objects** (the default). Only the brushed area is removed; the rest of the pasted text, image or stroke remains. **Ink only** intentionally protects pasted text and images. Use the small arrow beside Eraser to adjust the saved diameter. A normal tap selects Eraser without opening settings.
