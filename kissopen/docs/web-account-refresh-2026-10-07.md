# Hosted Web account client refresh — 2026-10-07

The hosted app still served the 2026-10-06 Expo export after the relay had
already gained encrypted account escrow. That export contained the old
"Signed in. Connecting to your encrypted workspace" peer-transfer flow and
the old onboarding design. Updating the marketing website did not update this
separate client.

Web now uses the same account-owned navigation and desktop data pages as the
mobile client, rather than the legacy session-only home. Account authentication
and workspace bootstrap remain separate; the current shared bootstrap restores
an escrowed key without an online peer. Old un-migrated keys still require the
matching original key and must never be replaced to bypass recovery.

Validation: app TypeScript checking passed; six shared-client bootstrap tests
and seven independent-relay workspace integration tests passed. The production
Expo Web export loads the KissOpen VI sign-in screen without console errors.
Existing route/animation warnings are unrelated to authentication.

Build settings keep both community account and relay origins at
`https://kissopen.com`, matching the installed clients. The UI is hosted at
`https://app.kissopen.com`; no account/credential migration is performed.

Hosted static release:
`/srv/kissopen-web/releases/20261007T100200Z-account-web`.
The relay package's existing `webapp` path points there. Only static assets
were changed; restarting the relay registers the newly hashed asset routes.
The account binary, database, master secrets, desktop update feed and marketing
site were not changed. Previous hashed assets are retained for already-open
tabs. The old Web directory is privately backed up under
`/var/backups/kissopen/20261007T100200Z-web-only/webapp`.

For rollback, stop the relay, move the new `webapp` symlink aside and restore
the backed-up directory to the exact package `webapp` path, then start the
relay. Do not restore databases or regenerate workspace keys for a UI rollback.
An actual user's fresh sign-in/device discovery is a separate acceptance check,
not implied by builds or anonymous HTTP checks.

Post-activation checks passed: public index SHA-256 matches the export, the new
hashed main bundle returns 200, `/v1/updates/?EIO=4&transport=polling` returns
200, and the workspace session endpoint rejects anonymous access with 401.
Both services remain active with zero automatic restarts. The accounts process
was not restarted; marketing Nginx configuration and desktop feed hashes are
unchanged. A browser reload shows the new sign-in UI with no console errors.
NodeLoc requires the user's sign-in, so real-account workspace discovery remains
pending user verification.

The user subsequently confirmed hosted Web sign-in/workspace connection works.

## Remove the Web sign-in server-settings entry

The user requested removing the legacy custom-server entry from the official
Web sign-in page. The community welcome screen now renders that button only
on native platforms. The `/server` route and native self-host configuration
remain available; this change removes the entry, not the feature or user data.
Account and relay origins remain unchanged. App typechecking and a fresh
production Web export pass.

Static release: `/srv/kissopen-web/releases/20261007-no-server-entry`.
Previous pointer: `/srv/kissopen-web/releases/20261007T100200Z-account-web`;
its backup symlink is under
`/var/backups/kissopen/20261007-no-server-entry/webapp`.
Only the static pointer and relay asset registration are refreshed. Account
service, native packages, databases, keys and marketing site are unchanged.

Public export hash and socket endpoint checks passed after activation. A fresh
browser sign-in page contains zero Server buttons, retains password and NodeLoc
sign-in, and has no console errors. The account service process was unchanged.
