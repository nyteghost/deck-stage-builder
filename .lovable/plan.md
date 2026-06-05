## Goal

Make "use as many bridges as possible" the primary objective of the planner, instead of being a tiebreaker behind "fewest holders."

## Changes in `src/routes/index.tsx`

### 1. `splitStrip()` — flip the objective
Current scoring inside the c3/c2/c1 search:
```
prefer fewest holders, then most bridges
```
Change to:
```
prefer MOST bridges, then fewest holders (as a soft tiebreaker only)
```
Inventory is still respected (`c1 ≤ avail.one`, etc.) and the structural constraint `b ≤ H - 1` stays, so bridges always have two holder endpoints.

Effect per strip: the splitter will pick the combo of 1/2/3-deck holders that leaves the most single-deck gaps to bridge, e.g. for a 6-deck strip it will choose 3-deck + bridge + 2-deck (1 bridge) over 3-deck + 3-deck (0 bridges).

### 2. `planStage()` orientation chooser — flip the objective
Currently sorts the two orientation attempts by:
```
fewest holders, then most bridges
```
Change to:
```
most bridges, then fewest holders
```
Holder-error attempts still get pushed last. This lets a 24×24 (or any stage where both orientations are valid) pick the orientation that yields more bridge slots.

### 3. Leave intact
- Inventory caps (4 × 1-deck, 8 × 2-deck, 8 × 3-deck).
- The `b ≤ H - 1` rule (each bridge needs a holder on each side).
- All UI, tables, legend, deck-count display.

## Trade-off the user should know about

Maximizing bridges will sometimes use *more* holders than the previous strategy (e.g. a 4-deck strip currently solves as one 3-deck + one 1-deck holder with 0 bridges; the new strategy may prefer 2-deck + bridge + 1-deck = 2 holders + 1 bridge, vs. previously 2 holders + 0 bridges — same holder count here, but in other strip lengths the bridge-max solution can cost an extra holder). Inventory limits still apply, so if a holder type runs out the planner falls back to whatever combination fits.
