#!/usr/bin/env bash
# One-time activation. Upload only verified public assets before running this.
set -euo pipefail
release=/srv/kissopen-desktop/releases/0.3.0
incoming=/srv/kissopen-desktop/staging/0.3.0-20261007
site=/var/www/kissopen-site/releases/20261007-desktop-030
backup=/var/backups/kissopen/20261007-desktop-030
config=/etc/nginx/sites-available/kissopen
stable=/srv/kissopen-desktop/stable
prepared=/var/lib/kissopen-release-staging/desktop-030

test ! -e "$release"
test ! -e "$stable"
test ! -e "$backup"
test -d "$incoming"
test -d "$site"
test -s "$prepared/root.conf"
test "$(sha256sum "$config" | cut -d ' ' -f 1)" = dbb59b8827ae991173f6364750d63e4b3c842c7319a666672c4bb477cd48baf4
test "$(readlink -f /var/www/kissopen-site/current)" = /var/www/kissopen-site/releases/20261006T161200Z
(cd "$incoming" && sha256sum -c SHA256SUMS)
grep -qx 'version: 0.3.0' "$incoming/latest-mac.yml"
for arch in arm64 x64; do
    test -s "$incoming/kissopen-0.3.0-$arch.dmg"
    test -s "$incoming/kissopen-0.3.0-$arch.zip"
done
(cd "$site" && sha256sum -c SITE-SHA256SUMS)

mkdir -p /srv/kissopen-desktop/releases
mkdir -m 700 "$backup"
cp -p "$config" "$backup/root.conf"
readlink /var/www/kissopen-site/current > "$backup/previous-site"

rollback() {
    trap - ERR
    cp -p "$backup/root.conf" "$config"
    ln -s /var/www/kissopen-site/releases/20261006T161200Z /var/www/kissopen-site/rollback-desktop-030
    mv -Tf /var/www/kissopen-site/rollback-desktop-030 /var/www/kissopen-site/current
    if test -d "$stable"; then mv "$stable" "$backup/unpublished-stable"; fi
    nginx -t && systemctl reload nginx
    echo 'Activation failed; previous website and routing restored.' >&2
}
trap rollback ERR

mv "$incoming" "$release"
cp -al "$release" /srv/kissopen-desktop/stable-desktop-030
mv /srv/kissopen-desktop/stable-desktop-030 "$stable"
install -m 644 "$prepared/root.conf" "$config"
nginx -t
ln -s "$site" /var/www/kissopen-site/current-desktop-030
mv -Tf /var/www/kissopen-site/current-desktop-030 /var/www/kissopen-site/current
systemctl reload nginx
trap - ERR
echo 'KissOpen 0.3.0 desktop assets and website activated; backend services unchanged.'
