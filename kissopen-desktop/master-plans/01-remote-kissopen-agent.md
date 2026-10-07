# Remote Kissopen Agent

## Where we are going

A Kissopen Agent running on another machine should be usable from Kissopen exactly like the
local one. Not a lesser version of it, not a separate feature — the same
projects, the same sessions, the same screens, the same code paths. The only
thing that differs is which machine the work happens on.

Kissopen does not resolve machines over SSH, and it does not discover or hold a
credential for one. That approach is gone: no SSH destinations, no token and
endpoint discovery in the app, no machine the reader has to name.

What replaces it is the host Kissopen Agent. Kissopen connects directly to its own host, and
the host owns the trust and the transport: which machines it is peered with,
when it dials them, and when it gives up. Every other machine is reached
*through* that host, over the route the host already publishes for it.

## How it behaves

Kissopen holds one direct connection to its host Kissopen Agent, and one further ordinary Kissopen Agent
connection per node the host is peered with. A node connection is not a special
kind of connection: it is the same client, opened against the host's own peer
route for that node, so the work on the other side arrives through the ordinary
groups and session machinery and lands in the same stores and the same screens.

The host never hands its credentials to anyone. It authenticates the request
locally, forwards only the request itself, and the machine on the other end
answers with its own daemon's authority. Nothing about a node's identity or its
endpoint is app-level configuration; the app names a node only by the identity
the host already published for it.

The host's peer status feed remains what it has always been: discovery and
status. It says which machines exist and how each link is doing. It carries no
work. A node's projects and conversations arrive on that node's own connection,
and Kissopen does not expect the host's own project feed to include them.

Work from a node keeps its own namespace. A node's projects sit under that node
in the sidebar, addressed through that node's connection, and its identities
never collide with the host's or with another node's. Opening one is ordinary
navigation, because there is a real connection behind it.

Node status is live. The host Kissopen Agent streams its P2P status as it changes, and the
app shows it in Settings, as the list of nodes the host is peered with, and in
the sidebar, beside that node's own work. Settings reports; it does not manage.
A node the app cannot open work on is shown as status and nothing more, rather
than as a control that would go nowhere.

## How we know it is done

- Kissopen opens one direct connection to its host, plus one ordinary Kissopen Agent
  connection per connected node, through the host's own peer route.
- The app never names a machine, resolves an endpoint, or holds a credential for
  one; the host authenticates locally and forwards no credential of its own.
- A node's projects and chats arrive on that node's connection, through the same
  groups and session code paths, with no sync implementation of their own.
- Node work keeps a stable namespace under its node, and nothing it contributes
  can collide with the host's or another node's.
- Node and peer status is shown live in Settings and in the sidebar, from the
  host Kissopen Agent's streamed status rather than from anything the app polls or asks for.
- No SSH remote-Kissopen Agent code, contract, or setting remains.
