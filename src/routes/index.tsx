import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";



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
 * Ways to cut a run of `r` adjacent decks into holders of 1/2/3 decks,
 * preferred order: fewest 1-deck holders, then fewest holders overall.
 */
function runOptions(r: number): { three: number; two: number; one: number }[] {
  const opts: { three: number; two: number; one: number }[] = [];
  for (let c3 = Math.floor(r / 3); c3 >= 0; c3--) {
    for (let c2 = Math.floor((r - 3 * c3) / 2); c2 >= 0; c2--) {
      const c1 = r - 3 * c3 - 2 * c2;
      if (c1 < 0) continue;
      opts.push({ three: c3, two: c2, one: c1 });
    }
  }
  opts.sort((p, q) => (p.one - q.one) || (p.three + p.two + p.one - (q.three + q.two + q.one)));
  return opts;
}

type Stock = { decks: number; one: number; two: number; three: number };

const FULL_STOCK: Stock = {
  decks: INVENTORY.totalDecks,
  one: INVENTORY.holders.one.count,
  two: INVENTORY.holders.two.count,
  three: INVENTORY.holders.three.count,
};

function planStage(widthFt: number, lengthFt: number, stock: Stock = FULL_STOCK): Result {
  if (widthFt <= 0 || lengthFt <= 0) {
    return { ok: false, reason: "Enter a width and length greater than zero." };
  }
  if (widthFt % 4 !== 0 || lengthFt % 4 !== 0) {
    return {
      ok: false,
      reason:
        "Both width and length must be multiples of 4 ft \u2014 4\u00d78 decks can't be cut to fit otherwise.",
    };
  }
  const a = widthFt / 4;
  const b = lengthFt / 4;
  if (a % 2 !== 0 && b % 2 !== 0) {
    return {
      ok: false,
      reason:
        "This size can't be built from whole 4\u00d78 decks: at least one side must be a multiple of 8 ft.",
    };
  }

  type Attempt = {
    decks: Deck[];
    holders: Holder[];
    bridges: Bridge[];
    holderError?: string;
    totalHolders: number;
    totalBridges: number;
    singles: number;
  };

  // A "pattern" decides which decks are carried as bridges instead of sitting
  // on their own holder:
  //  - crossOffset: whole strips (every other one) are bridged, resting on the
  //    holders in the strips either side.
  //  - inOffset: inside a holder strip, every other deck bridges between the
  //    two holders next to it.
  type Pattern = { crossOffset: number | null; inOffset: number | null };

  function buildOrientation(
    orientation: "horizontal" | "vertical",
    pattern: Pattern,
  ): Attempt | null {
    const decks: Deck[] = [];
    const strips: { decks: Deck[]; axis: "y" | "x" }[] = [];

    if (orientation === "horizontal") {
      if (a % 2 !== 0) return null;
      // decks 8\u00d74, strips along Y
      for (let i = 0; i < a; i += 2) {
        const strip: Deck[] = [];
        for (let j = 0; j < b; j++) {
          const d: Deck = { x: i * 4, y: j * 4, w: 8, h: 4 };
          decks.push(d);
          strip.push(d);
        }
        strips.push({ decks: strip, axis: "y" });
      }
    } else {
      if (b % 2 !== 0) return null;
      // decks 4\u00d78, strips along X
      for (let j = 0; j < b; j += 2) {
        const strip: Deck[] = [];
        for (let i = 0; i < a; i++) {
          const d: Deck = { x: i * 4, y: j * 4, w: 4, h: 8 };
          decks.push(d);
          strip.push(d);
        }
        strips.push({ decks: strip, axis: "x" });
      }
    }

    const S = strips.length;
    const K = strips[0].decks.length;

    // ---- decide which cells are bridges ----
    const isBridge: boolean[][] = strips.map(() => new Array(K).fill(false));
    const bridgedStrip: boolean[] = new Array(S).fill(false);
    if (pattern.crossOffset !== null && S >= 3) {
      for (let s = 1; s < S - 1; s++) {
        if ((s - pattern.crossOffset) % 2 === 0) {
          bridgedStrip[s] = true;
          for (let p = 0; p < K; p++) isBridge[s][p] = true;
        }
      }
    }
    if (pattern.inOffset !== null && K >= 3) {
      for (let s = 0; s < S; s++) {
        if (bridgedStrip[s]) continue;
        // a strip that supports a bridged strip must stay solid
        if (bridgedStrip[s - 1] || bridgedStrip[s + 1]) continue;
        for (let p = 1; p < K - 1; p++) {
          if ((p - pattern.inOffset) % 2 === 0) isBridge[s][p] = true;
        }
      }
    }

    // ---- validate every bridge has support on both sides ----
    const supportedBy: ("cross" | "in")[][] = strips.map(() => new Array(K).fill("cross"));
    for (let s = 0; s < S; s++) {
      for (let p = 0; p < K; p++) {
        if (!isBridge[s][p]) continue;
        const cross =
          s > 0 && s < S - 1 && !isBridge[s - 1][p] && !isBridge[s + 1][p];
        const inline =
          p > 0 && p < K - 1 && !isBridge[s][p - 1] && !isBridge[s][p + 1];
        if (cross) supportedBy[s][p] = "cross";
        else if (inline) supportedBy[s][p] = "in";
        else return null; // unsupported bridge \u2014 pattern invalid
      }
    }

    // ---- lay holders over the remaining runs ----
    const avail = {
      one: stock.one,
      two: stock.two,
      three: stock.three,
    };
    type PH = { decks: Deck[]; axis: "x" | "y"; label: string };
    const cellHolder = new Map<string, PH>();
    const phs: PH[] = [];
    let holderError: string | undefined;
    let singles = 0;

    for (let s = 0; s < S; s++) {
      let p = 0;
      while (p < K) {
        if (isBridge[s][p]) { p++; continue; }
        let end = p;
        while (end < K && !isBridge[s][end]) end++;
        const run = strips[s].decks.slice(p, end);
        const chosen = runOptions(run.length).find(
          (o) => o.three <= avail.three && o.two <= avail.two && o.one <= avail.one,
        );
        if (!chosen) {
          holderError = `Not enough holders left for a run of ${run.length} decks.`;
          p = end;
          continue;
        }
        avail.three -= chosen.three;
        avail.two -= chosen.two;
        avail.one -= chosen.one;
        singles += chosen.one;
        const sizes: (1 | 2 | 3)[] = [];
        for (let i = 0; i < chosen.three; i++) sizes.push(3);
        for (let i = 0; i < chosen.two; i++) sizes.push(2);
        for (let i = 0; i < chosen.one; i++) sizes.push(1);
        let c = 0;
        for (const size of sizes) {
          const group = run.slice(c, c + size);
          const ph: PH = { decks: group, axis: strips[s].axis, label: "" };
          phs.push(ph);
          for (const d of group) cellHolder.set(`${d.x},${d.y}`, ph);
          c += size;
        }
        p = end;
      }
    }

    // ---- materialise holders (labelled top-left first) ----
    const holders: Holder[] = [];
    const phOut = new Map<PH, Holder>();
    const ordered = [...phs].sort((p, q) => {
      const py = Math.min(...p.decks.map((d) => d.y));
      const qy = Math.min(...q.decks.map((d) => d.y));
      const px = Math.min(...p.decks.map((d) => d.x));
      const qx = Math.min(...q.decks.map((d) => d.x));
      return (py - qy) || (px - qx);
    });
    let label = 1;
    for (const ph of ordered) {
      const size = ph.decks.length as 1 | 2 | 3;
      const h: Holder = {
        x: Math.min(...ph.decks.map((d) => d.x)),
        y: Math.min(...ph.decks.map((d) => d.y)),
        w: ph.axis === "x" ? size * 4 : 8,
        h: ph.axis === "y" ? size * 4 : 8,
        capacity: size,
        label: `H${label++}`,
      };
      phOut.set(ph, h);
      holders.push(h);
    }

    // ---- materialise bridges ----
    const bridges: Bridge[] = [];
    for (let s = 0; s < S; s++) {
      for (let p = 0; p < K; p++) {
        if (!isBridge[s][p]) continue;
        const deck = strips[s].decks[p];
        deck.isBridge = true;
        const nbrs =
          supportedBy[s][p] === "cross"
            ? [strips[s - 1].decks[p], strips[s + 1].decks[p]]
            : [strips[s].decks[p - 1], strips[s].decks[p + 1]];
        const l = nbrs[0] && cellHolder.get(`${nbrs[0].x},${nbrs[0].y}`);
        const r = nbrs[1] && cellHolder.get(`${nbrs[1].x},${nbrs[1].y}`);
        const lo = l ? phOut.get(l) : undefined;
        const ro = r ? phOut.get(r) : undefined;
        if (!lo || !ro) return null;
        bridges.push({
          x: deck.x,
          y: deck.y,
          w: deck.w,
          h: deck.h,
          label: "",
          between: [lo.label, ro.label],
        });
      }
    }
    bridges.sort((p, q) => (p.y - q.y) || (p.x - q.x));
    bridges.forEach((br, i) => {
      br.label = `B${i + 1}`;
    });

    return {
      decks,
      holders,
      bridges,
      holderError,
      totalHolders: holders.length,
      totalBridges: bridges.length,
      singles,
    };
  }

  const patterns: Pattern[] = [];
  for (const crossOffset of [1, 2, null]) {
    for (const inOffset of [1, 2, null]) {
      patterns.push({ crossOffset, inOffset });
    }
  }

  const attempts: Attempt[] = [];
  for (const o of ["horizontal", "vertical"] as const) {
    for (const pattern of patterns) {
      const r = buildOrientation(o, pattern);
      if (r) attempts.push(r);
    }
  }

  if (attempts.length === 0) {
    return { ok: false, reason: "Could not build this stage with available holders." };
  }
  // Prefer: no holder error, then MOST bridges, then fewest single-deck holders,
  // then fewest holders overall.
  attempts.sort((p, q) => {
    const pe = p.holderError ? 1 : 0;
    const qe = q.holderError ? 1 : 0;
    if (pe !== qe) return pe - qe;
    if (p.totalBridges !== q.totalBridges) return q.totalBridges - p.totalBridges;
    if (p.singles !== q.singles) return p.singles - q.singles;
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


function StagePanel({
  title,
  defaultWidth,
  defaultLength,
  stock = FULL_STOCK,
  onUsage,
}: {
  title: string;
  defaultWidth: number;
  defaultLength: number;
  labelPrefix?: string;
  stock?: Stock;
  onUsage?: (u: Stock) => void;
}) {
  const [width, setWidth] = useState(defaultWidth);
  const [length, setLength] = useState(defaultLength);
  const [heightIn, setHeightIn] = useState(MIN_HEIGHT_IN);
  const [heightText, setHeightText] = useState(String(MIN_HEIGHT_IN));



  const [view, setView] = useState<"top" | "side" | "both">("both");


  const result = useMemo(() => planStage(width, length, stock), [width, length, stock]);
  const totalArea = width * length;

  const usage = useMemo<Stock>(() => {
    if (!result.ok) return { decks: 0, one: 0, two: 0, three: 0 };
    const u = { decks: result.decks.length, one: 0, two: 0, three: 0 };
    for (const h of result.holders) {
      if (h.capacity === 1) u.one++;
      if (h.capacity === 2) u.two++;
      if (h.capacity === 3) u.three++;
    }
    return u;
  }, [result]);

  useEffect(() => {
    onUsage?.(usage);
  }, [usage, onUsage]);

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
  // The stage height entered IS the finished walking-surface height.
  const surfaceTotalIn = heightIn;
  const legHeightIn = Math.max(heightIn - DECK_THICKNESS_IN, 0);

  // Vertical scale for the elevation: inches → px (kept readable for short heights).
  const vScale = Math.min(Math.max(220 / Math.max(surfaceTotalIn, 1), 2), 8);
  const deckPx = Math.max(DECK_THICKNESS_IN * vScale, 6);
  const legPx = Math.max(legHeightIn * vScale, 0);
  const sideH = deckPx + legPx;
  const showTop = view === "top" || view === "both";
  const showSide = view === "side" || view === "both";


  return (
      <div className="mb-10">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">{title}</h2>

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
                      onClick={() => {
                        setHeightIn(h);
                        setHeightText(String(h));
                      }}

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
                  <span className="text-muted-foreground">Leg height</span>
                  <span className="font-medium">{legHeightIn}&quot; (+ {DECK_THICKNESS_IN}&quot; deck)</span>
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
                    const overDecks = count > stock.decks;
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
                            {count} / {stock.decks}
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
                            Exceeds the {stock.decks} decks available to this stage by {count - stock.decks}.
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
                  Looking at the front edge ({width} ft across). The walking surface sits{" "}
                  {heightIn}&quot; off the floor: {DECK_THICKNESS_IN}&quot; deck slab on{" "}
                  {legHeightIn}&quot; legs. Yellow sections are bridges — no leg beneath them.
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
                        {legHeightIn}&quot; legs
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
  );
}

function Index() {
  const [showSecond, setShowSecond] = useState(false);
  const [used1, setUsed1] = useState<Stock>({ decks: 0, one: 0, two: 0, three: 0 });

  const remaining = useMemo<Stock>(
    () => ({
      decks: Math.max(0, FULL_STOCK.decks - used1.decks),
      one: Math.max(0, FULL_STOCK.one - used1.one),
      two: Math.max(0, FULL_STOCK.two - used1.two),
      three: Math.max(0, FULL_STOCK.three - used1.three),
    }),
    [used1],
  );


  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Stage Deck Planner</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lay out a stage using the fewest 4&#39;×8&#39; decks possible. Inventory: 72 decks, 4×1-deck (4&#39;×8&#39;) + 8×2-deck (8&#39;×8&#39;) + 8×3-deck (12&#39;×8&#39;) holders.
            A <span className="font-medium" style={{ color: BRIDGE_COLOR }}>bridge</span> is a single deck spanning between two holders — adds coverage without using another holder.
          </p>
        </header>

        <label className="mb-6 flex w-fit cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm">
          <input
            type="checkbox"
            checked={showSecond}
            onChange={(e) => setShowSecond(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span className="font-medium">Add a second stage</span>
          <span className="text-xs text-muted-foreground">(its own width, length &amp; height)</span>
        </label>

        <button
          type="button"
          onClick={() => window.print()}
          className="no-print mb-6 ml-3 rounded-md border border-border bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
        >
          Print stages side by side
        </button>

        <div className="print-grid">
        <StagePanel
          title={showSecond ? "Stage 1" : "Stage"}
          defaultWidth={24}
          defaultLength={16}
          onUsage={setUsed1}
        />
        {showSecond && (
          <>
            <div className="mb-4 rounded-md border border-border bg-muted p-3 text-sm">
              <div className="font-semibold">Left for Stage 2 after Stage 1</div>
              <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-4">
                <div>{remaining.decks} decks</div>
                <div>{remaining.three}× 3-deck holder</div>
                <div>{remaining.two}× 2-deck holder</div>
                <div>{remaining.one}× 1-deck holder</div>
              </div>
            </div>
            <StagePanel
              title="Stage 2"
              defaultWidth={16}
              defaultLength={8}
              labelPrefix="S2-"
              stock={remaining}
            />
          </>
        )}
        </div>
      </div>
    </div>
  );
}