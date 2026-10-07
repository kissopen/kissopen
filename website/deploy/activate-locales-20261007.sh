#!/usr/bin/env bash
# One-time website-only activation. Do not reuse for later releases.
set -euo pipefail
staging=/var/lib/kissopen-release-staging/locales-20261007
release=/var/www/kissopen-site/releases/20261007-six-locales
previous=/var/www/kissopen-site/releases/20261007-desktop-030
backup=/var/backups/kissopen/20261007-six-locales
config=/etc/nginx/sites-available/kissopen
current=/var/www/kissopen-site/current
expected=d6a09814aff5c823549d105ccd9936528e75fb26a3ebf5ec223b35bee3ba080a

test "$(sha256sum "$config" | cut -d' ' -f1)" = "$expected"
test "$(readlink -f "$current")" = "$previous"
test ! -e "$release"
test ! -e "$backup"
test ! -e /var/www/kissopen-site/current-locales-next
test ! -e /var/www/kissopen-site/current-locales-rollback
test ! -e /etc/nginx/sites-available/kissopen.locales-next
mkdir -p "$release"
tar -xzf "$staging/site.tar.gz" -C "$release" --no-same-owner
(cd "$release" && sha256sum -c SITE-SHA256SUMS)
mkdir -m 700 "$backup"
cp -p "$config" "$backup/root.conf"
printf '%s\n' "$previous" > "$backup/website-target"
systemctl show kissopen.service kissopen-accounts.service -p Id -p ActiveState -p NRestarts -p ActiveEnterTimestamp > "$backup/backend-status"
sha256sum /srv/kissopen-desktop/stable/latest-mac.yml > "$backup/update-manifest-hash"

rollback() {
  cp -p "$backup/root.conf" "$config"
  ln -s "$previous" /var/www/kissopen-site/current-locales-rollback
  mv -Tf /var/www/kissopen-site/current-locales-rollback "$current"
  nginx -t && systemctl reload nginx
  printf 'Website activation failed; previous routing restored.\n' >&2
}
trap rollback ERR
install -m 644 "$staging/root.conf" /etc/nginx/sites-available/kissopen.locales-next
mv -Tf /etc/nginx/sites-available/kissopen.locales-next "$config"
nginx -t
ln -s "$release" /var/www/kissopen-site/current-locales-next
mv -Tf /var/www/kissopen-site/current-locales-next "$current"
systemctl reload nginx
sha256sum -c "$backup/update-manifest-hash"
systemctl is-active kissopen.service kissopen-accounts.service
trap - ERR
printf 'Activated six-language website; account/relay services were not restarted.\n'
