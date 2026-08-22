# Add a README with local setup instructions

Add a `README.md` at the project root so the setup steps travel with the code when you download or clone it.

## Contents

1. **What the app is** — Stage Deck Planner: enter width, length and stage height; get a minimal 4x8 deck layout with holder/bridge placement, plus top and side views.
2. **Requirements** — Node 20+ (or Bun), npm/bun. No backend, database, API keys or env vars needed; it runs fully offline.
3. **Getting the code** — clone the connected GitHub repo, or download the project zip from Lovable and unzip it.
4. **Run locally**
   ```text
   npm install
   npm run dev      # http://localhost:8080
   ```
5. **Production build**
   ```text
   npm run build
   npm run preview
   ```
6. **Other scripts** — `lint`, `format`, `build:dev`.
7. **Where things live** — the whole planner UI and layout algorithm is in `src/routes/index.tsx`; routes in `src/routes/`, styles/tokens in `src/styles.css`.
8. **How the planner works (short)** — buildability rule (both sides multiples of 4 ft, at least one a multiple of 8 ft), inventory (72 decks; 4x1-deck, 8x2-deck, 8x3-deck holders), bridge decks preferred, single-deck holders avoided, height range 32-44 in.

## Technical notes

- Single new file: `README.md`. No source or config changes.
