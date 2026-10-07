# kissopen-wire

This document describes the shared wire package: `@kissopen/kissopen-wire`.

## Why this package exists

Before `kissopen-wire`, wire-level message and session-protocol schemas were duplicated across packages (CLI, app, server, and agent). That caused drift risk and made protocol evolution harder.

`@kissopen/kissopen-wire` centralizes those shared schemas and types so all clients and services agree on the same wire contract.

## Package identity

- npm name: `@kissopen/kissopen-wire`
- workspace path: `packages/kissopen-wire`
- package type: publishable library (not private)
- versioned dependency in consumers: `^0.1.0`

## What is shared

### 1. Wire message schemas

Shared from `@kissopen/kissopen-wire`:
- from `messages.ts`: `SessionMessageContentSchema`, `SessionMessageSchema`, `MessageMetaSchema`, `SessionProtocolMessageSchema`, `MessageContentSchema` (top-level `role` union: `user|agent|session`), `UpdateNewMessageBodySchema`, `UpdateSessionBodySchema`, `UpdateMachineBodySchema`, `CoreUpdateContainerSchema`
- from `legacyProtocol.ts`: `UserMessageSchema` (`role: 'user'`), `AgentMessageSchema` (`role: 'agent'`), `LegacyMessageContentSchema` (`role`-discriminated union for legacy only)

These are used for encrypted message/update contracts (`new-message`, `update-session`, `update-machine`).

### 2. Session protocol schema

Shared from `@kissopen/kissopen-wire`:
- `sessionEventSchema`
- `sessionEnvelopeSchema`
- `createEnvelope(...)`
- `SessionEnvelope` and related types

This is the canonical schema for the unified session protocol event stream.

Current role set in `sessionEnvelopeSchema`:
- `'user'` (user-originated envelope)
- `'agent'` (agent/system output envelopes)

Current session wire payload shape (decrypted message body):
- outer message `role` is always `'session'` for session-protocol records
- `content` is the session envelope object directly (not wrapped under `content.data`)
- envelope-level role remains inside `content.role` (`'user' | 'agent'`)
- envelope timestamp is required as `content.time` (Unix ms)

## Migration in this repository

### CLI (`packages/kissopen-cli`)

- Session protocol imports now reference `@kissopen/kissopen-wire` directly.
- `src/sessionProtocol/types.ts` now re-exports from `@kissopen/kissopen-wire` as compatibility shim.
- API wire schemas in `src/api/types.ts` now source shared message/update schemas from `@kissopen/kissopen-wire`.

### App (`packages/kissopen-app`)

- Shared API message/update schemas in `sources/sync/apiTypes.ts` now import these from `@kissopen/kissopen-wire`:
  - `ApiMessageSchema`
  - `ApiUpdateNewMessageSchema`
  - `ApiUpdateSessionStateSchema`
  - `ApiUpdateMachineStateSchema`

### Server (`packages/kissopen-server`)

- Prisma JSON message content type now references `SessionMessageContent` from `@kissopen/kissopen-wire`.
- Event router uses shared `SessionMessageContent` type for `new-message` payload typing.

### Agent (`packages/kissopen-agent`)

- `RawMessage` now aliases `SessionMessage` from `@kissopen/kissopen-wire`.

## Versioning model

All other workspace packages now declare a versioned dependency on `@kissopen/kissopen-wire`.

This intentionally mirrors post-publish consumption and reduces hidden coupling to workspace-local files.

## Build and release

`@kissopen/kissopen-wire` is configured the same way as existing publishable libraries in this repo:

- ESM/CJS/types outputs via `pkgroll`
- `build`: typecheck + bundle
- `test`: build + vitest
- `prepublishOnly`: build + test
- `release`: `release-it`
- npm publish registry configured via `publishConfig`

Use the same release entrypoint as other publishable packages:

```bash
yarn release
# choose kissopen-wire
```

or:

```bash
yarn workspace @kissopen/kissopen-wire release
```

When building workspaces from a clean checkout, build `@kissopen/kissopen-wire` first so dependent packages can resolve generated `dist` outputs.

## Publish checklist (maintainer)

1. Ensure all workspace builds/tests are green.
2. Confirm wire schema changes are backward-compatible or documented.
3. Bump and release `@kissopen/kissopen-wire`.
4. Update downstream package versions if needed.
5. Publish dependent package updates only after the new `kissopen-wire` version is available.

## Notes

- `kissopen-wire` should stay focused on wire contracts only (types + Zod schemas + small helpers).
- Domain/business logic should remain in consumer packages.
- Keep schema additions additive where possible to minimize client breakage.
