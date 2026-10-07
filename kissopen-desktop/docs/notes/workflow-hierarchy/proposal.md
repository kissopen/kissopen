# Workflow hierarchy: shared ownership, personal views

Status: discussion draft. This is not an approved implementation specification or a change to the master plans.

Synthesized from Kirill's workflow brainstorm. [Facts and references](facts-and-references.md) separates stated needs, inspected code, historical designs, external references, and assumptions. The full verbatim conversation remains in the bot's notes; this document is a curated proposal.

## The proposition

One shallow shared structure explains where work belongs. Each human or agent has a configurable working view of the relevant parts. Work retains one identity and an accountable home even when several people arrange, follow, or reference it differently.

The purpose is to help someone answer: what are we trying to accomplish, what part is mine, what needs a decision, and where is the surrounding context? It is not to display every agent process or require people to model their entire company before doing useful work.

### Keep these axes distinct

| Axis | What it answers | Proposed UX |
| --- | --- | --- |
| Ownership | Where does this belong, and who maintains it? | Shared map, canonical breadcrumb, responsible people, Move action. |
| Contribution/dependency | What outcome does it support; what does it depend on? | Linked work and blocking relationships in the overview. |
| Attention | What should I follow or act on today? | Personal views, pins, filters, and requests needing a decision. |
| Conversation | Who said what; where does discussion continue? | Attributed shared conversation and supporting tabs with retained history. |
| Execution/storage | Where does work run; what survives a session or machine? | Explicit resource and terminal targets; durable content and version history. |
| Identity/authority | Who requested, authorized, paid for, and performed an action? | Participants, access information, and requester/acting-account disclosure. |
| Planning horizon | Next step, today's priorities, or team commitments? | Different views over the same work, not separate copies or mandatory phase folders. |

## 1. A shallow shared map

Use the actual names of the work in the interface: Kissopen One, Growth, Twitter. “Work area” is descriptive shorthand, not a required new vocabulary word. Enduring responsibilities and finite undertakings can use the same basic place.

```text
Kissopen Core
├── Kissopen One
├── Growth
│   ├── Twitter
│   └── Reddit
└── Operations
```

Each independently maintained work area has a stable address, one canonical owning parent, a purpose, and a responsible person or group. The owning parent and responsible people are different fields: reorganizing navigation is not automatically reassigning responsibility.

Aim for organization → area/work → independently meaningful sub-work, without imposing a hard depth limit yet. Kissopen One does not need Departments → Product → Initiatives → Releases above it. A checklist item or spawned worker does not automatically deserve a new permanent node.

Create a child when it has a discussion, responsibility, or result that people will return to independently. Use links for other contributions and dependencies. A launch announcement can be owned in Growth → Twitter and linked from Kissopen One without duplicating it.

This is a logical ownership structure, not an agent-management pyramid, a required company org chart, or a directory tree on disk. Documents can have an organizational home while remaining technically instance-owned resources, as the current document master plan specifies.

## 2. My work is a view, not another ownership tree

Navigation has two modes: **My work** and **Shared map**, with search available from both.

My work starts with deliberately followed or pinned work and clearly marked requests needing the person's attention. A person can make groups such as Today, Launch, or Growth; reorder items; include selected branches; and save filters. The original work stays in its canonical home.

Saved views can be shared as starting points and then personalized. Sharing a view does not grant access to its contents. A personal group must look and behave differently from an owning folder; dragging within it rearranges navigation, not ownership.

Every opened item retains a canonical breadcrumb and a **Show in shared map** action. Surrounding context is one click away without leaving the whole organization expanded. Agents can update status and suggest useful views, but should not continually reorder a person's pinned sidebar.

The shared map shows only content the viewer may access. A private owning location and a shared-but-quiet item are distinct: privacy requires enforcement; quiet work is discoverable without being automatically followed or announced to everyone.

## 3. Opening work gives you a place, not a log dump

```text
My work                  Kissopen Core / Kissopen One
                         Kissopen One                 Review needed
Pinned                   Owner: Kirill · Participants: …
  Kissopen One
  Twitter announcement   Overview | Conversation

Needs me                 Onboarding decision
  Onboarding review      Latest proposal, open question, source links

                         Plan · Documents · Linked work
Shared map               Supporting work: 3 investigations  [Open]
```

This is an illustrative layout, not an implemented interface.

- **Conversation:** one canonical shared conversation with attributed human and agent messages. Model runs are activity within it, not its identity.
- **Overview:** current purpose, responsible people, the next meaningful decision, plan, relevant artifacts, and selected linked work. Start with Markdown and ordinary links. A chosen document can serve as the overview.

The entry view is an explicit setting, not something an agent silently replaces on every visit. Conversation remains predictably accessible; direct links can target either view.

Files, documents, checkouts, and compute are optional resources. Start with a curated useful set and an explicit way to inspect all authorized resources. This visible selection is not an access boundary. Keep the existing Files affordance; selecting a terminal must name its execution environment, especially when several checkouts are attached. Work with no compute is still useful as conversation and documents.

## 4. Agents get working sets, not miniature companies

Yes: an agent gets a slice too. It contains assigned work, relevant instructions and documents, and references to authorized resources. It is an operational working set, not necessarily a human-looking sidebar the model must traverse.

Separate **available scope** from **selected working set**. Humans and agents can narrow and reorganize their focus. Doing so cannot expand access. Agents can request additions; granting them is a separate action.

Keep agents as flat peers with responsibilities and assignments. A specialist can contribute in several places. An area may name a default coordinator, but every folder does not require a manager bot or a recursively copied collection of skills. Work keeps its identity and conversation when an agent joins, leaves, or is reassigned.

Skills and documentation fit alongside the work with distinct roles: documents hold knowledge or decisions; skills/instructions describe how an agent should operate. Relevant context can be selected from company-wide and task-specific material. A document's presence or a sidebar link does not silently install instructions, grant tools, or confer authority.

Creator/worker ancestry remains useful for execution provenance and lifecycle; it does not determine shared navigation. A workflow may coordinate conversations, tool calls, or a single structured inference without generating a tree of permanent sidebar items. Constrained worker initialization is a runtime question, not something hiding a tab solves.

## 5. Quiet execution, deliberate promotion

Supporting conversations are linked under the work they serve and open as tabs. Show a compact, truthful state—working, waiting, blocked, or ready for review—and the latest meaningful update. Keep raw activity and evidence inspectable. Do not manufacture progress when there is no new information.

Human-created and agent-created conversations should be equally addressable. Starting through delegation does not make a conversation a permanently inferior kind of chat.

Distinguish these actions:

| Action | What changes | What does not silently change |
| --- | --- | --- |
| Pin / add to my view | Personal navigation. | Ownership, access, content, colleagues' views. |
| Link from another area | Another route to the same work. | Canonical home, conversation, or access. |
| Make a work item | Supporting work becomes independently maintained; choose a home and responsible people. | Existing history; preserve the address or an explicit stable redirect. |
| Move to another area | Canonical owning home. | Identity/history; review consequential access changes explicitly. |
| Share / change access | Who may access or change work. | Everyone's personal sidebar. |
| Copy to another domain | A new retained copy with source provenance. | The original's owner or continued presence. |
| Archive | Active lifecycle status and default visibility. | Retained evidence; closing a tab is not archiving or canceling execution. |

A long-lived onboarding subproblem can become a work item; a completed repository investigation normally remains supporting evidence. Promotion should not copy the conversation or lose its relationship to the original goal. It may be a child or a linked peer, depending on where it actually belongs.

## 6. Manage ownership and access where work lives

The owning tree is the primary place to inspect and manage sharing. The candidate default is access inherited from the owning area, with clearly displayed effective access and a small set of roles. Exact enforcement, restrictive children, and exceptions remain open—not implemented promises.

A move previews the destination and any new readers or lost access. The source and destination may both require authorization. Agents can explain or propose the change; agreement between agents is not itself authority to disclose content. Logical moves do not move files on disk unless a distinct storage operation is included.

Content access and external account authority are separate. Being a contributor in Growth must not silently permit publishing through every attached Twitter account. A shared conversation can contain several human speakers, but an action still needs an accountable principal and an authorized acting account. Its model-provider funding may be a third identity.

Similarly, Git author/committer metadata, remote authentication, and commit signing answer different questions. A company service identity can be legitimate; neither one shared identity for everything nor a personal identity for every automated action should be assumed.

Git-backed file history in today's bot folders is a useful storage experiment, not a complete persistence design. It does not automatically back up files, synchronize machines, or capture database-held conversations and collaborative document state. A shared logical tree also does not make shared Git worktrees safe across trust boundaries.

## 7. The Kissopen One walkthrough

1. Kirill opens My work and goes directly to Kissopen One. It opens on the selected onboarding overview, with conversation one click away.
2. Three repository investigations finish. Their conclusions and one unresolved decision appear in the overview; they do not create three permanent sidebar rows.
3. A colleague takes responsibility for a sustained onboarding subproblem. Its conversation becomes explicit work, preserving history. Each person can pin it independently.
4. Growth → Twitter owns the launch announcement. Kissopen One links to it, tracking the dependency without duplicating the announcement or absorbing the Twitter practice.
5. Workflow exploration can remain private, or shared but quiet. Publishing selected notes is a deliberate act. Copying notes into a personal domain is separate from reorganizing the same organization's sidebar.
6. The tweeting agent's working set includes the announcement and writing guidelines. Publishing names the intended account and accountable actor. Using a shared model subscription does not decide whose Twitter identity acts.
7. After release, archive completed work and retain its decisions, evidence, and links. Growth continues. A new release can reuse relevant knowledge without inheriting every previous worker thread as active work.

## 8. Prove it in three stages

### First: a convincing interactive demo

Prototype My work / Shared map, overview / conversation, supporting tabs, personal groups, canonical breadcrumbs, and the distinct Pin / Link / Move / Share interactions. Seed Kissopen One, Growth, a launch announcement, three repository investigations, and private versus shared-but-quiet exploration. Simulate two humans and a flat set of peer agents.

Use fixture data and visibly simulated identities and access outcomes. Do not connect real credentials, publish tweets, change live sharing, transfer private conversations, or claim sandbox enforcement. This tests comprehension and navigation, not security or agent performance.

Compare against a strong flat baseline with persistent work items, useful overviews, quiet worker tabs, and the same information. The tree must add value for ownership, surrounding context, and handoffs—not merely benefit from better summaries.

With four to six participants, counterbalance the two layouts and ask them to:

1. Find the decision blocking the release and the person responsible.
2. Open its supporting investigation and return to the main discussion.
3. Add the Twitter announcement to their launch view without moving its home or changing a colleague's view.
4. Explain the difference between hiding exploration from their sidebar and making it private.
5. Resume work after an interruption and explain how it contributes to the larger outcome.

Record task success, time, wrong turns, accidental move/share attempts, and whether people can correctly name the work's home. Ask what they expected before explaining the controls. A few participants can expose usability failures; they cannot establish broad product-market fit.

The proposal loses if the tree mainly produces filing decisions, people cannot distinguish a view from ownership, or the flat baseline supports context and handoffs just as well. Reduce hierarchy rather than defending it.

### Second: a real, narrow pilot

If the demo is understandable, implement enough durable metadata and routing for two or three teammates to use one cross-repository undertaking for a week. Preserve real conversation addresses and evidence; persist ownership and personal views across restart. Use existing authorized resources without inventing a new credential or sandbox system.

This stage requires coordinated backend/API work where the current protocol lacks the model; a Desktop-only navigation overlay cannot establish shared ownership or access guarantees. Agree any master-plan changes before implementation.

Look for repeated return to the same work, successful handoffs, fewer searches through scattered workspaces, and less sidebar maintenance. Record where people revert to chat, issues, or documents outside the prototype. Attractive fixture data is not evidence that the system survives real work.

### In parallel: customer discovery

Interview people doing organizational work about their most recent real cross-team task before showing the concept. Ask them to reconstruct where they found the owner, kept decisions, tracked dependencies, handed off work, and chose today's priorities. Include people whose work is not primarily coding.

Distinguish problems caused by missing information from problems caused by navigation, accountability, or access. Test whether a shared ownership map is wanted at all; do not assume every company needs a customizable management harness. No interviews or outreach have been conducted for this note.

## Decisions to settle before building beyond the demo

- **Minimum durable unit:** test one canonical conversation per work area with supporting threads. Do not yet require every thread to be a folder or every area to have an agent.
- **Canonical home:** can people pick a useful home for cross-cutting work, with links handling the other relationships?
- **Personal slice defaults:** which requests deserve attention automatically, and which subscriptions remain deliberate?
- **Promotion:** what makes supporting work independently meaningful? Pinning alone must not restructure shared work.
- **Resources and persistence:** where do documents, file history, checkouts, and conversation state actually live? Git is only one part of this question.
- **Authority:** what access changes does moving imply, and what principal authorizes external actions? Keep this visible but defer the full permissions design.
- **Agent initialization:** what must a task-specific run inherit, select, or exclude? Tool-search visibility is not tool permission enforcement.

For now, the proposal is a testable UX model. It does not select a rich-text editor, design a generic widget platform, replace the workflow runtime, implement cross-server transfers, or revise master plans. The next useful deliverable is the comparative interactive demo, not a wholesale architecture migration.
