# Edit text and fonts

Choose **Select**, tap a pasted or typed text box, then choose **Notebook options → Edit selected text…**. Change the words and formatting, then choose **Apply changes**. **Cancel** or Escape discards the draft. On a desktop, double-click a text box in Select mode to open the editor.

The panel includes nine font choices, size (1–300), color, bold, italic, underline, left/center/right alignment, line spacing (0.8–3) and text-box width (1–2200). It formats the whole text box. Character-range rich formatting is not included. The text area previews the font and emphasis; it wraps to the dialog's own width while the notebook wraps to the saved box width. Long unbroken words wrap rather than extending beyond the box.

The **Text** tool still supports quick editing: choose Text and tap existing text. It preserves the font and formatting while you type. Escape or tapping outside commits that inline edit. Native text selection and copy/paste remain available in both editing fields. ⌘/Ctrl+Enter applies the formatting dialog; Enter inside its text area creates a new line.

Formatting and content apply as one undoable change. Applying an empty text box removes it, as in the existing inline editor; Undo restores it. Your last applied font/size/emphasis/alignment/spacing become the default for new typed or pasted text in the current tab. New text still uses the current ink color. Existing text keeps its own settings. The default drawing width remains 7.

Fonts come from the device: Arial, Georgia, Times New Roman, Verdana, Trebuchet MS, Courier New, Palatino, Chalkboard SE and System. If a named font is unavailable, its defined fallback is used. No remote font service or added font download is required.

## Saving, copying and synchronization

Text fields `fontFamily`, `bold`, `italic`, `underline`, `align` and `lineHeight` are optional additions to native format version 1. Older text without these fields keeps its original Arial/normal/left/1.42 defaults. Size, color, width, position and text content remain in their existing fields.

Editor rendering, selection bounds, thumbnails, PNG/JPEG and PDF export use the same text layout and renderer. Native files, editable clipboard payloads, undo/redo, private Drive data and shared notebook edit history retain the optional settings. Update all collaborating devices before exchanging formatted text; older clients can discard fields they do not understand. System plain-text clipboard representations remain plain text; use **Paste copied object** to retain editable WiNDS formatting where needed.

The formatting dialog stages changes until Apply. Incoming private/shared Drive replacements and live-preview work defer while it is open. Applying checks the captured account, notebook, page, item reference and editing version. Changing accounts closes the draft; a stale draft cannot overwrite another page or a collaborator's newer edit. The Pencil pointer/touch event functions remain unchanged.

## Deployment and verification

Publish the full updated bundle including **`text-tools.js`**, `native-file.js`, `app.js`, `index.html`, `styles.css` and `sw.js`. Cache v37 includes the new module. The optional Node server and Dockerfile include its static route/file. No backend is needed for text editing.

Automated checks cover legacy defaults, native/backup/clipboard/shared compatibility, allowed fonts, safe normalization, font layout/alignment/underline/spacing, Unicode word wrapping, draft/cancel/apply behavior, one undo snapshot, stale account/page/version guards, cloud deferral and keyboard toolbar activation. Browser verification covered pasted text, content/font/color changes, undo/redo, copy between pages, native reopen, inline editing and tablet/phone layouts. Actual iPad/Apple Pencil and live Google transfer remain device/deployment checks.
