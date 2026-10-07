# Multiple Kissopen Agents: Network-Resilient Local and Remote Kissopen Agents

## End result

Kissopen remains one stable desktop application through arbitrary local-daemon,
peer-route, and network failures.

- The local host Kissopen Agent and every remote Kissopen Agent published by that host remain present
  as stable directory entries. Reachability changes their availability; it does
  not define their lifetime.
- A full-window connection loader appears only before the first successful
  local-host bootstrap. Once the workspace has mounted, local and remote
  disconnects never replace or remount the router, shell, sidebar, workspace,
  transcript, file views, panels, dialogs, previews, or terminals.
- Each affected Kissopen Agent reports `connecting`, `online`, `reconnecting`, `offline`,
  `error`, or `restricted` in context. A failure on one Kissopen Agent does not block
  another Kissopen Agent or local window-owned surfaces such as Notes and Blueprint.
- Last confirmed projects, chats, messages, files, tabs, panels, terminals,
  slots, node status, and settings remain readable during an outage.
- Local-only state remains editable: navigation, selections, sidebar order,
  appearance, panel/tab arrangement, message drafts, attachment choices,
  unsaved file drafts, and Notes continue to work.
- Operations requiring an answer from the unavailable Kissopen Agent are disabled with an
  explicit reason. They are also refused at the state/action boundary so stale
  handlers cannot issue them.
- Terminals keep their last grid, selection, scroll, and process identity, become
  visibly muted and read-only while unavailable, and resume their existing
  protocol reconnect when the route returns.
- Recovery reconciles durable state over the existing Kissopen Agent difference/read APIs.
  It does not invent a second remote cache or synchronization system and does
  not rebuild the owning stores.

## Product constraints

The controlling product direction is
[`master-plans/05-multiple-kissopen-agents.md`](../../master-plans/05-multiple-kissopen-agents.md), layered on
the transport and namespace model in
[`master-plans/01-remote-kissopen-agent.md`](../../master-plans/01-remote-kissopen-agent.md).

- Kissopen connects directly only to its local host. Remote Kissopen Agent traffic continues
  through the host-published peer route.
- A remote Kissopen Agent remains an ordinary Kissopen Agent connection with ordinary stores and
  screens.
- Realtime events remain delivery hints. Recovery re-reads durable state.
- UI identity is a contract. Same-Kissopen Agent notifications and connection transitions
  must not change React keys or swap store instances.
- No manual Refresh control is introduced. Retry controls may accelerate an
  automatic reconnect but are never required for freshness.
- No compatibility layer, aggregate root store, or parallel offline product-state
  system is introduced.
- `kissopen-desktop-app` stays glue, reusable visual states stay in
  `kissopen-desktop-ui`, and product availability/action rules stay in
  `kissopen-desktop-state`.
- Tests run only when explicitly requested. The later validation request
  authorized the repository unit, gym, and existing browser suites; their
  results are recorded below. Manual runtime scenarios remain listed for a
  later hands-on pass.

## Current architecture worth preserving

- `DesktopRuntime` owns the one authenticated local daemon connection.
- `kissopenAgentHttpProxy` exposes one capability-scoped loopback surface to the renderer
  and already routes `/nodes/:peerId` through the host.
- `KissopenAgentDirectoryStore` owns one `KissopenAgentConnectionHandle` and one ordinary
  `KissopenAgentSession` per Kissopen Agent namespace.
- `kissopenAgentConnectionLoaderCreate` already probes health, heartbeats every two
  seconds, and retries with capped exponential backoff.
- `kissopen-agent-connect` already reconnects and reconciles core catalog/chat data.
- `KissopenAgentWorkspaceStore` already retains drafts, open tabs, files, panel placement,
  and materialized chat stores.
- The terminal driver already records protocol resume offsets/input leases and
  automatically reconnects.
- Kissopen Agent node, slot, inbox, usage, friends, share, instruction, and security stores
  already keep their last immutable snapshots when a read fails.

## Current failure modes

### Local runtime lifetime

`DesktopRuntime.reconnectLocal()` currently calls the same path as a cold start.
That path closes the proxy and daemon client, publishes `phase: "starting"`, and
later creates a new random loopback port and capability. The renderer replaces
the mounted workspace with `DesktopStartupScreen`; all transports rooted at the
old URL become obsolete.

### Kissopen Agent directory lifetime

The directory currently treats only a `connected` peer as a Kissopen Agent target. When
peer status becomes `connecting` or `unreachable`, it closes and deletes that
Kissopen Agent. A local runtime transition closes the local Kissopen Agent and deletes all remotes.
Both paths clear projects and dispose workspace/terminal stores.

### Workspace lifetime

`KissopenAgentWorkspaceSurface` currently returns `KissopenAgentConnectionStatus` whenever health is
not ready. This preserves the outer router but unmounts the active workspace
subtree and loses its DOM identity.

### Availability projection

The directory is not subscribed to each materialized session's health store, so
its sidebar marker may remain connected while the active workspace reports a
disconnect.

### Surface capabilities

Workspace access currently models checkout lifecycle refusals, not transport
availability. Most buttons discover an outage only after issuing a request.
Composer `disabled` also disables draft editing, which is too broad for offline
mode.

### Realtime recovery

Several sources retain their last reading but stop after the first stream
failure. P2P node status is the most important: if its stream dies, the known
node set can stay stale for the rest of the connection lifetime.

## Target state model

One Kissopen Agent has two independent lifetimes:

1. **Membership** — the local host exists for the desktop lifetime after initial
   bootstrap; a remote Kissopen Agent exists while it remains in the host's authoritative
   published peer set.
2. **Availability** — the current ability to reach and use that Kissopen Agent.

The closed availability vocabulary is:

- `connecting`: the Kissopen Agent has never completed initial hydration in this app
  lifetime.
- `online`: transport is reachable and daemon health is ready.
- `reconnecting`: the Kissopen Agent was online before and automatic recovery is in
  progress.
- `offline`: transport is currently unreachable; last confirmed state is
  retained.
- `error`: the route answers but the daemon/protocol cannot currently be used.
- `restricted`: a remote machine is reachable but deliberately does not expose
  its Kissopen Agent API. This remains separate from network failure.

The snapshot also carries the last displayable message, daemon version, attempt
count, and whether confirmed data has ever been materialized. `session` presence
does not stand in for availability.

## Capability matrix

| Surface or action | Offline behavior |
| --- | --- |
| Switch Kissopen Agent, route, project, chat, file tab, panel tab | Enabled |
| Read retained sidebar rows, transcript, files, diffs, terminal grid | Enabled, marked as last confirmed where needed |
| Notes, appearance, sidebar order, local window layout | Fully enabled |
| Message draft text and attachment removal/reordering | Enabled locally |
| Message send/steer, slash command, request answer, abort | Disabled with Kissopen Agent availability reason |
| Model, effort, permission, service tier changes | Remote-backed changes disabled; configuration of an unsent local group draft remains editable |
| Project/worktree create, rename, reorder, archive, compute | Disabled |
| Register local project directory | Disabled while local Kissopen Agent is unavailable |
| File draft editing | Enabled for already loaded editable text |
| File load/retry, save, revert, Git refresh | Disabled |
| Open retained image/media bytes already held | Enabled |
| Resolve a new preview URL or load a new remote file | Disabled |
| Open existing terminal tab and copy/select/scroll | Enabled |
| Terminal input, paste, resize writes, new terminal | Disabled |
| Terminal reconnect | Automatic; optional retry only accelerates |
| Slot text | Visible |
| Slot button with a Kissopen Agent action | Disabled with reason |
| Browser/webapp already mounted | Retained; Kissopen Agent-bound navigation/reload disabled |
| Inbox/usage/friends/shared-session retained readings | Visible |
| Answer/share/pairing/settings mutations | Disabled |

## Implementation phases

### Phase 1 — Stable local host bridge

- [x] Keep the loopback HTTP proxy, random capability, preview registration, and
  renderer base URL stable after the first successful bootstrap.
- [x] Give the proxy a replaceable current daemon client and peer-client factory.
- [x] Resolve every normal HTTP request, WebSocket terminal attach, peer route,
  and preview file read through that replaceable client.
- [x] Reconnect `DesktopRuntime` into the existing proxy instead of calling the
  cold-start disposal path.
- [x] Keep the runtime snapshot in its mounted/ready lifetime during reconnect;
  renderer health communicates the temporary outage.
- [x] Replace the daemon client atomically on success and leave retry driven by
  subsequent health traffic on failure.
- [x] Reserve startup/error full-window screens for the first bootstrap or an
  explicit topology/reset operation before the app has materialized.

### Phase 2 — Stable multi-Kissopen Agent directory

- [x] Materialize every published node that has a stable `peerId`, regardless of
  whether its current link is connected, connecting, or unreachable.
- [x] Keep each `LiveKissopenAgent`, `KissopenAgentConnectionHandle`, `KissopenAgentSession`, workspace
  subscription, projects, and project-add state through transient link changes.
- [x] Remove a node only when a successful authoritative P2P reading no longer
  contains it, not when its route becomes unreachable or the status feed fails.
- [x] Keep the local entry and last node set through a host outage.
- [x] Subscribe the directory to each Kissopen Agent's health store and project availability
  into its sidebar entry without replacing the session.
- [x] Preserve `activeKissopenAgentId`, order, URL namespace, and router resolution through
  all availability transitions.
- [x] Continue disposing everything only when the directory itself loses its last
  subscriber/window lifetime.

### Phase 3 — In-place workspace degradation

- [x] Remove the health-driven early return from `KissopenAgentWorkspaceSurface`.
- [x] Use the reusable compact `Banner` availability treatment across
  `kissopen-desktop-ui` and Blueprint, using existing theme roles and no raw colors.
- [x] Render the notice inside the stable shell/header for the affected Kissopen Agent.
- [x] Keep `key={active.id}` unchanged and never key by connection attempt,
  daemon version, or proxy generation.
- [x] Retain sidebar sections and project rows while offline.
- [x] Keep Notes, Blueprint, Friends, Shared, and settings shells mounted when
  the local host is unavailable.
- [x] Keep Inbox and Usage navigation rows present after first materialization;
  their pages show retained data plus availability.

### Phase 4 — Closed availability and action refusals

- [x] Add explicit `KissopenAgentAvailabilitySnapshot` and availability store/reader types
  in `kissopen-desktop-state`.
- [x] Derive display status, `online`, and the standard refusal reason once per
  Kissopen Agent rather than reinterpreting health in every component.
- [x] Feed availability into workspace/chat/panel action owners.
- [x] Refuse network actions synchronously at their action boundary while
  unavailable.
- [x] Keep local-only state actions synchronous and enabled.
- [x] Re-read availability in event handlers so retained handlers cannot act on
  stale render state.
- [x] Keep authoritative server writers from emitting local intent events during
  recovery.

### Phase 5 — Composer and conversation

- [x] Split “draft editable” from “submission enabled” in `Composer`,
  `ConversationDock`, and `ConversationView`.
- [x] Preserve text editing, selection, focus, local attachment removal, and
  command text while offline.
- [x] Disable send/steer, command execution, request answer, abort, model,
  effort, permission, speed, share, and new-session actions.
- [x] Show the availability reason beside the composer without replacing the
  transcript.
- [x] Keep failed/pending submission state intact and retry automatically or
  allow it only once online.
- [x] Apply the same contract to group composers and the floating expanded-panel
  composer.

### Phase 6 — Terminal resilience

- [x] Add an explicit `readOnly`/availability prop to `TerminalPanel`.
- [x] Preserve the grid and terminal component identity while the Kissopen Agent is down.
- [x] Mute the panel with theme tokens and a clear reconnecting/offline status.
- [x] Disable keyboard capture, input, paste, terminal-generated PTY replies, and
  resize writes while unavailable.
- [x] Keep selection, copy, scroll, link opening, and tab movement available.
- [x] Do not enqueue newly typed bytes during a Kissopen Agent outage.
- [x] Keep protocol auto-reconnect and recovery state; manual retry only
  accelerates it.
- [x] Disable new terminal creation while unavailable.

### Phase 7 — Files, previews, slots, and secondary Kissopen Agent surfaces

- [x] Keep loaded file/diff/media snapshots and unsaved file drafts visible.
- [x] Allow local file-draft editing but disable remote save, revert, refresh,
  load, retry, and new preview resolution.
- [x] Retain mounted browser/webapp/HTML preview DOM; disable only Kissopen Agent-bound
  navigation/reload actions.
- [x] Keep slot text visible and pass a connection refusal to Kissopen Agent-backed slot
  buttons.
- [x] Preserve last Inbox, Usage, Friends, Shared Sessions, Nodes, Instructions,
  Security, and Pairing snapshots.
- [x] Disable mutations on those surfaces while unavailable and show the same
  per-Kissopen Agent reason.
- [x] Keep `restricted` messaging distinct from offline messaging.

### Phase 8 — Reconciliation after recovery

- [x] Treat `offline/reconnecting → online` as a delivery hint to reconcile every
  materialized durable surface through its existing read/difference API.
- [x] Restart the P2P status stream with capped backoff and retain its last
  reading while retrying.
- [x] Ensure catalog fallback retries after repeated failures without a manual
  button.
- [x] Reconnect active transcript streams with their cursor/backfill contract.
- [x] Reconcile slots, inbox, usage, friends, shares, instructions, security, and
  open file metadata only while their surface lifetime requires it.
- [x] Avoid creating stores solely to deliver a recovery event.
- [x] Preserve references for unchanged entities so rows and transcript entries
  keep DOM identity.

### Phase 9 — Kissopen Agent Documents

The Kissopen Agent-backed Documents surface from
[`master-plans/02-kissopen-agent-documents.md`](../../master-plans/02-kissopen-agent-documents.md) does
not exist yet. Local Notes are not a substitute.

- [ ] When Documents is implemented, give every Kissopen Agent its stable Documents tab and
  collection store.
- [ ] Retain document list, open document, collaborative state, selection, and
  unsaved local changes while that Kissopen Agent is offline.
- [ ] Disable server persistence/attachment/version operations until online.
- [ ] Reconcile document differences in place on recovery.
- [ ] Do not copy documents into a global or host-owned offline cache.

## Verification

### Automated checks for this implementation

- [x] Format changed files with repository formatting.
- [x] Typecheck `kissopen-desktop-state`.
- [x] Typecheck and build `kissopen-desktop-ui`.
- [x] Typecheck `kissopen-desktop-app`.
- [x] Typecheck and build `kissopen-desktop-electron`.
- [x] Run `scripts/check-react-boundaries.mjs`.
- [x] Run `kissopen-desktop-state`: 150/150 unit tests passed.
- [x] Run `kissopen-desktop-app`: unit suite passed.
- [x] Run `kissopen-desktop-electron`: 67/67 unit tests passed after updating the
  session fixture for the new connection contract.
- [x] Run `kissopen-desktop-gym`: 21/21 tests passed across Chromium, Firefox, and
  WebKit.
- [x] Run the full `kissopen-desktop-ui` suite once, then rerun only its two failed
  files after fixing them: the unaffected 639 assertions passed in the full
  run, and the ModalOverlay and NotesPage files passed 24/24 and 6/6 across all
  three browsers.
- [ ] Run the state architecture check. It currently stops on the pre-existing
  `utils/fractionalIndexing.test.ts` import of forbidden `node:sqlite`; this
  Multiple Kissopen Agents diff does not touch that file.

### Manual lifecycle scenarios

- [ ] Cold start with local daemon stopped: one startup loader is allowed until
  the daemon becomes ready.
- [ ] Kill/restart local daemon after opening a chat, terminal, file draft, and
  panel: the shell never disappears and all identities/state survive.
- [ ] Disconnect/reconnect one remote machine: its section and retained content
  stay while other Kissopen Agents remain fully usable.
- [ ] Drop the host network while viewing a remote Kissopen Agent: both host and remote
  availability update without deleting either entry.
- [ ] Type into a message draft and file draft offline: text survives; send/save
  remain disabled; both can complete after reconnect.
- [ ] Select/copy/scroll an offline terminal: it works; typing does not queue
  bytes; the same terminal resumes after reconnect.
- [ ] Leave a preview, menu, modal, expanded panel, focused input, text selection,
  and sidebar scroll active across an outage: none resets.
- [ ] Verify compatibility and access-restricted remote Kissopen Agents still report their
  distinct states rather than being mislabeled offline.

### Lifecycle tests to add only when authorized

- Exact RouterProvider/AppShell/workspace/terminal child mount counts.
- Exact DOM node identity for sidebar rows, transcript, composer, tabs, terminal,
  preview, and dialogs across disconnect/reconnect.
- `document.activeElement`, text selection, local draft value, scroll positions,
  open menu/panel state, and subscription cleanup.
- Local host and remote node transitions in Chromium, Firefox, and WebKit at 2×.

## Completion boundary

The network-resilience foundation is complete when transient failures no longer
dispose or replace any Kissopen Agent, store, or mounted product surface; availability is
visible per Kissopen Agent; offline-capable local work continues; online-only actions are
consistently disabled/refused; and automatic recovery reconciles the retained
stores in place.

Kissopen Agent Documents remains a separate product feature until its master plan is
implemented, but its required Multiple Kissopen Agents behavior is specified here in advance.
