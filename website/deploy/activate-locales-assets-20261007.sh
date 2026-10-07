#!/usr/bin/env bash
# Follow-up static-only activation: content-versioned CSS/JS references.
set -euo pipefail
staging=/var/lib/kissopen-release-staging/locales-20261007
release=/var/www/kissopen-site/releases/20261007-six-locales-v2
previous=/var/www/kissopen-site/releases/20261007-six-locales
current=/var/www/kissopen-site/current
backup=/var/backups/kissopen/20261007-six-locales-v2
test "$(sha256sum /etc/nginx/sites-available/kissopen | cut -d' ' -f1)" = 0b53f6df609d390c774fd725cdff0c9fcbcd21d921bcda32de17bd704494e422
test "$(readlink -f "$current")" = "$previous"
test ! -e "$release"
test ! -e "$backup"
test ! -e /var/www/kissopen-site/current-locales-assets-next
mkdir -p "$release"
tar -xzf "$staging/site-v2.tar.gz" -C "$release" --no-same-owner
(cd "$release" && sha256sum -c SITE-SHA256SUMS)
mkdir -m 700 "$backup"
printf '%s\n' "$previous" > "$backup/website-target"
cp -p /etc/nginx/sites-available/kissopen "$backup/root.conf"
systemctl show kissopen.service kissopen-accounts.service -p Id -p ActiveState -p NRestarts -p ActiveEnterTimestamp > "$backup/backend-status"
ln -s "$release" /var/www/kissopen-site/current-locales-assets-next
mv -Tf /var/www/kissopen-site/current-locales-assets-next "$current"
printf 'Activated versioned website assets; routing/services unchanged.\n'
