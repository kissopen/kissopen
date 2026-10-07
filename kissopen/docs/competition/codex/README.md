# Codex

Reviewed on 2026-03-20 from `../kissopen-adjacent/research/codex` at commit
`ec32866c379405a28b58c0064c857fb60ed3c735`.

## Why it matters

Codex is the strongest backend protocol reference in this set.

- typed app-server contract
- explicit `thread`, `turn`, and `item` model
- approvals are server requests, not ad hoc message events
- sandbox policy is much richer than OpenCode's
- resume, fork, and live replay are clearly first-class concerns

## Current take

- If Kissopen wants a server-side session protocol, Codex is the best reference.
- If Kissopen wants a UI/session transcript shape, OpenCode still feels stronger.
- The best outcome may be OpenCode-like transcript state with Codex-like approval and runtime semantics.

## Important repo files

- `../kissopen-adjacent/research/codex/codex-rs/app-server/README.md`
- `../kissopen-adjacent/research/codex/codex-rs/app-server-protocol/src/protocol/v2.rs`
- `../kissopen-adjacent/research/codex/codex-rs/app-server/src/lib.rs`
- `../kissopen-adjacent/research/codex/codex-rs/app-server/src/transport.rs`
- `../kissopen-adjacent/research/codex/codex-rs/app-server/src/thread_state.rs`
- `../kissopen-adjacent/research/codex/codex-rs/app-server/src/codex_message_processor.rs`

See `docs/competition/codex/message-protocol.md` and
`docs/competition/codex/sources.md`.
