# Dedicated download page — 2026-10-07

The user requested a separate official download page. Published at `https://kissopen.com/download/` and the five localized routes, including `https://kissopen.com/zh-cn/download/`. `/en/download/` is an English compatibility alias; `/downloads/` redirects to `/download/`. Versioned package URLs under `/downloads/desktop/stable/` and `/downloads/android/stable/` are unchanged.

Homepage navigation, hero, getting-started section and footer now link directly to the download page. The previous download dialog was removed. The page shows Windows, Apple Silicon/Intel macOS, Android, Web access and iOS availability, with versions, verified sizes, signing information and expandable SHA-256 checksums. It retains all six languages and the site's appearance preference. The language selector stays on the download page; download links and checksum details work without JavaScript.

Static release: `/var/www/kissopen-site/releases/20261007T143215Z-download-page`. Previous release: `/var/www/kissopen-site/releases/20261007T140200Z-windows-android`. Private backup: `/var/backups/kissopen/20261007T143215Z-download-page`.

Validation: existing locale checks passed; all six download pages were checked at 390px width without horizontal overflow; language switching, checksum expansion and light/dark appearance worked. Browser console error checks were empty. Public HTML/CSS/JS hashes match the local build, redirects returned 308, and all four installer links returned 200 with the expected content lengths. The live homepage-to-download navigation was verified in the browser. Server activation checked Nginx configuration, website checksums, and unchanged Windows/Android package and macOS/Windows update-manifest hashes. Backend start times, active states and restart counts stayed unchanged.

Local verification and screenshot files are in `.build-artifacts/download-page-20261007/`. The signing keys and SSH credentials were not included in the static artifact. No Git push or backend restart was performed.

Rollback: restore the backup's `root.conf` to `/etc/nginx/sites-available/kissopen`, atomically repoint `/var/www/kissopen-site/current` to the previous static release, then run `nginx -t` and reload Nginx. No package, database or credential changes are needed.
