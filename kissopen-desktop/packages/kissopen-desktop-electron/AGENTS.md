# Agent Instructions — kissopen-desktop-electron

`kissopen-desktop-electron` is the Electron shell. It is macOS-only and deliberately thin:
it loads the shared UI (`kissopen-desktop-app` / `kissopen-desktop-ui`) and binds it to a desktop
environment. It is not where product features are built.

Read the repository root `AGENTS.md` first; everything there still applies. This
file adds the rules specific to this package.

## Keep this package small

The desktop package owns only what genuinely requires Electron or the local
machine:

- window, menu, and update lifecycle;
- child-process supervision for Kissopen Agent and PTY lifecycles;
- the local Kissopen Agent daemon connection and its projection into `kissopen-desktop-state` shapes;
- durable desktop settings;
- the narrow preload IPC bridge.

Everything else belongs elsewhere. Product state goes to `kissopen-desktop-state`, reusable
visual components go to `kissopen-desktop-ui`, and application composition goes to
`kissopen-desktop-app`. If a change here starts to look like a feature, it is in the wrong
package. Prefer deleting code in this package over adding to it, and never
duplicate a component or store that another package already owns.

Growth in `sources/main` is acceptable only when the capability cannot exist
outside the main process. Growth in `sources/renderer` almost always means work
that should have gone to `kissopen-desktop-app`.

## Layout

Sources live in `sources/`, never `src/`, matching the rest of the repository.
The top level splits strictly by Electron process, so a file's directory tells
you which runtime it executes in and what it may import:

```
sources/
  main/       Electron main process (Node): main.ts entry + main-only modules
  renderer/   Browser process: renderer.tsx entry + renderer-only stores
  preload/    Context-isolated bridge: preload.ts only
  shared/     Types and IPC channel names used across processes
```

Rules for the boundary:

- `main/` may use Node and Electron main APIs. It must not import from
  `renderer/` or `preload/`.
- `renderer/` runs in the browser. It must not import Node built-ins, `electron`,
  or anything from `main/`. It reaches the main process only through the bridge
  contract in `shared/`.
- `preload/` contains the bridge and nothing else. Keep it minimal and explicit;
  it is a security boundary, so never expose a general-purpose channel, raw
  `ipcRenderer`, or a capability the renderer can replace.
- `shared/` holds only process-independent types, contracts, and channel names.
  It must contain no runtime behavior that belongs to one process.

Each entry file is named after its process (`main/main.ts`,
`renderer/renderer.tsx`, `preload/preload.ts`) and is referenced by
`vite.main.config.ts`, `index.html`, and `vite.preload.config.ts` respectively.
Update those configs when an entry moves.

Tests live beside their subject inside the same process directory and run with
`pnpm --dir packages/kissopen-desktop-electron test`.

## React hooks

This package uses none of `useState`, `useEffect`, `useReducer`, or
`useLayoutEffect`. The renderer reads external stores through
`useSyncExternalStore` and nothing else. `node scripts/check-react-boundaries.mjs`
enforces this over `sources/`; run it for any renderer change.

Desktop stores in `sources/renderer` are thin adapters over the bridge and
`kissopen-desktop-state`. They must not become a second product-state system.

## Development defaults to Electron

`pnpm dev` is the default development loop. Portless assigns a worktree-scoped
renderer route and ephemeral port, then starts the main, preload, renderer, and
Electron processes together. The existing build identity gives concurrent
worktrees distinct application names and user-data directories.

`pnpm dev:web` is the browser-only development loop. It automatically connects
to the user's normal local Kissopen Agent daemon, starting it when necessary. No topology
chooser, account, or cloud origin is involved.

How browser development works, and what to preserve when changing it:

- The shared Vite configuration installs `browserLocalKissopenAgentPlugin()`.
- `browserLocalKissopenAgentPlugin()` (`sources/main/browserDevServer.ts`) injects a
  `kissopen-browser-local` meta tag. A meta tag, not an inline script, because the
  page CSP forbids inline scripts and would silently drop the signal.
- The renderer entry picks the browser dev bridge when that tag is present and
  `window.kissopenDesktop` is absent.
- The dev server mounts the same `kissopenAgentProxyHandle` used by the packaged app, so
  the renderer talks to an identical projected Kissopen Agent surface in both modes.

Keep the development and packaged paths behaviorally identical at that proxy
boundary. A feature that works only in one of them is a bug. Native-only
capabilities such as directory picking are absent in browser-local mode by
design; degrade gracefully rather than branching product behavior on the
environment.

`pnpm dev:desktop` and `pnpm dev:desktop:electron` remain aliases of the default
Electron loop.

## Kissopen Agent boundary

No `@slopus` wire type may cross into the renderer. `sources/main/kissopenAgentProjection.ts`
projects daemon responses and events into `kissopen-desktop-state` shapes, and
`sources/main/kissopenAgentProxyHandle.ts` is the single request handler shared by the
packaged `node:http` proxy and the Vite dev middleware. Add new Kissopen Agent capability by
extending that projection and handler, and cover it with tests next to them —
never by leaking a protocol type or a raw daemon URL to `renderer/`.

Server paths in the proxy use three segments (`/sessions/:id/:action`); name new
actions to fit that shape.

## Checks

For any change in this package run:

```sh
pnpm --dir packages/kissopen-desktop-electron exec tsc -p tsconfig.json --noEmit
node packages/kissopen-desktop-electron/node_modules/vitest/vitest.mjs run --dir packages/kissopen-desktop-electron
node scripts/check-react-boundaries.mjs
```

Run `pnpm --dir packages/kissopen-desktop-electron build` when touching an entry point or a
Vite config, since those failures do not surface in typecheck or tests.
