# Multiple Kissopen Agents

## Where we are going

Kissopen is a multi-Kissopen Agent app. Its local host Kissopen Agent and every remote Kissopen Agent the host has
published remain represented and mounted whether their current route is healthy
or not. Connectivity is a changing property of a Kissopen Agent, never the lifetime of the
Kissopen Agent's UI or of the application.

Arbitrary network failure must leave the mounted app usable. A full-app loader
is allowed only during initial startup, before Kissopen has first connected to its
local host. After the app has mounted, losing or reconnecting the local host or
any remote Kissopen Agent must never unload, reset, or replace the app with a loader.
Failure of one Kissopen Agent must not interrupt work on another.

An unavailable Kissopen Agent stays where the user left it. Its affected surfaces explain
their state in context: a terminal, for example, becomes visibly muted and
read-only. Actions that require that Kissopen Agent to be online are disabled, while
navigation, reading already available state, editing drafts, and every other
offline-capable action continue to work. Errors and reconnecting status belong
beside the affected Kissopen Agent or surface, not in a global blocking state.

When connectivity returns, Kissopen reconciles the Kissopen Agent in place and resumes live
work. Navigation, focus, selection, scroll position, open panels, drafts, and
other UI identity survive the outage and reconnect.

That stability is a general UI invariant, not only a reconnect guarantee.
Streaming updates, composer growth, and resizing surrounding chrome reconcile
without a delayed visual correction: a chat following its newest content stays
pinned there, while a reader parked in history keeps the same visual anchor.

## How we get there

First, make every known Kissopen Agent a stable app lifetime independent of its connection
state. The direct host and the per-node routes, namespaces, and ordinary Kissopen Agent
connections from the Remote Kissopen Agent plan remain the transport model; an unavailable
route changes status, not membership or UI ownership.

Then make availability visible and local to each Kissopen Agent. Every surface and action
must distinguish what requires a live Kissopen Agent from what can continue offline, and
degrade only the unavailable part.

Finally, remove connection-driven app loaders, remounts, and resets. Reconnect
each Kissopen Agent in place, reconcile its current durable state, and restore live
behavior without rebuilding the surrounding app.

## How we know it is done

- The only connection-related full-app loader is the initial local-host
  bootstrap; after the first mount, no disconnect or reconnect can replace the
  app with a loader.
- The local host and every known remote Kissopen Agent remain mounted and visible through
  offline, reconnecting, and error states, with failures isolated per Kissopen Agent.
- An open surface keeps its identity and clearly shows degraded availability;
  terminals are visibly muted and read-only while unavailable.
- Online-only actions are disabled with their reason shown in context, while
  all offline-capable navigation, reading, and editing remain usable.
- Reconnecting reconciles fresh Kissopen Agent state in place without losing navigation,
  focus, selection, scroll position, open panels, or drafts.
- Streaming, composer editing, and surrounding-panel resize preserve the
  transcript's active scroll anchor without a visible correction frame.
- Remote work still uses the host-published routes, ordinary Kissopen Agent connections,
  and stable per-Kissopen Agent namespaces defined by the Remote Kissopen Agent plan; no second
  remote-sync model is introduced.
