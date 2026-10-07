# Initial source publication — 2026-10-07

The client, Agent and account/relay service are published as three independent
repositories under https://github.com/kissopen.

## Publication checks

- Reviewed the actual staged source export, not the full local working directory.
- Scoped the source export to maintained client packages. Kept superseded
  reference copies, private service configuration, signing material, local user
  data and packaged Agent executables outside the published source.
- Preserved the pinned SDK archive used by desktop and scanned its extracted files.
- Retained upstream MIT/Apache notices and added the missing Kimi Code license.
- Gitleaks 8.30.1 source scans passed after excluding Firebase configuration.
  Narrow allowlists cover only deterministic encryption test vectors, the RFC 6455
  example nonce, a migration name and a prose example. No real credential is allowed.
- Frozen-lockfile installs passed in clean exports of mobile, desktop, Agent and
  server. Install scripts were initially disabled, then the required patch/Prisma
  generation commands were run before the clean builds.
- Clean mobile typecheck, desktop renderer/main/preload build, Agent workspace
  build and server runtime/Go build passed. Server typecheck, 26 wire tests,
  151 server tests, Go tests and Go vet passed.
- Website build passed. No production service was deployed or restarted.

## Known limitations

This is source publication, not binary/npm publication or a completed security
certification. `releaseReady` remains false. The 2026-10-07 production dependency
audit reported the following affected dependency-path counts (not demonstrated
application exploits):

| Workspace | Critical | High | Moderate | Low |
| --- | ---: | ---: | ---: | ---: |
| Mobile/Web | 4 | 81 | 75 | 10 |
| Desktop | 1 | 6 | 4 | 0 |
| Agent | 1 | 21 | 29 | 5 |
| Server | 0 | 3 | 5 | 0 |

Audit counts include framework/tooling dependencies classified as production by
their manifests. Rerun `pnpm audit --prod` and assess reachability before running
an internet-facing deployment. Dependency remediation is a separate change; the
publication does not silently update runtime dependencies or restart installed apps.

The original formal release checklist, full dependency/license review, all-device
acceptance and disaster-recovery checks are not marked complete by this snapshot.
Inherited disconnected client helpers and nested upstream publication workflows
still exist; the README explains the supported repository/build boundaries.
