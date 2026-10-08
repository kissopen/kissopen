# Windows and Android downloads — 2026-10-07

User-authorized publication to the existing kissopen.com server at 45.128.210.49.

Published packages:

- Windows x64 0.3.0: `https://kissopen.com/downloads/desktop/stable/kissopen-0.3.0-x64.exe`, 243899082 bytes, SHA-256 `66c188583806d3c1e5c8000468caab109380441da0125bcfa44081115c9486d0`.
- Android 0.2.29 (versionCode 30): `https://kissopen.com/downloads/android/stable/kissopen-0.2.29-android-release.apk`, 95623170 bytes, SHA-256 `de5904caa2f0a90572c97e394d3aaa1a97309bdb6bf689f41c42cb306ae31a32`.
- Windows updater manifest: `/downloads/desktop/stable/latest.yml`; its SHA-512 and size refer to the published x64 installer. The EXE blockmap and per-file checksums are also served.

The Windows package is not code-signed. The Android package supports ARM64 and ARMv7 devices running Android 7.0 or later and is signed with the locally generated project release key. Certificate SHA-256: `4546d97b1a160a7ac9903a5939e3037de33f085d169e2dd651da915e3035fc1b`. The private keystore, passwords, SSH key, build logs, and local account data were excluded from the upload. Neither package was submitted to an app store.

## Activation

Release ID: `20261007T140200Z-windows-android`.

- Website release: `/var/www/kissopen-site/releases/20261007T140200Z-windows-android`.
- Previous website: `/var/www/kissopen-site/releases/20261007-six-locales-v2`.
- Website pointer: `/var/www/kissopen-site/current`.
- Windows versioned assets: `/srv/kissopen-desktop/releases/0.3.0`.
- Windows and existing macOS public assets: `/srv/kissopen-desktop/stable`.
- Android versioned assets: `/srv/kissopen-android/releases/0.2.29`.
- Android public assets: `/srv/kissopen-android/stable`.
- Private activation backup: `/var/backups/kissopen/20261007T140200Z-windows-android`.

The activation verified uploaded checksums and all website asset hashes before exposing links, preserved the macOS feed, added the Android static-download Nginx location, checked Nginx configuration, and reloaded Nginx. Both backend services remained active with identical start times and restart counts. A bounded origin retry handled an old Nginx worker returning one initial 404 immediately after reload; the new routing then passed with normal TLS verification.

All six language pages and the legacy English alias now contain working Windows and Android links and the correct release/signature details. The browser download dialog was checked visually. Local startup verification reached each application's sign-in screen; authenticated login and a physical Android device were not tested.

Public verification records are saved locally under `.build-artifacts/public-release-20261007/`: `activation.log`, `public-verification.json`, `public-verification.log`, and `website-downloads.png`. The public checks verify complete EXE/APK downloads, SHA-256, Windows SHA-512, website and manifest contents, the retained macOS feed, and HTTPS availability of the Web client.

## Rollback

Restore `root.conf` from the private activation backup to `/etc/nginx/sites-available/kissopen`. Atomically restore the website pointer to the previous website above, restore the backup's `desktop-SHA256SUMS` to the desktop stable checksum file, and move the newly published Windows `latest.yml` into the private backup. Run `nginx -t` and reload Nginx. Keep verified versioned assets for diagnosis. Do not restore databases or change account credentials. No backend restart, Git push, or running desktop application restart was performed.
