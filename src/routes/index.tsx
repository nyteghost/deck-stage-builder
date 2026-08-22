import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stage Deck Planner — Top & Side Views" },
      { name: "description", content: "Plan a stage from 4×8 ft decks: holders, bridges, plan view and side elevation with height." },
      { property: "og:title", content: "Stage Deck Planner — Top & Side Views" },
      { property: "og:description", content: "Plan a stage from 4×8 ft decks with holder placement, bridges and a side elevation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),

  component: Index,
});

type Deck = { x: number; y: number; w: number; h: number; isBridge?: boolean };
type Holder = {
  // x,y,w,h in feet on the stage
  x: number;
  y: number;
  w: number;
  h: number;
  capacity: 1 | 2 | 3;
  label: string; // e.g. "H1"
};
type Bridge = {
  // a single 4×8 deck spanning between two adjacent holders (no holder needed)
  x: number;
  y: number;
  w: number;
  h: number;
  label: string; // e.g. "B1"
  between: [string, string]; // labels of the two holders it bridges
};

type Result =
  | { ok: true; decks: Deck[]; holders: Holder[]; bridges: Bridge[]; holderError?: string }
  | { ok: false; reason: string };

const INVENTORY = {
  totalDecks: 72,
  holders: {
    one:   { count: 4, capacity: 1 as const, footprint: "4 ft × 8 ft" },
    two:   { count: 8, capacity: 2 as const, footprint: "8 ft × 8 ft" },
    three: { count: 8, capacity: 3 as const, footprint: "12 ft × 8 ft" },
  },
};
const HOLDER_CAPACITY =
  INVENTORY.holders.one.count * 1 +
  INVENTORY.holders.two.count * 2 +
  INVENTORY.holders.three.count * 3;

const HOLDER_COLORS: Record<1 | 2 | 3, string> = {
  1: "rgba(59, 130, 246, 0.85)",   // blue
  2: "rgba(16, 185, 129, 0.85)",   // green
  3: "rgba(234, 88, 12, 0.85)",    // orange
};
const BRIDGE_COLOR = "rgba(234, 179, 8, 0.95)"; // yellow
const DECK_THICKNESS_IN = 4; // typical stage deck panel thickness
const MIN_HEIGHT_IN = 32;
const MAX_HEIGHT_IN = 44;
const HEIGHT_PRESETS = [32, 36, 40, 44];


type ElevationSegment = {
  label: string;
  x: number;
  w: number;
  kind: "holder" | "bridge";
  capacity?: 1 | 2 | 3;
};


/**
 * Best way to split a strip of K decks into pieces of size 1/2/3 using
 * the available holder counts, minimizing total holders used.
 * Returns null if impossible. Tries 3-deck first, then 2-deck, then 1-deck.
 */
type StripItem =
  | { kind: "holder"; size: 1 | 2 | 3 }
  | { kind: "bridge" };

/**
 * Best way to cover a strip of K decks using holders (size 1/2/3) and
 * "bridges" — single decks that span between two adjacent holders without
 * needing their own holder. Minimizes holders used, then bridges, drawing
 * from the shared inventory.
 */
function splitStrip(
  K: number,
  avail: { one: number; two: number; three: number },
): { items: StripItem[]; used: { one: number; two: number; three: number }; bridges: number } | null {
  let best: { c1: number; c2: number; c3: number; b: number; H: number } | null = null;
  for (let c3 = 0; c3 <= Math.min(avail.three, Math.floor(K / 3)); c3++) {
    for (let c2 = 0; c2 <= Math.min(avail.two, Math.floor((K - 3 * c3) / 2)); c2++) {
      const maxC1 = Math.min(avail.one, K - 3 * c3 - 2 * c2);
      for (let c1 = 0; c1 <= maxC1; c1++) {
        const covered = 3 * c3 + 2 * c2 + c1;
        const b = K - covered;
        if (b < 0) continue;
        const H = c1 + c2 + c3;
        // bridges need 2 holders at their ends → at most H-1 bridges
        if (b > 0 && H < 2) continue;
        if (b > Math.max(0, H - 1)) continue;
        // Score: bridges are valuable, single-deck holders are heavily penalized.
        // Tie-break on fewest total holders.
        const score = b * 2 - c1 * 5;
        const bestScore = best ? best.b * 2 - best.c1 * 5 : -Infinity;
        if (
          !best ||
          score > bestScore ||
          (score === bestScore && b > best.b) ||
          (score === bestScore && b === best.b && H < best.H)
        ) {
          best = { c1, c2, c3, b, H };
        }
      }

    }
  }
  if (!best) return null;
  // Build sequence: largest holders first, drop bridges between them.
  const holders: (1 | 2 | 3)[] = [];
  for (let i = 0; i < best.c3; i++) holders.push(3);
  for (let i = 0; i < best.c2; i++) holders.push(2);
  for (let i = 0; i < best.c1; i++) holders.push(1);
  const items: StripItem[] = [];
  let bridgesLeft = best.b;
  for (let i = 0; i < holders.length; i++) {
    items.push({ kind: "holder", size: holders[i] });
    if (i < holders.length - 1 && bridgesLeft > 0) {
      items.push({ kind: "bridge" });
      bridgesLeft--;
    }
  }
  return {
    items,
    used: { one: best.c1, two: best.c2, three: best.c3 },
    bridges: best.b,
  };
}

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

  type Attempt = {
    decks: Deck[];
    holders: Holder[];
    bridges: Bridge[];
    holderError?: string;
    totalHolders: number;
    totalBridges: number;
  };

  function buildOrientation(orientation: "horizontal" | "vertical"): Attempt | null {
    const decks: Deck[] = [];
    const strips: { decks: Deck[]; axis: "y" | "x" }[] = [];

    if (orientation === "horizontal") {
      if (a % 2 !== 0) return null;
      // decks 8×4, strips along Y
      for (let i = 0; i < a; i += 2) {
        const strip: Deck[] = [];
        for (let j = 0; j < b; j++) {
          const d = { x: i * 4, y: j * 4, w: 8, h: 4 };
          decks.push(d);
          strip.push(d);
        }
        strips.push({ decks: strip, axis: "y" });
      }
    } else {
      if (b % 2 !== 0) return null;
      // decks 4×8, strips along X
      for (let j = 0; j < b; j += 2) {
        const strip: Deck[] = [];
        for (let i = 0; i < a; i++) {
          const d = { x: i * 4, y: j * 4, w: 4, h: 8 };
          decks.push(d);
          strip.push(d);
        }
        strips.push({ decks: strip, axis: "x" });
      }
    }

    const avail = {
      one: INVENTORY.holders.one.count,
      two: INVENTORY.holders.two.count,
      three: INVENTORY.holders.three.count,
    };
    const holders: Holder[] = [];
    const bridges: Bridge[] = [];
    let holderError: string | undefined;
    let label = 1;
    let bridgeLabel = 1;

    const order = strips.map((_, i) => i).sort((p, q) => strips[q].decks.length - strips[p].decks.length);
    const stripHolders: Holder[][] = strips.map(() => []);
    const stripBridges: { afterHolderIdx: number; deck: Deck }[][] = strips.map(() => []);

    for (const idx of order) {
      const s = strips[idx];
      const split = splitStrip(s.decks.length, avail);
      if (!split) {
        holderError = `Not enough holders left for a strip of ${s.decks.length} decks.`;
        continue;
      }
      avail.one -= split.used.one;
      avail.two -= split.used.two;
      avail.three -= split.used.three;

      let cursor = 0;
      let lastHolderIdx = -1;
      for (const item of split.items) {
        if (item.kind === "holder") {
          const size = item.size;
          const first = s.decks[cursor];
          const last = s.decks[cursor + size - 1];
          const x = Math.min(first.x, last.x);
          const y = Math.min(first.y, last.y);
          const w = s.axis === "x" ? size * 4 : 8;
          const h = s.axis === "y" ? size * 4 : 8;
          stripHolders[idx].push({ x, y, w, h, capacity: size, label: "" });
          lastHolderIdx = stripHolders[idx].length - 1;
          cursor += size;
        } else {
          const deck = s.decks[cursor];
          deck.isBridge = true;
          stripBridges[idx].push({ afterHolderIdx: lastHolderIdx, deck });
          cursor += 1;
        }
      }
    }

    const allHolders = stripHolders.flat();
    const sorted = [...allHolders].sort((p, q) => (p.y - q.y) || (p.x - q.x));
    sorted.forEach((h) => {
      h.label = `H${label++}`;
    });
    sorted.forEach((h) => holders.push(h));

    stripBridges.forEach((list, idx) => {
      for (const { afterHolderIdx, deck } of list) {
        const left = stripHolders[idx][afterHolderIdx];
        const right = stripHolders[idx][afterHolderIdx + 1];
        if (!left || !right) continue;
        bridges.push({
          x: deck.x,
          y: deck.y,
          w: deck.w,
          h: deck.h,
          label: `B${bridgeLabel++}`,
          between: [left.label, right.label],
        });
      }
    });

    return {
      decks,
      holders,
      bridges,
      holderError,
      totalHolders: holders.length,
      totalBridges: bridges.length,
    };
  }

  const attempts: Attempt[] = [];
  for (const o of ["horizontal", "vertical"] as const) {
    const r = buildOrientation(o);
    if (r) attempts.push(r);
  }
  if (attempts.length === 0) {
    return { ok: false, reason: "Could not build this stage with available holders." };
  }
  // Prefer: no holder error, then MOST bridges, then fewest holders.
  attempts.sort((p, q) => {
    const pe = p.holderError ? 1 : 0;
    const qe = q.holderError ? 1 : 0;
    if (pe !== qe) return pe - qe;
    if (p.totalBridges !== q.totalBridges) return q.totalBridges - p.totalBridges;
    return p.totalHolders - q.totalHolders;
  });

  const best = attempts[0];
  return {
    ok: true,
    decks: best.decks,
    holders: best.holders,
    bridges: best.bridges,
    holderError: best.holderError,
  };
}


function Index() {
  const [width, setWidth] = useState(24);
  const [length, setLength] = useState(16);
  const [heightIn, setHeightIn] = useState(MIN_HEIGHT_IN);
  const [heightText, setHeightText] = useState(String(MIN_HEIGHT_IN));

  const [view, setView] = useState<"top" | "side" | "both">("both");

  const result = useMemo(() => planStage(width, length), [width, length]);
  const totalArea = width * length;

  const maxPx = 560;
  const scale = Math.min(maxPx / Math.max(width, 1), maxPx / Math.max(length, 1), 32);
  const canvasW = width * scale;
  const canvasH = length * scale;

  // Cross-section along the stage width, taken at the front edge (y = 0).
  const elevation = useMemo<ElevationSegment[]>(() => {
    if (!result.ok) return [];
    const segs: ElevationSegment[] = [];
    for (const h of result.holders) {
      if (h.y !== 0) continue;
      segs.push({ label: h.label, x: h.x, w: h.w, kind: "holder", capacity: h.capacity });
    }
    for (const br of result.bridges) {
      if (br.y !== 0) continue;
      segs.push({ label: br.label, x: br.x, w: br.w, kind: "bridge" });
    }
    return segs.sort((p, q) => p.x - q.x);
  }, [result]);

  const legCount = elevation.filter((s) => s.kind === "holder").length * 2;
  const surfaceTotalIn = heightIn + DECK_THICKNESS_IN;

  // Vertical scale for the elevation: inches → px (kept readable for short heights).
  const vScale = Math.min(Math.max(220 / Math.max(surfaceTotalIn, 1), 2), 8);
  const deckPx = Math.max(DECK_THICKNESS_IN * vScale, 6);
  const legPx = Math.max(heightIn * vScale, 0);
  const sideH = deckPx + legPx;
  const showTop = view === "top" || view === "both";
  const showSide = view === "side" || view === "both";


  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Stage Deck Planner</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lay out a stage using the fewest 4&#39;×8&#39; decks possible. Inventory: 72 decks, 4×1-deck (4&#39;×8&#39;) + 8×2-deck (8&#39;×8&#39;) + 8×3-deck (12&#39;×8&#39;) holders.
            A <span className="font-medium" style={{ color: BRIDGE_COLOR }}>bridge</span> is a single deck spanning between two holders — adds coverage without using another holder.
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

              <div>
                <label className="block text-sm font-medium">
                  Stage height (in){" "}
                  <span className="font-normal text-muted-foreground">— {MIN_HEIGHT_IN}&quot;–{MAX_HEIGHT_IN}&quot;</span>
                </label>
                <input
                  type="number"
                  min={MIN_HEIGHT_IN}
                  max={MAX_HEIGHT_IN}
                  step={1}
                  value={heightText}
                  onChange={(e) => {
                    const t = e.target.value;
                    setHeightText(t);
                    const n = Number(t);
                    if (t !== "" && Number.isFinite(n) && n >= MIN_HEIGHT_IN && n <= MAX_HEIGHT_IN) {
                      setHeightIn(n);
                    }
                  }}
                  onBlur={() => {
                    const n = Number(heightText);
                    const clamped = !Number.isFinite(n)
                      ? heightIn
                      : Math.min(MAX_HEIGHT_IN, Math.max(MIN_HEIGHT_IN, Math.round(n)));
                    setHeightIn(clamped);
                    setHeightText(String(clamped));
                  }}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />

                <div className="mt-2 flex flex-wrap gap-1">
                  {HEIGHT_PRESETS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHeightIn(h)}
                      className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                        heightIn === h
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {h}&quot;
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">View</label>
                <div className="mt-1 flex gap-1">
                  {(["top", "side", "both"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      className={`flex-1 rounded-md border px-2 py-1.5 text-xs capitalize transition-colors ${
                        view === v
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Stage area</span>
                  <span className="font-medium">{totalArea} sq ft</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Stage height</span>
                  <span className="font-medium">{heightIn}&quot;</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Surface height</span>
                  <span className="font-medium">{surfaceTotalIn}&quot; (incl. {DECK_THICKNESS_IN}&quot; deck)</span>
                </div>
                {result.ok && (
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted-foreground">Legs (front row)</span>
                    <span className="font-medium">{legCount}</span>
                  </div>
                )}

                {result.ok ? (
                  (() => {
                    const count = result.decks.length;
                    const overDecks = count > INVENTORY.totalDecks;
                    const totals = result.holders.reduce(
                      (acc, h) => {
                        if (h.capacity === 1) acc.one++;
                        if (h.capacity === 2) acc.two++;
                        if (h.capacity === 3) acc.three++;
                        return acc;
                      },
                      { one: 0, two: 0, three: 0 },
                    );
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
                          <span className={`font-semibold ${overDecks ? "text-destructive" : ""}`}>
                            {count} / {INVENTORY.totalDecks}
                          </span>
                        </div>
                        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          <div>{totals.three}× 3-deck holder (12&#39;×8&#39;)</div>
                          <div>{totals.two}× 2-deck holder (8&#39;×8&#39;)</div>
                          <div>{totals.one}× 1-deck holder (4&#39;×8&#39;)</div>
                          <div>{result.bridges.length}× bridge deck (4&#39;×8&#39;)</div>
                        </div>
                        {result.holderError && (
                          <div className="mt-1 text-xs font-medium text-destructive">
                            {result.holderError}
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

              {result.ok && result.holders.length > 0 && (
                <div className="rounded-md border border-border p-3 text-xs">
                  <div className="mb-2 font-semibold">Legend</div>
                  <div className="space-y-1">
                    {([3, 2, 1] as const).map((c) => (
                      <div key={c} className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-sm"
                          style={{ background: HOLDER_COLORS[c] }}
                        />
                        <span>{c}-deck holder ({c * 4}&#39;×8&#39;)</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-sm"
                        style={{ background: BRIDGE_COLOR }}
                      />
                      <span>Bridge deck (4&#39;×8&#39;)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {(!result.ok || showTop) && (
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              {result.ok ? (
                <>
                  <div className="mb-1 text-sm font-semibold">Top view (plan)</div>
                  <div className="mb-3 text-xs text-muted-foreground">
                    Each thin rectangle is one 4&#39;×8&#39; deck. Coloured outlines show holders.
                  </div>

                  <div className="overflow-auto">
                    <div
                      className="relative border border-border bg-muted/40"
                      style={{ width: canvasW || 1, height: canvasH || 1 }}
                    >
                      {result.decks.map((d, i) => (
                        <div
                          key={i}
                          className={`absolute flex items-center justify-center border border-background/60 text-[10px] font-medium ${
                            d.isBridge ? "text-black" : "bg-primary/70 text-primary-foreground"
                          }`}
                          style={{
                            left: d.x * scale,
                            top: d.y * scale,
                            width: d.w * scale,
                            height: d.h * scale,
                            ...(d.isBridge ? { background: BRIDGE_COLOR } : {}),
                          }}
                          title={d.isBridge ? "Bridge deck (no holder)" : `${d.w}ft × ${d.h}ft deck`}
                        >
                          {d.isBridge ? "BRIDGE" : `${d.w}×${d.h}`}
                        </div>
                      ))}
                      {result.holders.map((h, i) => (
                        <div
                          key={`h${i}`}
                          className="pointer-events-none absolute flex items-start justify-start"
                          style={{
                            left: h.x * scale,
                            top: h.y * scale,
                            width: h.w * scale,
                            height: h.h * scale,
                            border: `3px solid ${HOLDER_COLORS[h.capacity]}`,
                            boxSizing: "border-box",
                          }}
                          title={`${h.label}: ${h.capacity}-deck holder`}
                        >
                          <span
                            className="m-0.5 rounded px-1 text-[10px] font-bold text-white"
                            style={{ background: HOLDER_COLORS[h.capacity] }}
                          >
                            {h.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Scale: 1 ft ≈ {scale.toFixed(1)} px. Origin (0,0) is top-left.
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
            )}

            {result.ok && showSide && (
              <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <div className="mb-1 text-sm font-semibold">Side view (elevation)</div>
                <div className="mb-3 text-xs text-muted-foreground">
                  Looking at the front edge ({width} ft across). Deck surface sits {heightIn}&quot; off
                  the floor; slab is {DECK_THICKNESS_IN}&quot; thick, so the walking surface is{" "}
                  {surfaceTotalIn}&quot; total. Yellow sections are bridges — no leg beneath them.
                </div>
                <div className="overflow-auto pb-2">
                  <div className="flex items-end gap-3">
                    {/* height dimension marker */}
                    <div
                      className="relative shrink-0 text-[10px] text-muted-foreground"
                      style={{ height: sideH, width: 44 }}
                    >
                      <div
                        className="absolute right-0 border-r border-dashed border-border"
                        style={{ top: 0, height: sideH }}
                      />
                      <div className="absolute right-1 top-0 whitespace-nowrap">
                        {surfaceTotalIn}&quot;
                      </div>
                      <div
                        className="absolute right-1 whitespace-nowrap"
                        style={{ top: deckPx + legPx / 2 - 6 }}
                      >
                        {heightIn}&quot; legs
                      </div>
                    </div>

                    <div className="relative" style={{ width: canvasW || 1, height: sideH }}>
                      {/* deck slab */}
                      <div
                        className="absolute left-0 top-0 border border-border bg-muted/40"
                        style={{ width: canvasW || 1, height: deckPx }}
                      />
                      {elevation.map((s) => {
                        const color =
                          s.kind === "bridge" ? BRIDGE_COLOR : HOLDER_COLORS[s.capacity ?? 1];
                        return (
                          <div key={`seg-${s.label}`}>
                            <div
                              className="absolute flex items-center justify-center text-[10px] font-bold text-white"
                              style={{
                                left: s.x * scale,
                                top: 0,
                                width: s.w * scale,
                                height: deckPx,
                                background: color,
                                border: "1px solid rgba(0,0,0,0.25)",
                                boxSizing: "border-box",
                                color: s.kind === "bridge" ? "#000" : "#fff",
                              }}
                              title={
                                s.kind === "bridge"
                                  ? `${s.label}: bridge deck (unsupported span)`
                                  : `${s.label}: ${s.capacity}-deck holder`
                              }
                            >
                              {s.label}
                            </div>
                            {s.kind === "holder" && legPx > 0 && (
                              <>
                                <div
                                  className="absolute"
                                  style={{
                                    left: s.x * scale,
                                    top: deckPx,
                                    width: 6,
                                    height: legPx,
                                    background: color,
                                  }}
                                />
                                <div
                                  className="absolute"
                                  style={{
                                    left: (s.x + s.w) * scale - 6,
                                    top: deckPx,
                                    width: 6,
                                    height: legPx,
                                    background: color,
                                  }}
                                />
                              </>
                            )}
                          </div>
                        );
                      })}
                      {/* floor line */}
                      <div
                        className="absolute left-0 border-t-2 border-foreground/60"
                        style={{ top: sideH, width: canvasW || 1 }}
                      />
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Horizontal scale: 1 ft ≈ {scale.toFixed(1)} px. Vertical scale: 1 in ≈{" "}
                  {vScale.toFixed(1)} px (exaggerated for readability). Labels match the top view.
                </p>
              </div>
            )}



            {result.ok && result.holders.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <div className="mb-3 text-sm font-semibold">Holder placement</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="py-2 pr-3">Holder</th>
                        <th className="py-2 pr-3">Type</th>
                        <th className="py-2 pr-3">Decks</th>
                        <th className="py-2 pr-3">Footprint</th>
                        <th className="py-2 pr-3">Position (x, y) ft</th>
                        <th className="py-2 pr-3">Spans (ft)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.holders.map((h) => (
                        <tr key={h.label} className="border-b border-border/60 last:border-0">
                          <td className="py-2 pr-3 font-semibold">
                            <span
                              className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                              style={{ background: HOLDER_COLORS[h.capacity] }}
                            />
                            {h.label}
                          </td>
                          <td className="py-2 pr-3">{h.capacity}-deck</td>
                          <td className="py-2 pr-3">{h.capacity}</td>
                          <td className="py-2 pr-3">{h.w}&#39; × {h.h}&#39;</td>
                          <td className="py-2 pr-3">({h.x}, {h.y})</td>
                          <td className="py-2 pr-3">
                            x: {h.x}–{h.x + h.w}, y: {h.y}–{h.y + h.h}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.ok && result.bridges.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <div className="mb-3 text-sm font-semibold">Bridge placement</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="py-2 pr-3">Bridge</th>
                        <th className="py-2 pr-3">Between</th>
                        <th className="py-2 pr-3">Footprint</th>
                        <th className="py-2 pr-3">Position (x, y) ft</th>
                        <th className="py-2 pr-3">Spans (ft)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.bridges.map((br) => (
                        <tr key={br.label} className="border-b border-border/60 last:border-0">
                          <td className="py-2 pr-3 font-semibold">
                            <span
                              className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                              style={{ background: BRIDGE_COLOR }}
                            />
                            {br.label}
                          </td>
                          <td className="py-2 pr-3">{br.between[0]} ↔ {br.between[1]}</td>
                          <td className="py-2 pr-3">{br.w}&#39; × {br.h}&#39;</td>
                          <td className="py-2 pr-3">({br.x}, {br.y})</td>
                          <td className="py-2 pr-3">
                            x: {br.x}–{br.x + br.w}, y: {br.y}–{br.y + br.h}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
