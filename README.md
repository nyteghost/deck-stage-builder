# Stage Deck Planner

Plan a stage built from standard 4' × 8' decks. Enter a width, length and stage
height and the app works out the minimum number of decks, groups them into your
1-, 2- and 3-deck holders, uses bridge decks wherever possible, and draws both a
**top view (plan)** and a **side view (elevation)** with placement tables.

## Requirements

- Node.js 20+ (or [Bun](https://bun.sh))
- npm (ships with Node) or bun

No backend, database, API keys or environment variables are needed — it runs
fully offline on your machine.

## Getting the code

Either:

- Clone the connected GitHub repository, or
- Download the project as a zip from Lovable (GitHub / Dev Mode menu, top right) and unzip it.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:8080

With Bun: `bun install && bun run dev`.

## Production build

```bash
npm run build
npm run preview
```

`build` outputs the production bundle; `preview` serves it locally so you can
check it before hosting.

## Run with Docker (no Node needed)

Requires only Docker Desktop / Docker Engine with Compose.

```bash
docker compose up            # dev server with hot reload -> http://localhost:8080
docker compose up --build prod   # production build -> http://localhost:8080
docker compose down          # stop
```

The dev service mounts the project directory, so edits on your machine reload in
the browser. `node_modules` stays inside the container, so it never clashes with
a local install. The `prod` service builds the site and serves the compiled
bundle.


## Other scripts

| Script              | What it does                        |
| ------------------- | ----------------------------------- |
| `npm run build:dev` | Build with development mode settings |
| `npm run lint`      | Run ESLint                          |
| `npm run format`    | Format the project with Prettier    |

## Where things live

- `src/routes/index.tsx` — the entire planner: layout algorithm, top view, side view and tables
- `src/routes/__root.tsx` — root layout and document head
- `src/routes/` — file-based routes (TanStack Start / TanStack Router)
- `src/styles.css` — Tailwind v4 theme tokens and global styles

## How the planner works

- **Buildable sizes:** both width and length must be multiples of 4 ft, and at
  least one of them must be a multiple of 8 ft — otherwise whole 4×8 decks
  cannot tile the area and the app says so.
- **Deck count:** a buildable stage always uses the mathematical minimum,
  area ÷ 32 sq ft.
- **Inventory:** 72 decks, 4 × 1-deck holders (4' × 8'), 8 × 2-deck holders
  (8' × 8'), 8 × 3-deck holders (12' × 8'). The app flags anything that exceeds
  what you own.
- **Bridges:** a bridge is a single deck spanning between two adjacent holders
  with no holder of its own. The planner maximises bridges (it also compares
  both deck orientations and keeps the better one) and avoids 1-deck holders
  unless nothing else covers a run.
- **Height:** 32"–44", typable or chosen from the 32/36/40/44 presets. The side
  view draws the 4" deck slab, the legs, the floor line and the unsupported
  bridge spans, with labels matching the top view.
