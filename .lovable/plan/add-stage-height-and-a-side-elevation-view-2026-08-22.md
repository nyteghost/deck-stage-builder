# Add stage height and a side (elevation) view

Yes — with a height input the planner can show a second drawing: the stage seen from the side, next to the existing top-down view.

## What you'll get

1. **New "Stage height (in)" input** in the settings panel, alongside width and length.
2. **Two views, both on screen:**
   - **Top view** (existing): decks, holders coloured by capacity, bridges in yellow, labels.
   - **Side view** (new): the stage seen from the front edge — deck surface as a slab at the given height, legs/supports drawn down to the floor, floor line, and a height dimension marker.
3. **View toggle**: Top / Side / Both (defaults to Both), so the side view can be seen large on its own.
4. **Info stays on the views:**
   - Top view keeps holder labels (H1, H2…) and bridge labels (B1…).
   - Side view labels each column across the stage with the holder or bridge it belongs to (matching the same colours), so the two drawings read together.
   - Side view annotates deck thickness, leg height, and total surface height, plus overall span in feet.
5. **Summary panel** gains: stage height, total surface height (height + deck thickness), and leg count.

## Side view details

- Which cross-section: the side view is taken along the stage width (looking at the front edge), showing every 4 ft column across that edge and which holder/bridge sits there.
- Legs are drawn at each holder's outer edges; bridge sections are drawn with no leg beneath them, which visually shows the unsupported span.
- Common stage heights (16", 24", 32", 40", 48") offered as quick-pick buttons; any height can still be typed.

## Technical notes

- All work stays in `src/routes/index.tsx`.
- `planStage` output is unchanged; a small derived helper maps holders/bridges to their span along the chosen cross-section axis for the elevation drawing.
- Side view is rendered with the same absolutely-positioned `div` approach and the same `scale` (ft → px), with a separate vertical scale for inches so short heights stay visible.
- Colours reuse the existing `HOLDER_COLORS` / `BRIDGE_COLOR` tokens.

## Open assumption

Deck thickness is assumed to be a fixed 4 in (typical stage deck panel). Say the word if yours differs and I'll make it an input.
