// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// GitHub Pages (or any static host) build:
//   GHPAGES_BASE=/repo-name/ bun run build
// Prerendering renders "/" to a static index.html so no server is needed.
// Set GHPAGES_BASE to "/<repo-name>/" for project pages
// (<user>.github.io/<repo-name>); leave unset for a user/organization site
// or a custom domain at the root.
const ghPagesBase = process.env.GHPAGES_BASE;

export default defineConfig({
  vite: ghPagesBase ? { base: ghPagesBase } : undefined,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Only used with GHPAGES_BASE (static build): render "/" to index.html
    ...(ghPagesBase
      ? { pages: [{ path: "/" }], prerender: { enabled: true } }
      : {}),
  },
});
