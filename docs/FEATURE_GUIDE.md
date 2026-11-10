# WiNDS Notes creative studio — version 1.4

## Continuous color filling

Click the main **Fill** button once. It remains selected while you tap different closed sections. Change color using the adjacent color chip, the toolbar palette or custom colors. The settings arrow beside Fill opens opacity, border controls and the mandala studio; **Continue filling** closes that panel without leaving Fill. Choose Pen, Pan or another tool, or press Escape, to finish. Quick successive taps are processed in order with their chosen colors. Idle automatic synchronization continues while Fill is selected.

## Mandala library

Open **Fill settings (⌄) → Mandala coloring pages…**. Browse 100 designs or filter by Floral, Geometric, Celestial, Ornamental, Nature, Animals, Birds, Ocean and Buddha & Zen. The new 50 intricate illustrations include animal portraits, marine life, seated Buddha figures, a Bodhi tree and Buddhist/Zen motifs. Search names, descriptions or difficulty words such as Calm or Intricate. Choose a design and **Add coloring page**, then select the main Fill tool to color its sections. New templates use a separate blank page, preserving existing notes. Previews load as they become visible.

The illustrated collection uses individually composed artwork with natural animal proportions, botanical filigree and coordinated borders. All 50 illustrations are local files included in the offline installation; the initial download is larger than earlier releases. Newly added pages use the revised art. Existing coloring pages keep their saved image and colors. Zoom in for the finest sections. See [all illustrated designs](illustrated-mandalas-preview.png).

## Shape fill and border

1. Open a notebook and select the **⌄ settings arrow beside Fill** in the top toolbar.
2. Choose solid fill, a fill color, and opacity; leave fill disabled for a transparent interior.
3. Under **Border / Outline**, choose a completely independent line color, width (1–32), and style: solid, dashed, dotted, or no border.
4. Tap the **⌄** beside the **Shapes** button, choose Star, Rectangle, Square, Circle, Ellipse, Triangle, Diamond, Line or Arrow, and draw. The Shapes button keeps your last choice (keyboard: **R**).
5. To edit an existing figure, use **Select** → tap the figure → **Fill settings (⌄)** → change the settings. Click **Apply fill & border to selected shape** if needed.

Line and Arrow do not take a fill, but their borders can be styled. Existing outline-only notebooks still open with a solid border.

## Artist mode (10 choices)

| Tool | Appearance |
| --- | --- |
| 2H | Very fine, light graphite |
| H | Fine light graphite |
| HB | Standard pencil |
| B | Soft pencil |
| 2B | Darker shading |
| 4B | Rich graphite |
| 6B | Heavy graphite |
| Charcoal | Broad, textured dark strokes |
| Ink Brush | Opaque, pressure-responsive colored ink |
| Color Pencil | Soft colored pencil texture |

Tap **Artist** in the horizontal toolbar, choose a brush, and draw with a stylus, finger or mouse. The size slider ranges from **1 to 32**. Colored Ink Brush and Color Pencil use the selected ink color. Brush variation responds to stylus pressure when available; no extra network or saving work occurs during pen movements.

## Images, stickers and resizing

**Stylus only** starts enabled: use Pencil to draw or edit, and fingers to scroll and pinch. Mouse editing remains available. You can turn it off for finger input; the app remembers that choice in this browser.

Choose **Select**, tap an object, then drag it to move. Tapping outside a handwriting group lets you select another item. Dragging and resizing show a live preview and save one undoable change when finished. Selection hit areas remain consistent as you zoom, and empty corners around diagonal or curved shapes no longer capture unrelated objects.

- Import an image or insert a smiley. The app automatically selects the new item.
- Four corner grips surround a selected image, sticker or shape. Drag them to resize with the **Select** tool.
- Select an object and open **Notebook options → Size and angle** for the width field and its ± buttons.
- Image aspect ratio is retained, emoji stickers remain square, and selection can be undone/redone.
- Exports and `.winds-notes` files preserve the changed object size.

## Zoom

- Two-finger pinch and pan work on the drawing surface.
- Tap the zoom percentage to choose 50%, 100%, 150%, 200%, 300%, 400%, 600%, or 800%.
- Pinch also allows intermediate values from 35% to 800%.
- Zoom does not change exported page dimensions.

## Codex handoff

Read `AGENTS.md` before making changes to the pointer event pipeline. The rapid Apple Pencil missing-letter fix has been confirmed on a physical iPad in an earlier release and must not be weakened. Run `npm run check` before merging.

Real Apple Pencil performance must be checked on the user's iPad after deployment; headless browser input is only a simulation.
