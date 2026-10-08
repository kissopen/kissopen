# GitHub source links — 2026-10-07

User-requested replacement of Source entries with GitHub icons and direct links to `https://github.com/kissopen/kissopen`. Homepage and download-page headers use an icon-only accessible link; the homepage contribution section, footer and mobile navigation use the GitHub icon with text. All six language versions now describe the public repository and contribution entry points. The source dialog was removed.

Static release: `/var/www/kissopen-site/releases/20261007-github-links`. Previous release: `/var/www/kissopen-site/releases/20261007T143215Z-download-page`. Private pointer backup: `/var/backups/kissopen/20261007-github-links/website-target`. Activation changed only the website pointer; Nginx routing, update manifests and backend service states stayed unchanged.

Locale checks passed. All public homepage and download-page HTML, CSS and JavaScript matched local build hashes. Browser checks verified visible GitHub marks, exact repository targets, new-tab links and absence of console errors. Local logs and screenshots are in `.build-artifacts/github-links-20261007/`. No Git push or service restart was performed.

Rollback by atomically restoring `/var/www/kissopen-site/current` to the previous static release above. No Nginx reload, package or database change is needed.
