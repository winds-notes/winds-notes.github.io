# Mandala artwork and deployment — v65

All 50 illustrated designs have been replaced with individually composed artwork: 25 animals, eight birds, seven ocean designs and ten Buddha/Zen designs. Natural anatomy, subject-specific botanical ornament and coordinated borders replace the earlier procedural masks and repetitive grid textures. The original 50 geometric/floral designs remain available, for 100 designs in total.

See [the complete illustrated collection](illustrated-mandalas-preview.png) or [the animal collection](animal-mandalas-preview.png). New pages use the revised art. Existing colored pages retain their saved image and colors.

## Artwork authoring

The illustrations were created as 50 separate assets with the built-in image generation tool, with transparent backgrounds. [The prompt set](mandala-art-prompts.json) records the shared brief, each subject and the independent lion prompt. The selected, losslessly compressed WebP authoring files are in artwork/mandalas/ in the local workspace. All 50 decoded RGBA images match their generated PNG sources exactly, including alpha.

The deployable assets are assets/mandalas/*.js. Each contains a WebP data URL and one registration call. The app loads the requested file, decodes its image and removes the script element. The encoded pixels are unchanged. Using a data URL keeps the notebook canvas exportable when the app is opened directly from index.html; drawing a local image file directly can taint the canvas. No image-generation account, service or API call is used by the running app.

## Required upload

Upload the complete v65 deployment package, including **all 50 files inside assets/mandalas/**, together with index.html, app.js, creative-tools.js, mandala-art.js, mandala-tools.js and sw.js. Preserve the folder path and file names. Root JavaScript files alone cannot supply the artwork. The previous partial live deployment returned 404 for the lion asset, which prevented page insertion.

The offline worker downloads the artwork pack after the shell, with two artwork requests at a time. The first installation is larger; the pack is available offline once that installation completes. The deployment ZIP includes the runtime files and previews without duplicating the raw authoring images. Do not clear notebook storage to update artwork.

## Verification

Every illustrated design was visually reviewed and passed a browser check for transparent background and multiple enclosed coloring regions. All 25 animal designs were individually added to a fresh test notebook. Hosted-style and direct-file page insertion, coloring, Undo/Redo, native-file roundtrip, save/reload, mobile layout and offline insertion were checked with downloads disabled. Physical iPad/Apple Pencil testing was unavailable; the Pencil input code is unchanged.
