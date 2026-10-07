# Independent KissOpen service

Target: `kissopen.com`, origin server `45.128.210.49`. Use dedicated service
configuration and credentials. Keep signing secrets, model credentials,
databases and deployment environment files private.

## Current status

Deployed on 2026-10-05 after the user verified the rebuilt server's ED25519 key.
The independent API/relay and built web client are at https://kissopen.com.
Service `kissopen.service` runs as a non-login `kissopen` user, listening only on
127.0.0.1:3005 behind Nginx/HTTPS. Release source:
`/opt/kissopen/releases/20261005-accounts-login`, with `/opt/kissopen/current`
pointing to it. Persistent PGlite/files: `/var/lib/kissopen`. Private environment:
`/etc/kissopen/server.env` (root-owned mode 0600). Let’s Encrypt renewal is enabled.
Existing unrelated Nginx sites were preserved.

Production API verification passed: HTTPS, authenticated WebSocket/realtime,
file upload/download integrity, account isolation, restart persistence and
WebSocket reconnection. Existing targeted server tests: 27 passing. Desktop
and mobile typechecks and client builds pass. The inherited desktop React-boundary
check still reports 50 violations in old relay views, not the new account code.

NodeLoc has been configured separately since the initial deployment. Google and
GitHub still require their own applications; unavailable providers stay disabled.
The original account-system restoration and branded callback page were deployed
on 2026-10-05. `kissopen-accounts.service` runs the Go API at 127.0.0.1:8081,
using the independent `kissopen_accounts` PostgreSQL database. Nginx routes
`/api/` there, preserving Node `/v1/` and socket routes. See
`../../account-service/README.md` for deployment configuration.

Verified after this deployment: service health, public account JSON config,
anonymous profile 401, NodeLoc availability, removed dashboard 404, and an
invalid-state callback returning the branded expiry page with matching CSP.
Desktop main/preload/renderer bundles and the web client were rebuilt, Go
cross-build/vet and desktop host typecheck passed, and the development desktop
was restarted. Node server suite: 129 passing. The shared desktop login UI shows
NodeLoc enabled with no stale unconfigured-service error. A real provider login,
native Keychain persistence and multi-device recovery are not yet verified.

## Account application configuration

### Same-account device login (2026-10-06)

The relay release is now `/opt/kissopen/releases/20261006T173300Z-device-login`.
Desktop and mobile use the same username/password (including configured 2FA) or
OAuth identity. Mobile no longer requires QR pairing. A logged-in desktop
automatically authorizes its existing Agent through the independent relay;
execution, files and scheduled tasks remain on the user's computer.

Workspace seeds stay in desktop Keychain-backed storage or mobile SecureStore.
An existing device transfers the seed to a newly authenticated device in a
signed, recipient-encrypted envelope with a two-minute lifetime. The server
stores only the envelope, verifies account/key ownership, and consumes requests
once. A previous mobile QR key is reused only if its public key matches the
authenticated account. Different keys/accounts are never merged or replaced.
An existing encrypted workspace needs one previously signed-in device online
for a new device's first connection; subsequent sign-ins use its local key.
Keep the computer and Agent online to operate that computer from mobile.

Deployment preserved account sessions, signing configuration, identity/key
bindings and history. Private rollback snapshots are in
`/var/backups/kissopen/20261006T173300Z-device-login`; the previous relay release
is `20261006T071832Z-account-security`. The account-service release is unchanged.
The Linux candidate passed first binding, replay rejection, account isolation
and encrypted transfer before activating the additive database migration.
Server tests: 148 passing; shared key-transfer/migration tests: 4 passing;
existing desktop transport tests: 15 passing; onboarding tests: 8 passing.
Real-device login still requires the user's own account authorization; a build
or successful installation is not evidence of that end-to-end check.

### Local plugin catalog (2026-10-06)

The account release is now `/opt/kissopen-accounts/releases/20261006-local-plugins`.
The independent catalog at `/srv/kissopen-plugin-catalog/20261006` contains 51
published packages, details and available icons. Package sizes and SHA-256 values
were verified locally, by the local desktop importer, and after transfer.
Existing account credentials and installed workspace state were preserved.
`CN_CLOUD_PLUGIN_CATALOG` selects it; Nginx exposes its public data assets under
`/downloads/plugins/`, preserving unrelated sites, account authentication and
loopback-only services. Cloud execution remains disabled.
Rollback files are in `/var/backups/kissopen/local-plugins-20261006`: the PostgreSQL
dump, `release.before`, `accounts.env.before` and `kissopen.nginx.before`. Restore
the previous release and private configurations, validate Nginx, then restart the
account service/reload Nginx. Do not restore a database dump unless required by an
explicit data rollback.
The development desktop was rebuilt/restarted onto the native plugin bridge.
Public directory/package/detail/icon reads and account/config health passed;
anonymous catalog/package API requests return 401. All 51 packages passed isolated
inert local imports. Signed-in native UI/MCP/schedule acceptance is still separate.

Register separate OAuth applications and set these exact callback URLs:

| Provider | Callback |
| --- | --- |
| GitHub | `https://kissopen.com/v1/community/auth/github/callback` |
| Google | `https://kissopen.com/v1/community/auth/google/callback` |
| NodeLoc | `https://kissopen.com/v1/community/auth/nodeloc/callback` |

Use a Google **Web application** client; the secret is exchanged only by this
server, never by a desktop/mobile client. The NodeLoc application uses
`openid profile`, not the separately reviewed `email` scope. GitHub uses
`read:user`. Use dedicated OAuth applications for this deployment.

Configuration template:
`packages/kissopen-server/.env.community.example`. The real environment file
must be private, outside source control. The deployed file is read by systemd as
root and passed to the non-root service; never relax its 0600 permissions.
Never put client secrets in `VITE_*`, `EXPO_PUBLIC_*`, HTML or application bundles.

## Whole-service layout

The existing `kissopen-server` contains the encrypted account/session/project
relay, HTTP APIs, WebSocket transport, local attachment storage, and the new
community login endpoints. Its standalone mode supports PGlite and local file
storage without requiring Redis or S3. It can also serve a built web client.
The restored `account-service/` Go service supplies the original profile, billing,
usage, theme, invite and administration APIs through an independent database.
It is deployed separately, with its own database and private credentials.
Local Agent execution stays on the user's device;
cloud execution requires independently configured resources. No cloud executor is
automatically started by adding account support.

Deployment must first inventory the target machine and existing applications.
Deployed layout:

- HTTPS reverse proxy for `kissopen.com`, including WebSocket upgrades.
- Node service bound only to loopback, with a non-root service identity.
- A separate persistent `/var/lib/kissopen` database/files directory.
- A private server environment file and a service manager unit.
- Versioned release directories, database/files backups and a rollback target.

Initial private backup: `/var/backups/kissopen/initial-20261005.tar.gz`, root-owned
0600, created with the service stopped. It includes data and the stable master
secret configuration. There is no offsite/recurring backup yet. Stop the service
for subsequent PGlite backups and never run a second database process alongside it.

Before the 20261005-accounts-login switch, the Node service was stopped for a
private relay/config backup and the new account database was dumped. Backup
directory: `/var/backups/kissopen/accounts-login-20261005` (0700; archives 0600).
The previous release remains at `/opt/kissopen/releases/20261005-community-auth`
and the previous Nginx config is included in that backup for rollback.

The web client is built with `COMMUNITY_APP_ENV=production`, and both
`EXPO_PUBLIC_COMMUNITY_RELAY_URL` and `EXPO_PUBLIC_COMMUNITY_ACCOUNT_URL` set to
`https://kissopen.com`. Static output is under the service's `webapp/` directory.
Native mobile builds use the same configuration; no App Store release is implied.
Desktop production renderer was built with Vite's `--configLoader runner`, because
Node's native config loader cannot resolve the inherited `.js` TypeScript imports.

Do not expose the source tree, environment file, database, metrics or OAuth
callback query strings through public files or access logs. Preserve existing
SSH access and unrelated services. Behind a local reverse proxy, enforce the
OAuth start rate limit at the proxy using the real client address; the API's
fallback limit otherwise sees the proxy as a shared caller.

Build the wire package, generate Prisma and typecheck the server before shipping.
Standalone migrations must run while the PGlite server is stopped: do not let
two processes open the same PGlite directory. Back up existing data before any
migration. A stable independent `HANDY_MASTER_SECRET` must be included in the
private backup; never print it to logs.

## Acceptance before reporting deployment complete

Verify HTTPS/domain routing, service restart, database persistence, attachment
uploads/downloads, WebSocket reconnection and all configured OAuth providers.
Verify cancellation/expiry, callback state/cookie checks, one-time completion and
sign-out. An existing encrypted account on another device must require its
existing workspace key, never silently create a new empty workspace. Do not call
the deployment or provider login complete based on a server build alone.
