# Security

Never post credentials, workspace keys, recovery codes, or private user data in
a public issue. Use GitHub's private vulnerability reporting feature when it is
available, or contact a repository maintainer privately before sharing details.

The source is under active development. Source/secret scans are not a complete
security audit. Dependency advisories and reproducible-build limitations must
be reviewed before operating a public service.

Account workspace keys can be encrypted and escrowed by a self-hosted server.
That server can recover the keys; this is not server-blind end-to-end encryption.
Back up the database and escrow master key separately, protect OAuth secrets,
and use HTTPS. Remote phone/Web access requires the desktop Agent to be online.
