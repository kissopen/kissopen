# Website / Web-client domain split — 2026-10-06

User-authorized deployment to the existing server at 45.128.210.49.

- Website: https://kissopen.com/; English: https://kissopen.com/en/.
- Web client: https://app.kissopen.com/.
- Static release: `/var/www/kissopen-site/releases/20261006T161200Z`.
- Website symlink: `/var/www/kissopen-site/current`.
- Nginx configs: `/etc/nginx/sites-available/kissopen` and `kissopen-app`.
- Certificate: `/etc/letsencrypt/live/app.kissopen.com/`, with certbot automatic renewal.
- Account origin permission: `/etc/systemd/system/kissopen-accounts.service.d/70-web-client-origin.conf` allows only the new HTTPS client origin in addition to the existing public origin.

Root website routes and its known static assets are served directly. Existing API, OAuth, WebSocket, plugin-download, and legacy deep-route proxying remains. The new client host serves the existing client export and services. Account identities, workspace encryption keys, service environment files, provider configuration, and databases were preserved. The relay service was not restarted. The account service was restarted to load the added client-origin permission.

## Validation

Public HTTPS homepage and English page, website assets, client HTML and its three JS bundles returned 200. NodeLoc availability remained configured. Account preflight accepted `https://app.kissopen.com` and rejected an unrelated origin with 403. Relay Engine.IO polling and a real public WSS Engine.IO handshake both succeeded. Origin TLS certificate hostname and chain verification returned 0 (OK). Nginx config validation passed; both backend services remained active with zero automatic restarts. Original service environment/secret file hashes matched their pre-deployment values.

Browser checks verified the real website and the client login screen with the NodeLoc button enabled. Real user sign-in and encrypted workspace restoration require the user to sign in on the new browser origin; browser local storage is isolated by domain.

The first activation rolled back because a probe hit an old Nginx worker immediately after reload and received the old host's certificate. The new certificate itself had the correct subject/SAN. The subsequent activation used bounded retries with full TLS verification and passed after the new configuration became active. No certificate-validation bypass was used.

## Backup and rollback

First attempt backup: `/var/backups/kissopen/20261006T161200Z-website`.
Successful activation backup: `/var/backups/kissopen/20261006T162000Z-website-retry`.
Private backups contain the previous root routing, ACME bootstrap config, and configuration hashes. They are not served by Nginx.

To restore the previous root Web-client routing, restore `root.conf` from the successful backup to `/etc/nginx/sites-available/kissopen`, run `nginx -t`, then reload Nginx. The static release can remain for rollback. Retaining the new app host is safe; remove its account-origin override only if also retiring that host, then daemon-reload and restart the account service. Do not change service secrets or restore databases as part of this website rollback.

`activate-20261006.sh` records this one-time activation, including its resume preconditions. It is not a generic deployment script for later releases.
