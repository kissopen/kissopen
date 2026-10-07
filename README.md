# KissOpen

An open-source workspace for your own AI Agent, on desktop, phone and the web.
Bring your models, keep execution on your computer, and pick up the same work
from another device.

[Website](https://kissopen.com) · [Web app](https://app.kissopen.com) ·
[简体中文](README.zh-CN.md) · [Agent](https://github.com/kissopen/kissopen-agent) ·
[Server](https://github.com/kissopen/kissopen-server)

## Features

- Desktop client with conversations, projects, files and an integrated browser.
- Mobile/Web client connected to your desktop Agent through an account relay.
- Custom providers: API URL + API key, model discovery and model selection.
- Custom themes, local-model theme generation and an account-backed theme gallery.
- Local plugin installation, enable/disable and removal.
- Natural-language scheduled tasks, saved and executed by the local Agent.
- Username/password, optional 2FA and configurable GitHub/Google/NodeLoc OAuth.

Your configured providers handle model inference. The local Agent owns tool
execution, plugins and scheduled tasks.

## Repositories

| Repository | Contents |
| --- | --- |
| **kissopen** (this repository) | Desktop, mobile/Web, shared client sync, brand and website |
| [kissopen-agent](https://github.com/kissopen/kissopen-agent) | Agent daemon, SDK, providers, tools, terminal and local scheduler |
| [kissopen-server](https://github.com/kissopen/kissopen-server) | OAuth/accounts, encrypted relay, device RPC, profiles, themes and plugin catalog |

The three repositories are maintained independently, connected through the
Agent SDK and shared client/server protocols.

## Development

Use Node 24+ and the pnpm version specified by each workspace. Native mobile
builds additionally require Xcode or the Android toolchain.

```sh
git clone https://github.com/kissopen/kissopen.git
cd kissopen
pnpm --dir kissopen install --frozen-lockfile
pnpm --dir kissopen-desktop install --frozen-lockfile
```

### Mobile and Web

```sh
pnpm --dir kissopen --filter kissopen-app start
# Or run the web development client:
pnpm --dir kissopen web
```

The account/relay service is a separate deployment. Follow the
[server self-hosting guide](https://github.com/kissopen/kissopen-server/blob/main/docs/self-hosting.md)
for private configuration. Never commit OAuth secrets or workspace master keys.
Remote access to desktop files and tasks requires the desktop Agent to be online.

### Desktop and the Agent artifact boundary

Desktop depends on the versioned SDK archive in `kissopen-desktop/vendor/agent/`.
It does not import a sibling Agent source tree. The SDK and binary versions and
checksums are pinned in `agent-artifacts.lock.json`.

Agent executables are deliberately not committed to Git. Build the corresponding
Agent version in its own repository, export its product artifact set, then import
that set using the SHA-256 of its manifest obtained from your trusted build:

```sh
pnpm agent:import /path/to/product-artifacts TRUSTED_MANIFEST_SHA256
pnpm --dir kissopen-desktop install
pnpm desktop
```

The artifact importer verifies the complete set before updating the pin. It does
not silently download or trust an arbitrary executable. A new artifact version
changes the pin and lockfile and must be reviewed together. macOS packaging uses
the existing signing/notarization gates; a source push is not a binary release.

When building Electron directly, use the TypeScript loader required by the
source-based shared packages:

```sh
cd kissopen-desktop
NODE_OPTIONS=--import=tsx pnpm --dir packages/kissopen-desktop-electron build
```

### Website

```sh
pnpm --dir website dev
pnpm --dir website build
```

The website supports English, Simplified/Traditional Chinese, Japanese, Korean
and Russian. No production deployment happens during these commands.

## Status and security

This is an initial public source snapshot under active development, not a claim
that all release/security gates have passed. Dependency audit findings remain;
run `pnpm audit --prod` in each workspace before deployment. Inherited documents
and nested release workflows may describe upstream behavior, not configured
KissOpen publication pipelines. Do not execute them against production blindly.

Workspace keys may be encrypted and escrowed by the account server. The server
can recover those keys: do not describe this mode as server-blind end-to-end
encryption. See [Security](SECURITY.md) and [Contributing](CONTRIBUTING.md).
The [publication verification record](PUBLICATION.md) lists the checks and
outstanding dependency advisories for this snapshot.

## License and attribution

KissOpen additions are MIT licensed. Original Happy Desktop/Happy Coder copyright
notices and third-party licenses are preserved; see [NOTICE](NOTICE.md) and the
package-level licenses. Independently distributed plugins retain their own licenses.
