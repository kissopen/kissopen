# Slots

## Where we are going

Agents can plug content into fixed places in the app called slots. A slot is a
UI location that Kissopen renders and Kissopen Agent maintains: entries are created by
agents, stored on the Kissopen Agent side, and pushed to the app. Kissopen Agent only verifies
types — it does not judge content.

The slots are:

- The status line to the right of speed/permissions under the composer.
- Above the input itself.
- The workspace/project title.
- The sidebar menu.

Each slot supports specific content types. The content types are:

1. Text — markdown with URL support.
2. Button — performs an action: send a message to the current chat, open a
   webapp (rendered like the web preview), send a message to a specific chat,
   draft a message in a specific chat, or start a new chat in a
   workspace/project with a model/effort/prompt.

Every entry has a scope: everywhere, project, workspace, or session. A slot
can hold multiple entries at once; depending on the slot, the app renders all
of them or lets the user switch between them.

Every entry records its author agent, a description (what it is), and a
purpose (why it exists), so anyone in the system can figure out why it was
created and find the conversation about it.

Webapps live in a webapp folder in the user data — the `<home>/Kissopen` folders —
and are served just like the html preview. A webapp is created by importing a
folder into the app; no agent writes into the webapp folder directly. Creating
one provides a human-readable kebab-case name, a description, a purpose, the
author agent, the path to the sources, and an optional description of where
the sources are (like the project and folder). The first import goes into a
`v1` folder, the next version into `v2`, and so on. A webapp can be reverted
to a specific version, which becomes current without deleting the old
versions, and every update requires a description of the change. The agent
then attaches the webapp to some place in the app.

## How we get there

Kissopen Agent comes first. Kissopen Agent's own master plan for slots specifies the storage, the
API, the webapp folder and serving, and the agent tools; that work happens in
the Kissopen Agent repository. Kissopen builds on the finished Kissopen Agent behavior: it subscribes
to slot changes, renders each slot in its location with the entries in scope,
executes button actions, and opens webapps through the existing preview
machinery.

## How we know it is done

- An agent can create a slot entry through Kissopen Agent and it appears in the right
  place in Kissopen without a reload, and disappears when removed.
- Text entries render markdown with working links; button entries perform
  each of the listed actions.
- Scope works: an entry scoped to a project, workspace, or session shows only
  there; an everywhere entry shows everywhere.
- A slot with multiple entries renders them all or offers a switch, per slot.
- Every entry shows its author agent, description, and purpose on inspection.
- A webapp imported by an agent under `<home>/Kissopen` opens inside Kissopen like a
  web preview; importing again creates the next version, and reverting to an
  earlier version makes it current without deleting the others.
