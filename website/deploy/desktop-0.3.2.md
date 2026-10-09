# macOS Desktop 0.3.2 — 2026-10-09

Published Apple Silicon and Intel macOS Desktop 0.3.2, bundling Agent 0.4.73. The desktop refreshes the shared Agent installation state after reconnecting and finishes disabled online Agent checks with an explicit explanation. The Agent menu bar uses the KissOpen logo and offers Open KissOpen and Quit Menu Bar; quitting the helper leaves the Agent and sessions running.

Source commits: desktop runtime fix `ea8f24a`, desktop version/artifact pin `20c617e`, download catalog `760a582`; Agent menu bar change `66c6002`. Agent 0.4.73 was published through its release workflow, with locally signed and notarized macOS binaries added to the resulting stable release. Desktop 0.3.2 was built locally with the existing signed release script.

Formal releases:

- https://github.com/kissopen/kissopen/releases/tag/desktop-v0.3.2
- https://github.com/kissopen/kissopen-agent/releases/tag/v0.4.73

The desktop release includes the existing Windows 0.3.0 and Android 0.2.29 installers. Their bytes and signing status are unchanged. Website download links and the complete macOS update manifest now advertise 0.3.2 at https://kissopen.com/download/ and https://kissopen.com/downloads/desktop/stable/latest-mac.yml.

Both Mac architectures passed Developer ID signature verification, Apple notarization, stapling, Gatekeeper assessment, DMG checksums, packaged ZIP SDK loading using the corresponding Electron runtime, and bundled Agent version checks. Agent validation passed 5,103 Vitest tests and three node:test tests; 54 optional/platform tests were skipped. The existing Supervisor test-runner issue requires running its node:test script separately from Vitest. The desktop runtime changes passed its 150 existing tests, with one skipped; its pre-existing React boundary check failures remain in unchanged files.

Server activation verified the previous website and package hashes, published immutable versioned files, and atomically switched the website and macOS update metadata. Command-line 0.3.8 installation files and checksums, Windows update metadata, and Windows/Android packages were preserved. Backend service start times and restart counts were unchanged.

Public verification read back all ten macOS publication files and checked their SHA-256 values, matched all fourteen website HTML pages against the deployed snapshot, checked the three command-line installer hashes, and confirmed the existing Windows/Android download sizes and published checksums. Both GitHub releases are stable, published, and latest in their respective repositories; their asset digests and source tags were verified.

Server release: `/srv/kissopen-desktop/releases/0.3.2`. Website: `/var/www/kissopen-site/releases/20261009-macos-032`. Previous website: `/var/www/kissopen-site/releases/20261008-cli038`. Backup: `/var/backups/kissopen/20261009-macos-032`. No credentials were included in release assets or this repository.

Rollback: atomically restore the backup's `latest-mac.yml`, `SHA256SUMS` and `RELEASE-NOTES.md` into `/srv/kissopen-desktop/stable`, then atomically repoint `/var/www/kissopen-site/current` to the previous website. Preserve immutable versioned packages. No backend restart or database change is required.

Local build, notarization, publication and verification receipts are under `.local/agent-stable-macos-0.4.73/` and `.local/desktop-0.3.2-*`.
