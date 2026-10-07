# KissOpen 0.3.0 — macOS

First stable KissOpen desktop distribution for Apple Silicon and Intel.

- Uses the independent KissOpen account and device services.
- Runs the bundled local Agent with your own model providers, including custom API URL/key providers and model selection.
- Includes projects, conversations, files, custom themes, local plugins and local scheduled tasks. Home and project dashboards are not included.
- Signed desktop updates use only `https://kissopen.com/downloads/desktop/stable/latest-mac.yml`. Updates download in the background and require the user's install action. Development and preview builds do not check this feed.
- Mobile can connect to the signed-in desktop through the independent service. This release does not publish or submit an iOS/Android package.

Desktop version: **0.3.0**. Bundled Agent: **0.4.71-preview.8**, pinned by the independent artifact manifest; this is not a separate Agent release.

## Verification and activation

User-authorized local signing/notarization is used because this extracted repository has no release workflow yet. Public source publication is separate and remains pending; no commercial Git history or unreviewed repository snapshot is published with these installers.

The native release script checks Developer ID signing, Apple notarization/stapling, Gatekeeper, DMG integrity, application identity/version, bundled Agent architecture/SHA-256, original desktop license and the independent updater origin/channel. The build must finish successfully before any assets or website links are activated.

Public assets are immutable version-named DMG/ZIP files, optional builder blockmaps, SHA-256 checksums, this release note and `latest-mac.yml`. Builder debug output, app-data, credentials and source snapshots are not uploaded.

The one-time `activate-desktop-030.sh` checks uploaded asset and website checksums, backs up the previous Nginx routing privately, activates the physical stable download directory and website, then reloads Nginx. Account and relay services are not restarted. Old local preview packages and existing service data are retained.

Before activation, the target server must still have the exact website/configuration captured in that script. If its preconditions fail, inspect the new state rather than bypassing the checks.

## Paths and rollback

- Versioned assets: `/srv/kissopen-desktop/releases/0.3.0`.
- Public stable directory: `/srv/kissopen-desktop/stable`.
- Website release: `/var/www/kissopen-site/releases/20261007-desktop-030`.
- Private routing backup: `/var/backups/kissopen/20261007-desktop-030`.

To roll back routing, restore the backup's `root.conf` to `/etc/nginx/sites-available/kissopen`, restore the website symlink to `/var/www/kissopen-site/releases/20261006T161200Z`, run `nginx -t` and reload Nginx. Keep versioned assets for diagnosis; do not restore databases or change account secrets.

## Completed verification — 2026-10-07

The signed dual-architecture build completed successfully. Build log:
`/tmp/kissopen-030-mac-release-verified.log`.

Apple accepted both submissions:

- arm64: `29f06460-6f62-401b-80a9-f35abb2b65f1`.
- x64: `7a8be040-e138-4b25-9cb9-0e692c03f3df`.

Each actual ZIP was extracted and each DMG mounted read-only. Both contained
version 0.3.0, passed strict deep signing checks, had valid stapled app tickets
and were accepted by Gatekeeper as Notarized Developer ID. Both Electron
binaries ran in Node mode (x64 through Rosetta), and both bundled Agents
returned their pinned version. Main source receipts and package private-file
checks passed. Temporary verification copies were removed; no user data was
cleared or migrated.

The desktop typecheck and touched-file formatting passed. Existing Electron
tests: 150 passed, 1 skipped. React boundary checking still reports 50 inherited
renderer violations; these were not changed by this release.

Server asset SHA-256 checks passed before activation. Nginx validation and
reload succeeded. The live Chinese and English pages and independent update
manifest matched local hashes. All four installers/update archives were
downloaded in full through public HTTPS and matched their expected SHA-256.
Manifest file sizes/SHA-512 and the actual updater's arm64/x64 selection were
also verified. Browser checks confirmed both language download dialogs and
reported no page console errors.

Account and relay services stayed active with unchanged start times and zero
automatic restarts. The existing Web client still returned HTTPS 200. No Git
commit/push, public source upload, mobile publication, installation or restart
of the running development desktop was performed.

Published manifest: `https://kissopen.com/downloads/desktop/stable/latest-mac.yml`.
Published checksums: `https://kissopen.com/downloads/desktop/stable/SHA256SUMS`.
