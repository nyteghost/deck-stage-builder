import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stage Deck Planner" },
      { name: "description", content: "Plan a stage layout from 4×8 ft decks." },
    ],
  }),
  component: Index,
});

type Deck = { x: number; y: number; w: number; h: number; rot: boolean };

// Greedy layout: fill row-by-row, preferring 8ft length along width, then trim with rotated/cut pieces.
function layoutDecks(widthFt: number, lengthFt: number): { decks: Deck[]; full: number; cut: Deck[] } {
  const decks: Deck[] = [];
  const cut: Deck[] = [];
  let full = 0;

  let y = 0;
  while (y < lengthFt) {
    const rowH = Math.min(4, lengthFt - y);
    let x = 0;
    while (x < widthFt) {
      const remW = widthFt - x;
      // Try 8x4 orientation
      if (remW >= 8 && rowH >= 4) {
        decks.push({ x, y, w: 8, h: 4, rot: false });
        full++;
        x += 8;
      } else if (remW >= 4 && rowH >= 8 - 4 && false) {
        // skip
      } else if (remW >= 4 && rowH >= 4) {
        // 4x4 half (rotated/half deck or cut)
        const w = Math.min(4, remW);
        decks.push({ x, y, w, h: rowH, rot: true });
        if (w < 4 || rowH < 4) cut.push({ x, y, w, h: rowH, rot: true });
        else full++; // counts as a deck (rotated)
        x += w;
      } else {
        // cut piece
        const w = remW;
        decks.push({ x, y, w, h: rowH, rot: false });
        cut.push({ x, y, w, h: rowH, rot: false });
        x += w;
      }
    }
    y += rowH;
  }

  return { decks, full, cut };
}

function Index() {
  const [width, setWidth] = useState(24);
  const [length, setLength] = useState(16);

  const { decks, full, cut } = useMemo(
    () => layoutDecks(Math.max(0, width), Math.max(0, length)),
    [width, length],
  );

  const totalArea = width * length;
  const deckCount = Math.ceil(totalArea / 32);

  // Scale to fit canvas
  const maxPx = 560;
  const scale = Math.min(maxPx / Math.max(width, 1), maxPx / Math.max(length, 1), 32);
  const canvasW = width * scale;
  const canvasH = length * scale;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Stage Deck Planner</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lay out a stage using standard 4&#39;×8&#39; decks. Enter your target dimensions in feet.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Width (ft)</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Length / Depth (ft)</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={length}
                  onChange={(e) => setLength(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Stage area</span>
                  <span className="font-medium">{totalArea} sq ft</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Pieces placed</span>
                  <span className="font-medium">{decks.length}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Full 4×8 decks</span>
                  <span className="font-medium">{full}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Cut / partial</span>
                  <span className="font-medium">{cut.length}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground">Decks to buy (≥)</span>
                  <span className="font-semibold">{deckCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm bg-primary" /> Full 4×8
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm bg-accent-foreground/40" /> Rotated / half
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm bg-destructive/70" /> Cut piece
              </div>
            </div>

            <div className="overflow-auto">
              <div
                className="relative border border-border bg-muted/40"
                style={{ width: canvasW || 1, height: canvasH || 1 }}
              >
                {decks.map((d, i) => {
                  const isCut = cut.includes(d);
                  const bg = isCut
                    ? "bg-destructive/70"
                    : d.rot
                      ? "bg-accent-foreground/40"
                      : "bg-primary";
                  return (
                    <div
                      key={i}
                      className={`absolute flex items-center justify-center border border-background/60 text-[10px] font-medium text-primary-foreground ${bg}`}
                      style={{
                        left: d.x * scale,
                        top: d.y * scale,
                        width: d.w * scale,
                        height: d.h * scale,
                      }}
                      title={`${d.w}ft × ${d.h}ft`}
                    >
                      {d.w}×{d.h}
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Scale: 1 ft ≈ {scale.toFixed(1)} px. Dimensions outside multiples of 4 ft will require cut pieces (shown in red).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
