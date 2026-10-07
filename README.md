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

For account and relay setup, follow the
[server self-hosting guide](https://github.com/kissopen/kissopen-server/blob/main/docs/self-hosting.md).

### Desktop

Build and export the pinned Agent version in
[kissopen-agent](https://github.com/kissopen/kissopen-agent), then import the
artifact set using its manifest's SHA-256 and start the desktop client:

```sh
pnpm agent:import /path/to/product-artifacts TRUSTED_MANIFEST_SHA256
pnpm --dir kissopen-desktop install
pnpm desktop            # development build for this computer's platform
pnpm desktop:package    # installable package for this computer's platform
```

`pnpm desktop` uses the Agent binary for the computer you run it on. The
pinned Agent release in [`agent-artifacts.lock.json`](agent-artifacts.lock.json)
currently includes macOS (Apple Silicon and Intel) only. On Linux or Windows,
import an Agent release that includes your platform first; otherwise the
command stops with an error naming the missing target. macOS packaging signs
and notarizes, so it needs the Apple signing credentials.

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
and Russian.

## Contributing

Issues, ideas and pull requests are welcome. See the
[contribution guide](CONTRIBUTING.md) to get involved.

## License

[MIT](LICENSE) · [Third-party notices](NOTICE.md)
