# Pin connectors on the top view

Add SICO VMP pin connectors to the plan drawing so it is clear where each connector goes at holder corners and which way it faces.

## What gets added

**Connector symbols on the top view**
- A small drawn connector icon at every corner point of every holder (and at bridge-deck corners where they land on a holder corner).
- Each icon shows only the pins/V-slots for the directions that actually have a deck or holder meeting at that corner: 2-way at stage edges, 3-way along interior runs, 4-way where four decks meet.
- A short reference mark (matching the yellow tab in the photo) is drawn on every connector pointing the same way — toward the stage front — so the required rotation is unambiguous.
- Icons scale with the drawing and stay legible at large stage sizes; duplicate corners shared by adjacent holders collapse into one connector.

**Legend**
- The uploaded connector photo appears once in the legend, with a caption explaining the pins seat the decks and the tab shows orientation, plus the 2/3/4-way symbol key.

**Connector table**
- New "Pin connector placement" table below the holder and bridge tables: connector label (C1, C2, …), grid position in feet, way-count (2/3/4-way), rotation in degrees, and which holders/decks it joins.
- Total connector count added to the summary panel.

**Toggle**
- A "Show connectors" checkbox near the view toggle so the plan can be read without them.

## Notes on the stage model

The PDF confirms this is the SICO Venue Maker Pro with 4-way bridging and 4'×8', 8'×8', 12'×8' frames, matching the planner's existing holder sizes — no change to the layout algorithm, inventory, or bridge logic. This is a drawing/reporting addition only.

## Technical details

- Derive connectors in `src/routes/index.tsx` from the existing `holders` / `decks` / `bridges` output: collect the 4 corner points of each holder into a map keyed by `x,y`, then compute which of the four quadrants around each point is occupied by a deck to get the way-count and rotation.
- Render as SVG groups (circle body + tapered pin shapes + tab marker) inside the existing top-view drawing, positioned by the same feet-to-pixels scale.
- Upload the connector photo as a CDN asset pointer and import it for the legend image only.
