# API

This document covers the HTTP API surface and authentication flows. For WebSocket updates and event payloads, see `protocol.md`. For encryption boundaries and encoding details, see `encryption.md`.

## Method conventions
- **GET** is used for reads.
- **POST** is used for mutations or actions, even when the operation doesn't map cleanly to a single entity.
- **DELETE** is used when intent is unambiguous (e.g., removing a token or deleting a session/artifact).

We intentionally avoid the full REST verb palette because many operations span multiple entities or have non-CRUD semantics.

## Authentication
Most endpoints require `Authorization: Bearer <token>`.

Auth flows:
- `POST /v1/auth`
  - Body: `{ publicKey, challenge, signature }` (base64 strings)
  - Verifies signature using the provided public key.
  - Upserts account by public key and returns `{ success, token }`.

- `POST /v1/auth/request`
  - Body: `{ publicKey, supportsV2? }`
  - Creates or returns a terminal auth request.
  - Response: `{ state: "requested" }` or `{ state: "authorized", token, response }`.

- `GET /v1/auth/request/status?publicKey=...`
  - Response: `{ status: "not_found" | "pending" | "authorized", supportsV2 }`.

- `POST /v1/auth/response`
  - Body: `{ response, publicKey }` (requires Bearer auth)
  - Approves a terminal auth request.

- `POST /v1/auth/account/request`
  - Body: `{ publicKey }`
  - Similar to terminal auth, but for account linking.

- `POST /v1/auth/account/response`
  - Body: `{ response, publicKey }` (requires Bearer auth)

## Endpoint catalog
### Community OAuth identity

This identity service is independent of encryption-key relay authentication.
Provider client secrets stay on the server. A workspace key stays on the client.
Providers are identified by `github`, `google`, or `nodeloc`.

- `GET /v1/community/auth/providers` returns `{ providers }` for configured providers.
- `POST /v1/community/auth/start` accepts `{ provider }` and returns
  `{ id, pollToken, authorizationUrl, expiresAt }`. Open `authorizationUrl` in a
  browser. Never place `pollToken` in URLs. Login attempts expire after 10 minutes.
- `GET /v1/community/auth/:id/authorize` is the browser-only entry supplied by
  `start`. It sets an HttpOnly cookie and redirects to the provider.
- `GET /v1/community/auth/:provider/callback` checks state and that cookie,
  exchanges the provider code, and displays a static completion message.
  GitHub/Google also use PKCE. Provider access tokens never reach the client.
- `GET /v1/community/auth/:id/status`, with `Bearer pollToken`, returns
  `{ status: "pending" }`, `{ status: "failed", message }`, or
  `{ status: "authorized", profile, challenge, workspacePublicKey }`.
  `workspacePublicKey` is an Ed25519 public key encoded as hex, or `null` before
  binding. `challenge` is base64url. No workspace secret is returned.
- `POST /v1/community/auth/:id/complete`, with `Bearer pollToken`, consumes the
  authorization once. `{ mode: "identity" }` returns `{ profile, token }` for a
  community account session. `{ mode: "workspace", publicKey, signature }`
  additionally verifies the signature over decoded `challenge`, binds the
  workspace and returns `workspaceToken` for existing relay APIs. `publicKey`
  and `signature` are base64. A bound workspace's public key cannot be replaced.
- `DELETE /v1/community/auth/:id`, with `Bearer pollToken`, cancels a login.
- `GET /v1/community/account`, with the community session token, returns profile.
- `DELETE /v1/community/account/session` revokes that community session.

Community session tokens expire after 30 days. They are not relay tokens and
cannot authorize session/project APIs. Profiles contain only `{ id, provider,
name }`; email matching does not merge identities. Desktop has optional account
sign-in; mobile/web bind the encrypted relay using the device key. Real provider
verification is still pending because application credentials are not configured.
See `community-deployment.md`.

### Sessions
- `GET /v1/sessions`
- `GET /v2/sessions/active?limit=...`
- `GET /v2/sessions?cursor=cursor_v1_<id>&limit=...&changedSince=...`
- `POST /v1/sessions` (create or load by `tag`)
- `GET /v1/sessions/:sessionId/messages`
- `DELETE /v1/sessions/:sessionId`

### Machines
- `POST /v1/machines` (create or load by id)
- `GET /v1/machines`
- `GET /v1/machines/:id`

### Artifacts
- `GET /v1/artifacts`
- `GET /v1/artifacts/:id`
- `POST /v1/artifacts`
- `POST /v1/artifacts/:id` (versioned update)
- `DELETE /v1/artifacts/:id`

### Access keys
- `GET /v1/access-keys/:sessionId/:machineId`
- `POST /v1/access-keys/:sessionId/:machineId`
- `PUT /v1/access-keys/:sessionId/:machineId`

### Key-value store
- `GET /v1/kv/:key`
- `GET /v1/kv?prefix=...&limit=...`
- `POST /v1/kv/bulk`
- `POST /v1/kv` (batch mutate)

### Account and usage
- `GET /v1/account/profile`
- `GET /v1/account/settings`
- `POST /v1/account/settings`
- `POST /v1/usage/query`

### Push tokens
- `POST /v1/push-tokens`
- `DELETE /v1/push-tokens/:token`
- `GET /v1/push-tokens`

### Connect (GitHub + vendor tokens)
- `GET /v1/connect/github/params`
- `GET /v1/connect/github/callback`
- `POST /v1/connect/github/webhook`
- `DELETE /v1/connect/github`
- `POST /v1/connect/:vendor/register` (`vendor` in `openai | anthropic | gemini`)
- `GET /v1/connect/:vendor/token`
- `DELETE /v1/connect/:vendor`
- `GET /v1/connect/tokens`

### Users, friends, feed
- `GET /v1/user/:id`
- `GET /v1/user/search?query=...`
- `POST /v1/friends/add`
- `POST /v1/friends/remove`
- `GET /v1/friends`
- `GET /v1/feed`

### Version and voice
- `POST /v1/version`
- `POST /v1/voice/token`

### Dev-only
- `POST /logs-combined-from-cli-and-mobile-for-simple-ai-debugging` (only if enabled)

## Implementation references
- API routes: `packages/kissopen-server/sources/app/api/routes`
- Auth module: `packages/kissopen-server/sources/app/auth/auth.ts`
