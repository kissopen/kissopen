# Agent Instructions — kissopen-desktop-app

`kissopen-desktop-app` is the local desktop application layer. It composes product
state, navigation, and visual components into the screens driven by connected
Kissopen Agent daemons.

Read the repository root `AGENTS.md` and `DESIGN.md` first; everything there
still applies. This file adds the rules specific to this package.

## This package is glue

`kissopen-desktop-app` loads data, selects the current route, projects product state into
props, and handles callbacks. It owns no visual design.

- Reusable visual components belong in `kissopen-desktop-ui`. If a screen needs a new
  visual element, build and prove it in `kissopen-desktop-ui`, add it to the blueprint,
  then import it here.
- Product state belongs in `kissopen-desktop-state`. This package materializes surface
  stores and reads their immutable snapshots; it does not hold product state.
- Anything requiring Electron, Node, or the local machine belongs in
  `kissopen-desktop-electron`.

A file here that defines colors, spacing scales, icons, or a component-local
styling system is a defect. `sources/styles.css` exists only to pull in the
design system, not to add styling of its own.

## Layout

Sources live in `sources/`, never `src/`. Tests live in a separate top-level
`tests/` tree that mirrors `sources/`, so `sources/` contains only shipped
product code:

```
sources/
  components/   Composed app-level boundaries and surfaces
  navigation/   Routing: the route tree, its contracts, and navigation
  views/        One screen or panel per file
  index.ts      The package's only public entry
tests/
  behavior/     Whole-surface tests named after the workflow they prove
  ...           Otherwise mirrors sources/ path for path
```

`tests/setup.ts` configures the suite and is referenced by `vite.config.ts`.

Name a test file after the file it covers when it is a focused unit test. A test
that drives a whole surface goes in `tests/behavior/` and is named after the
observable workflow it proves, so the directory reads like an index of supported
behavior. Do not use generic names such as `app.test.tsx` or `integration.test.tsx`.

## React hooks

This package may not use `useState`, `useEffect`, `useReducer`, or
`useLayoutEffect`; ESLint enforces this. Read external state through
`useSyncExternalStore` or a `kissopen-desktop-state` adapter, derive everything else at
render time, and put the rest in event handlers or ref callbacks.

Every surface must stay current on its own. There are no manual refresh
controls; see the root `AGENTS.md` sections on reactivity and on React identity,
both of which this package is the primary subject of.

## Navigation

Routing is TanStack Router. The local Kissopen Agent route tree in
`sources/navigation/kissopenAgentRouter.tsx` owns the mapping between a URL and the active
screen for both the Electron renderer and browser-local development.

Only durable, shareable destinations are routed: which screen is open and which
entity it addresses. Two rules follow.

- Transient view state is not in the URL. A layer a user would not expect to
  survive a reload, or to travel in a link, does not belong in the address.
- Values a route needs that the URL does not carry arrive through
  `KissopenAgentRouterContext`; do not rebuild another navigation facade around it.
