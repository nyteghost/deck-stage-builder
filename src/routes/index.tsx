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

type Deck = { x: number; y: number; w: number; h: number };

type Result =
  | { ok: true; decks: Deck[] }
  | { ok: false; reason: string };

const INVENTORY = {
  totalDecks: 72,
  holders: {
    // count = how many of this holder you own
    // capacity = decks it carries
    // footprint = on-ground size in feet (w × d)
    one:   { count: 4, capacity: 1, footprint: "4 ft × 8 ft" },
    two:   { count: 8, capacity: 2, footprint: "8 ft × 8 ft" },
    three: { count: 8, capacity: 3, footprint: "12 ft × 8 ft" },
  },
};
const HOLDER_CAPACITY =
  INVENTORY.holders.one.count * INVENTORY.holders.one.capacity +
  INVENTORY.holders.two.count * INVENTORY.holders.two.capacity +
  INVENTORY.holders.three.count * INVENTORY.holders.three.capacity;

/**
 * Greedy pack: fill the largest holders first so we use the fewest carts.
 * Returns null if the decks won't fit in the available holders.
 */
function packHolders(deckCount: number) {
  let remaining = deckCount;
  const three = Math.min(INVENTORY.holders.three.count, Math.floor(remaining / 3));
  remaining -= three * 3;
  const two = Math.min(INVENTORY.holders.two.count, Math.floor(remaining / 2));
  remaining -= two * 2;
  const one = Math.min(INVENTORY.holders.one.count, remaining);
  remaining -= one;
  if (remaining > 0) return null;
  return { three, two, one };
}

/**
 * A 4'x8' deck covers two 4'x4' cells. Tiling a W×L stage with the minimum
 * number of decks is equivalent to tiling a (W/4)×(L/4) grid with 1×2
 * dominoes. Feasible iff both W and L are multiples of 4 AND at least one
 * is a multiple of 8 (so the cell grid has an even side).
 */
function planStage(widthFt: number, lengthFt: number): Result {
  if (widthFt <= 0 || lengthFt <= 0) {
    return { ok: false, reason: "Enter a width and length greater than zero." };
  }
  if (widthFt % 4 !== 0 || lengthFt % 4 !== 0) {
    return {
      ok: false,
      reason:
        "Both width and length must be multiples of 4 ft — 4×8 decks can't be cut to fit otherwise.",
    };
  }
  const a = widthFt / 4;
  const b = lengthFt / 4;
  if (a % 2 !== 0 && b % 2 !== 0) {
    return {
      ok: false,
      reason:
        "This size can't be built from whole 4×8 decks: at least one side must be a multiple of 8 ft.",
    };
  }

  const decks: Deck[] = [];
  if (a % 2 === 0) {
    for (let j = 0; j < b; j++) {
      for (let i = 0; i < a; i += 2) {
        decks.push({ x: i * 4, y: j * 4, w: 8, h: 4 });
      }
    }
  } else {
    for (let i = 0; i < a; i++) {
      for (let j = 0; j < b; j += 2) {
        decks.push({ x: i * 4, y: j * 4, w: 4, h: 8 });
      }
    }
  }
  return { ok: true, decks };
}

function Index() {
  const [width, setWidth] = useState(24);
  const [length, setLength] = useState(16);

  const result = useMemo(() => planStage(width, length), [width, length]);
  const totalArea = width * length;

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
            Lay out a stage using the fewest 4&#39;×8&#39; decks possible. Inventory: 72 decks, 4×1-deck + 8×2-deck + 8×3-deck holders.
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
                {result.ok ? (
                  (() => {
                    const count = result.decks.length;
                    const overDecks = count > INVENTORY.totalDecks;
                    const pack = packHolders(count);
                    return (
                      <>
                        <div className="flex justify-between py-0.5">
                          <span className="text-muted-foreground">Orientation</span>
                          <span className="font-medium">
                            {result.decks[0]?.w === 8 ? "8 ft across" : "8 ft deep"}
                          </span>
                        </div>
                        <div className="mt-2 flex justify-between border-t border-border pt-2">
                          <span className="text-muted-foreground">Decks required</span>
                          <span
                            className={`font-semibold ${overDecks ? "text-destructive" : ""}`}
                          >
                            {count} / {INVENTORY.totalDecks}
                          </span>
                        </div>
                        {pack ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Holders: {pack.three}×3-deck, {pack.two}×2-deck, {pack.one}×1-deck
                          </div>
                        ) : (
                          <div className="mt-1 text-xs font-medium text-destructive">
                            Won&#39;t fit in your holders (cap {HOLDER_CAPACITY} decks: 8×3 + 8×2 + 4×1).
                          </div>
                        )}
                        {overDecks && (
                          <div className="mt-1 text-xs font-medium text-destructive">
                            Exceeds your 72-deck inventory by {count - INVENTORY.totalDecks}.
                          </div>
                        )}
                      </>
                    );
                  })()
                ) : (
                  <div className="mt-2 border-t border-border pt-2 font-medium text-destructive">
                    Not buildable
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            {result.ok ? (
              <>
                <div className="mb-3 text-xs text-muted-foreground">
                  Each rectangle is one 4&#39;×8&#39; deck.
                </div>
                <div className="overflow-auto">
                  <div
                    className="relative border border-border bg-muted/40"
                    style={{ width: canvasW || 1, height: canvasH || 1 }}
                  >
                    {result.decks.map((d, i) => (
                      <div
                        key={i}
                        className="absolute flex items-center justify-center border border-background/60 bg-primary text-[10px] font-medium text-primary-foreground"
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
                    ))}
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Scale: 1 ft ≈ {scale.toFixed(1)} px.
                </p>
              </>
            ) : (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                <p className="font-semibold">Can&#39;t build this stage</p>
                <p className="mt-1">{result.reason}</p>
                <p className="mt-2 text-destructive/80">
                  Try sizes where both dimensions are multiples of 4 ft and at least one is a multiple of 8 ft (e.g. 16×20, 24×16, 32×12).
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
