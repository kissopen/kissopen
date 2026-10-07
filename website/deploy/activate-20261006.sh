#!/usr/bin/env bash
set -Eeuo pipefail
# One-time deployment. No account data or relay state is migrated.
backup=/var/backups/kissopen/20261006T162000Z-website-retry
release=/var/www/kissopen-site/releases/20261006T161200Z
test ! -e "$backup"
test "$(readlink -f /var/www/kissopen-site/current)" = "$release"
test ! -e /etc/systemd/system/kissopen-accounts.service.d/70-web-client-origin.conf
test -s /etc/letsencrypt/live/app.kissopen.com/fullchain.pem
install -d -m 700 "$backup"
cp -a /etc/nginx/sites-available/kissopen "$backup/root.conf"
cp -a /etc/nginx/sites-available/kissopen-app-bootstrap "$backup/app-bootstrap.conf"
sha256sum /etc/kissopen/accounts.env /etc/kissopen/accounts.secret /etc/kissopen/server.env > "$backup/config.sha256"
rollback() {
    trap - ERR
    cp -a "$backup/root.conf" /etc/nginx/sites-available/kissopen
    ln -sfn /etc/nginx/sites-available/kissopen-app-bootstrap /etc/nginx/sites-enabled/kissopen-app
    if test -e /etc/systemd/system/kissopen-accounts.service.d/70-web-client-origin.conf; then
        mv /etc/systemd/system/kissopen-accounts.service.d/70-web-client-origin.conf "$backup/failed-origin.conf"
        systemctl daemon-reload
        systemctl restart kissopen-accounts
    fi
    nginx -t && systemctl reload nginx
    echo 'Activation failed; original root routing restored.' >&2
    exit 1
}
trap rollback ERR
test -s "$release/index.html"
test -s "$release/en/index.html"
install -d -m 755 /etc/systemd/system/kissopen-accounts.service.d
install -m 644 /tmp/accounts-origin.conf /etc/systemd/system/kissopen-accounts.service.d/70-web-client-origin.conf
systemctl daemon-reload
systemctl restart kissopen-accounts
systemctl is-active --quiet kissopen-accounts
install -m 644 /tmp/app.conf /etc/nginx/sites-available/kissopen-app
ln -sfn /etc/nginx/sites-available/kissopen-app /etc/nginx/sites-enabled/kissopen-app
nginx -t
systemctl reload nginx
curl --retry 5 --retry-all-errors --retry-delay 1 --max-time 15 -fsS --resolve app.kissopen.com:443:127.0.0.1 https://app.kissopen.com/ -o "$backup/app-index.html"
grep -q '<title>KissOpen</title>' "$backup/app-index.html"
curl -fsS --resolve app.kissopen.com:443:127.0.0.1 https://app.kissopen.com/v1/community/auth/providers -o "$backup/providers.json"
grep -q nodeloc "$backup/providers.json"
curl -fsS -X OPTIONS -H 'Origin: https://app.kissopen.com' -H 'Access-Control-Request-Method: GET' --resolve kissopen.com:443:127.0.0.1 https://kissopen.com/api/profile -D "$backup/cors.headers" -o /dev/null
grep -qi 'access-control-allow-origin: https://app.kissopen.com' "$backup/cors.headers"
install -m 644 /tmp/root.conf /etc/nginx/sites-available/kissopen
nginx -t
systemctl reload nginx
for attempt in 1 2 3 4 5; do
    curl -fsS --resolve kissopen.com:443:127.0.0.1 https://kissopen.com/ -o "$backup/site-index.html"
    if grep -q '开源 AI 工作空间' "$backup/site-index.html"; then break; fi
    sleep 1
done
grep -q '开源 AI 工作空间' "$backup/site-index.html"
curl -fsS --resolve kissopen.com:443:127.0.0.1 https://kissopen.com/en/ -o "$backup/site-en.html"
grep -q 'An open-source' "$backup/site-en.html"
curl -fsS --resolve kissopen.com:443:127.0.0.1 https://kissopen.com/v1/community/auth/providers -o "$backup/providers-after.json"
cmp "$backup/providers.json" "$backup/providers-after.json"
sha256sum -c "$backup/config.sha256"
systemctl is-active kissopen kissopen-accounts nginx
trap - ERR
echo 'Website and app origin activated; original service configuration files unchanged.'
