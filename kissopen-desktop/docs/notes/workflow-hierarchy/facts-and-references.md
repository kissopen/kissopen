# Workflow hierarchy: facts and references

Companion to the [UX proposal](proposal.md). This note distinguishes the user's stated needs, observed implementation, historical designs, external product descriptions, and proposed interpretations. It is research material, not a master plan.

## Provenance and limits

The source is Kirill's workflow brainstorm and follow-up discussion. Its verbatim record is `workflow-brainstorm-verbatim.md` in the persistent bot's folder, outside this repository. Selected relevant excerpts are reproduced below; the full conversation is not copied into the repository or made part of the proposal's public dependencies.

Code observations were checked against these main-checkout snapshots:

- Kissopen Desktop: [`83b2a068f20aab621679c2e66239e7b768d0dce2`](https://github.com/slopus/happy-desktop/commit/83b2a068f20aab621679c2e66239e7b768d0dce2).
- Kissopen Agent: [`112c1309763339729550c3fceb59db152da290a5`](https://github.com/slopus/happy-agent/commit/112c1309763339729550c3fceb59db152da290a5).

Source inspection is not an end-to-end UI test. API documentation states a contract; a master plan states intended direction. Neither alone proves every behavior is implemented. External product descriptions are primary-source claims, not independent evidence of usability or performance.

## 1. What the user actually needs

Selected verbatim excerpts:

> Placing something inside the folder should mean ownership.

> each human collaborator - and probably agent too?? gets a slice. they can also configure what they need / want - completely custom BUT the stuff still lives in the bigger org structure

> also avoid over nesting - keeping orgs flat is a reason - we want to keep agents flat too : D

> Oh yeah, also another point is a thread can actually have not just agents but also humans.

> Instead of looking at a huge thread of stuff that's going on, it would be way more useful to just be able to see what the current steps are that it's going through, and then maybe the challenges that it's facing.

The concrete scenarios behind these statements:

- **Kissopen One:** one cross-repository onboarding/release outcome, currently scattered among a persistent bot and separate project workspaces. Keep its decisions, implementation streams, reviews, and evidence together conceptually.
- **Quiet support:** three investigation threads should remain inspectable without becoming three permanent navigation obligations. Promote work only when it becomes independently meaningful.
- **Growth:** enduring Twitter and Reddit work can contribute to a release without becoming temporary children of every release.
- **Personal focus:** someone needs a private or quiet exploration space, a personalized daily view, and a way to see how their work fits the shared organization.
- **Shared conversation, distinct actors:** teammates can discuss one tweet strategy while publishing through different authorized accounts. Who speaks, pays for inference, owns content, and performs an external action cannot be conflated.
- **Resources:** documents, skills, checkouts, files, and compute can accompany work; a useful conversation need not have all of them. Non-repository bot files still need reliable history and persistence.
- **Planning cycles:** task, personal, team, and company planning need related information at different scales, not a mandatory new tree for each horizon.

These are real user-reported situations and hypotheses from one discussion, not a completed customer study. The proposal turns them into test cases rather than treating each suggested mechanism as a settled requirement.

## 2. Current implementation facts

### F1. Desktop organization remains primarily project/workspace-shaped

[`projectGroups`][desktop-groups] groups active workspaces by project and emits a flat collection of non-root children within each project. That inspected projection does not preserve a general arbitrary work-ownership hierarchy. Bot workspaces without a project are handled separately.

Interpretation: the user's cross-project co-location problem has a concrete model boundary behind it. Changing labels alone would not create shared ownership or independent personal views.

### F2. Parentage, visibility, and human sendability are not the same thing

The [Agent contract][agent-visibility] distinguishes `userVisible`, `managedByAnotherAgent`, and `canSendMessages`, including visible managed roots in another workspace. Managed agents are not automatically directly human-messageable.

Desktop [maps `parentAgentId` to `parentSessionId`][desktop-parent], while the inspected [session-group projection][desktop-session-groups] skips sessions with a parent. This is evidence of parentage-based treatment in those paths, not proof that every current UI surface mishandles every managed root.

Interpretation: flattening human-created and delegated conversations affects more than sidebar rendering. Visibility, interaction, provenance, and lifecycle need explicit meanings.

### F3. Addresses and history exist; discovery and external navigation are separate gaps

Desktop already has [instance-qualified chat routes][desktop-routes]. The inspected [Electron external-URL handler][desktop-external-links] handles authentication callbacks, not arbitrary session navigation. An internal route is not by itself a complete clickable external session-link experience.

The Agent API exposes [history by known agent ID][agent-history], but explicitly documents [no global agent-list endpoint][agent-discovery]. Thus “there is no history API” would be incorrect; discovering an authorized set of conversations is a different capability from reading a known conversation.

### F4. Persistent per-agent tasks are not yet the proposed shared work model

[`TasksModule`][agent-tasks] stores a bounded persistent list keyed by `agent_id`. The inspected Desktop [conversation projection][desktop-tasks] supplies `tasks: []`.

Interpretation: existing task persistence is useful precedent, but it does not establish a shared ownership tree, cross-work dependencies, or personal/team planning views. The empty projection is a source-level finding, not a claim that no task surface exists anywhere.

### F5. Workflows already coordinate durable collaborators, not tool-free inference steps

The [workflow implementation notes][agent-workflows] describe a checkpointed Monty coordinator, durable runs, and reuse of completed calls during continuation. Its [exposed operations][agent-workflow-operations] are `agent`, `log`, `parallel`, `phase`, and `pipeline`; this inspected surface is not a general arbitrary API-call workflow builder.

The [agent-call options][agent-workflow-options] include model, effort, provider, label, and output schema—not a tool/module allowlist. [Structured output handling][agent-workflow-output] adds a JSON-schema instruction to a collaborator prompt and validates its returned result. That is not evidence of a single, tool-free, provider-native structured inference call. The [collaborator configuration][agent-child-config] copies the parent's environment and modules.

Interpretation: a sandboxed coordinator does not mean its worker has no filesystem or tools. Deferred tool search, hidden supporting tabs, and a narrow prompt are also not hard capability restrictions. Benchmarking narrower initialization remains an open experiment; no performance claim is established here.

### F6. Speaker attribution exists; per-user external authority is a separate design problem

The inspected [message submission path][agent-speaker] obtains the authenticated team user ID and records it in message metadata. This supports attribution. It does not prove all subsequent actions select credentials or authorization from that identity.

The [secret contract][agent-secrets] describes an installation-wide catalog with attachments to projects, workspaces, or exact agents. That is not, by itself, a per-human delegated credential model.

Interpretation: preserve the distinction between speaker, responsible principal, acting account, and model-provider billing. “Can send the bot a message” is not a sufficient authorization rule for every connected account.

## 3. What earlier folders actually did

These are distinct stages, not one historical implementation with consistent semantics:

| Stage | Verified change | Relevant lesson |
| --- | --- | --- |
| [Synthetic cwd folders][history-cwd] | Grouped sessions around canonical working directories and synthetic identities. | Filesystem grouping helps location, but is not the same as ownership of cross-project work. |
| [Daemon project/worktree IDs][history-ids] | Replaced cwd-derived identities with daemon identities. | Identity should survive rename and reorganization. |
| [First real folders][history-folders] | Added nested logical folders and folder working locations; initially allowed filing existing project work without making its execution location the folder's location. | Navigation and execution were already separable concerns. |
| [Independent item links][history-links] | Added links for projects, workspaces, and documents; the same project could appear in multiple folders, and removing a link did not delete its target. | Reference placement need not mean ownership transfer. |
| [Exclusive session scopes in Agent][history-scopes] | A later model gave sessions an exclusive scope; filing a session into a folder changed its scope and cwd. | Do not conflate the initial filing overlay with this later ownership/execution model. |
| [Kissopen Agent client replacement][history-replacement] | Removed the old folder implementation during the rig-connect client replacement. | Removal is not evidence that users rejected hierarchy; the commit does not establish that rationale. |

In the [historical folder repository][history-folder-repository], moving a folder changed its parent/order in metadata rather than physically relocating its directory. Filing a chat had separate scope/cwd consequences. The [Agent folders-and-documents plan][agent-folder-plan] describes a virtual nested structure backed by flat opaque directories, a main conversation plus additional conversations, and independently ordered resource links. It also contains unresolved persistence/checkpoint choices.

The useful precedent is therefore not “restore folders.” It is: stable IDs, virtual organization, link-versus-move semantics, and explicit execution scope have already been explored. The new proposal must decide their relationship rather than silently importing contradictory versions. None of this establishes a complete inherited multi-user permission system.

## 4. External references and what they do—and do not—support

### Grok Bot: make delegation comprehensible without requiring supervision

[Designing Grok Bot for a world of persistent agents](https://x.ai/news/designing-grok-bot) describes a persistent roster and five exposed primitives: Bots, Chats, Prompts, Tools, and Artifacts. Its useful design question is:

> Did this help someone delegate, or did it give them one more thing to manage?

The post's progress experiments are more nuanced than “show nothing but thinking.” Three dots supplied too little reassurance; adding a written step made people want to see all the steps. The resulting design includes activity cues and optional inspection, including current-action detail and computer preview/takeover. These are the authors' reported design observations, not a benchmark conducted for this proposal.

The relevant interpretation is: make it easy to know whether delegated work is healthy, recover context, and intervene when necessary, without making continuous supervision the default. A persistent bot can hold a recognizable responsibility while conversation, reusable instructions, tools, and artifacts remain distinct. This supports quiet supporting work and a useful current overview; it does not establish that an ownership tree is needed.

[Introducing Grok Bot](https://x.ai/news/introducing-grok-bot) emphasizes completing work in real applications and reusable routines. [Designing Grok Bot with Grok Bot](https://x.ai/bot/guides/designing-grok-bot-with-grok-bot) is an additional example of specialist bots contributing to iterative design work.

Important scope difference: the [computer and apps documentation](https://docs.x.ai/grok-bot/computer-and-apps) describes one user's bots sharing a computer, files, and app logins; separate screens are not separate credential/security boundaries. That simpler “my bots” model is not evidence that a shared multi-human Kissopen server should share all authority in the same way.

### Notion and Slack: shared context and personal arrangement can coexist

Notion's [workspace introduction](https://www.notion.com/help/intro-to-workspaces) and [sidebar documentation](https://www.notion.com/help/navigate-with-the-sidebar) distinguish shared/teamspace content from personal sidebar controls such as favorites and sections. “Notion has an identical sidebar for everyone” is too strong: shared content organization and personal navigation coexist.

Slack explicitly says [custom sidebar sections](https://slack.com/help/articles/360043207674-Organize-your-sidebar-with-custom-sections) are personal and do not change colleagues' sidebars. [Joining a channel](https://slack.com/help/articles/205239967-Join-a-channel) is another distinction between what exists and what someone chooses to follow.

Interpretation: borrow the separation of canonical shared context from a person's working view. These products do not prove that every artifact needs one owning parent, that all personal arrangements should be shared, or that an agent's working set should literally be a sidebar.

### Git and enterprise identity: separate attribution from authentication

The [Git commit reference](https://git-scm.com/docs/git-commit) describes author and commit metadata. This is not the same as remote authentication through an SSH key or HTTPS credential, nor is it the same as commit signing.

GitHub's [credential types](https://docs.github.com/en/organizations/managing-programmatic-access-to-your-organization/github-credential-types) and [SSO authorization for personal access tokens](https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-single-sign-on/authorizing-a-personal-access-token-for-use-with-single-sign-on) illustrate why a company deployment must respect account, application, and organization policies. Personal and application/service identities can both be legitimate, depending on the action and policy.

Interpretation: the UI needs to distinguish who requested an action, whose authority executes it, what account an external service sees, and how compute is funded. Prompt-level awareness of the speaker can help avoid mistakes but does not replace enforced credential selection and authorization. No per-user Git-authentication implementation is asserted or changed by this note.

## 5. Relationship to the current Desktop plans

These remain the governing plans; this proposal does not edit or supersede them:

| Existing plan | Constraint or relationship |
| --- | --- |
| [Master plan](../../../master-plans/00-master-plan.md) | A discussion note is not a new approved product direction. |
| [Remote Kissopen Agent](../../../master-plans/01-remote-kissopen-agent.md) | Resources and operations remain routed to their owning Kissopen Agent instance. |
| [Documents](../../../master-plans/02-kissopen-agent-documents.md) | Documents are instance-owned, independent of sessions/projects, with collaborative state and a Markdown representation. Organizational filing need not change technical storage ownership. |
| [File viewer](../../../master-plans/03-file-viewer.md) | Preserve a predictable Files surface; a selected view is not a filesystem sandbox. |
| [Slots](../../../master-plans/04-slots.md) | Existing fixed extension locations are not authorization for an arbitrary widget framework or unlimited agent control over navigation. |
| [Multiple Kissopen Agents](../../../master-plans/05-multiple-kissopen-agents.md) | Preserve instance-qualified identities, routing, and failure isolation; a combined view does not merge remote ownership. |

Before a real implementation, explicitly resolve any conflicts with these plans and the Agent protocol. The narrow demo can simulate proposed state; it must not imply missing persistence or security is already solved.

## 6. Deferred or unverified

- The broad visualization/code-review survey was deferred at the user's request. QM and BB still need unambiguous product identification. Prime Agent, Devin, Conductor, Cursor project organization, and the code-review players are not established evidence in this note.
- BlockNote, Lexical, and Tiptap are possible editor references, not a completed editor comparison or a chosen document model.
- The user-flow → implementation-flow → code-review artifact idea remains valuable adjacent work, but a visual review platform is not part of this hierarchy prototype.
- No benchmark here establishes that fewer tools improve quality, latency, or cost. No study here establishes that nesting improves teamwork.
- No decision has been made on independent clones versus worktrees, per-bot Git history, storage/sync architecture, cross-server personal-domain transfer, or generic customizable company-management software.
- The customer interviews and comparative prototype described in the proposal remain proposed work.

[desktop-groups]: https://github.com/slopus/happy-desktop/blob/83b2a068f20aab621679c2e66239e7b768d0dce2/packages/happy-desktop-state/src/happyAgentConnection/projection.ts#L358
[desktop-parent]: https://github.com/slopus/happy-desktop/blob/83b2a068f20aab621679c2e66239e7b768d0dce2/packages/happy-desktop-state/src/happyAgentConnection/projection.ts#L606
[desktop-session-groups]: https://github.com/slopus/happy-desktop/blob/83b2a068f20aab621679c2e66239e7b768d0dce2/packages/happy-desktop-state/src/happyAgent/happyAgentProjectGroupProject.ts#L145
[desktop-routes]: https://github.com/slopus/happy-desktop/blob/83b2a068f20aab621679c2e66239e7b768d0dce2/packages/happy-desktop-app/sources/navigation/happyAgentRoute.ts#L55
[desktop-external-links]: https://github.com/slopus/happy-desktop/blob/83b2a068f20aab621679c2e66239e7b768d0dce2/packages/happy-desktop-electron/sources/main/main.ts#L318
[desktop-tasks]: https://github.com/slopus/happy-desktop/blob/83b2a068f20aab621679c2e66239e7b768d0dce2/packages/happy-desktop-state/src/happyAgentConnection/projection.ts#L175
[agent-visibility]: https://github.com/slopus/happy-agent/blob/112c1309763339729550c3fceb59db152da290a5/packages/happy-agent/API.md#L2711
[agent-history]: https://github.com/slopus/happy-agent/blob/112c1309763339729550c3fceb59db152da290a5/packages/happy-agent/API.md#L3520
[agent-discovery]: https://github.com/slopus/happy-agent/blob/112c1309763339729550c3fceb59db152da290a5/packages/happy-agent/API.md#L4968
[agent-tasks]: https://github.com/slopus/happy-agent/blob/112c1309763339729550c3fceb59db152da290a5/packages/happy-agent-modules/sources/tasks/TasksModule.ts#L92
[agent-workflows]: https://github.com/slopus/happy-agent/blob/112c1309763339729550c3fceb59db152da290a5/packages/happy-agent-modules/sources/workflows/README.md
[agent-workflow-operations]: https://github.com/slopus/happy-agent/blob/112c1309763339729550c3fceb59db152da290a5/packages/happy-agent-modules/sources/workflows/runner/WorkflowScriptRunner.ts#L114
[agent-workflow-options]: https://github.com/slopus/happy-agent/blob/112c1309763339729550c3fceb59db152da290a5/packages/happy-agent-modules/sources/workflows/runner/WorkflowScriptRunner.ts#L16
[agent-workflow-output]: https://github.com/slopus/happy-agent/blob/112c1309763339729550c3fceb59db152da290a5/packages/happy-agent-modules/sources/workflows/runner/WorkflowScriptRunner.ts#L160
[agent-child-config]: https://github.com/slopus/happy-agent/blob/112c1309763339729550c3fceb59db152da290a5/packages/happy-agent-modules/sources/collaboration/CollaborationModule.ts#L621
[agent-speaker]: https://github.com/slopus/happy-agent/blob/112c1309763339729550c3fceb59db152da290a5/packages/happy-agent-modules/sources/api/ApiModule.ts#L3186
[agent-secrets]: https://github.com/slopus/happy-agent/blob/112c1309763339729550c3fceb59db152da290a5/packages/happy-agent/API.md#L1802
[history-cwd]: https://github.com/slopus/happy-desktop/commit/40e4f3756c0bfc0c4e7b8798a6b5cc6b5af6e0d1
[history-ids]: https://github.com/slopus/happy-desktop/commit/9e019dddc7fa856565b187fae00bcda1c4520c01
[history-folders]: https://github.com/slopus/happy-desktop/commit/153e0a966fa3843bc67159b1c30cf88d1d260f16
[history-links]: https://github.com/slopus/happy-desktop/commit/c488e1d23bb14d5c1b7a17b565f4d38ae8920927
[history-scopes]: https://github.com/slopus/happy-agent/commit/452f14b1e8835faecb16368929791ced6da837e0
[history-replacement]: https://github.com/slopus/happy-desktop/commit/a25adb30d51c3fd963491d054d0bba6259e29e2e
[history-folder-repository]: https://github.com/slopus/happy-agent/blob/452f14b1e8835faecb16368929791ced6da837e0/packages/rig/sources/folders/FolderRepository.ts#L275
[agent-folder-plan]: https://github.com/slopus/happy-agent/blob/112c1309763339729550c3fceb59db152da290a5/master-plans/18-folders-and-documents.md
