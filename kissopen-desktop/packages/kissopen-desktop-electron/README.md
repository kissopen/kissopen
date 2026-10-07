# Kissopen Desktop shell

This package is the macOS Electron shell for Kissopen Desktop. It starts or
connects to the user's normal local Kissopen Agent daemon, projects the daemon through a
loopback boundary, and hosts the shared local application renderer. The shell
opens one Kissopen Agent connection — its host — and that Kissopen Agent owns whatever peering it
does with other machines.

It contains no Kissopen server, account authentication, hosted workspace topology,
or plugin runtime. Product state lives in `kissopen-desktop-state`, reusable
visuals in `kissopen-desktop-ui`, and application composition in
`kissopen-desktop-app`.

Start the complete Electron development environment:

```sh
pnpm dev
```

The default is Portless loopback mode (`https://…localhost`); it does not
require Wi-Fi. Use `pnpm dev --lan` only for deliberate device testing.

Use `pnpm dev --debug` to start the development-only main-process, renderer, and
Kissopen Agent inspectors. Electron prints each loopback URL; set
`KISSOPEN_DEBUG_RENDERER_PORT` to choose the renderer CDP port explicitly.

Use the profile development flavor from the workspace root:

```sh
pnpm --dir ../.. dev --profile
```

It preloads the dormant collector and labels captures
`development/non-representative`. For optimized profile captures, build once
and launch the production-shaped profile renderer. The optimized flavor remains
minified but requests component-name retention. Every artifact records that
launch request separately from `profileBuildVerified`, which is set only after
the pre-React bootstrap completes an actual React DevTools v5 profiling
lifecycle (the attached renderer version is also checked when it is reported):

```sh
pnpm run build:profile:optimized
pnpm run start:profile:optimized
```

Start and stop a capture in Settings → Dev Tools. Kissopen writes the raw
Chromium trace, process/heap metrics, and normalized React DevTools 6.1.5
backend profiling payload beside a smaller ranked report and manifest under
its desktop profiler data directory. The backend payload is raw evidence for
Kissopen's analyzer; it is not the frontend Store export accepted by React
DevTools' profile importer. The existing renderer debugger can stay attached
during capture; competing tracing commands and access to the profiler's trace
stream are rejected.

Use the browser-only environment when needed:

```sh
pnpm dev:web
```
