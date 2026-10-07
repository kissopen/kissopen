<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="/.github/logotype-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="/.github/logotype-light.png">
  <img src="/.github/logotype-dark.png" width="400" height="106" alt="Kissopen">
</picture>

<h3>Any team. Any model. One harness.</h3>

<p>
  Kissopen integrates models, teams, and compute into one secure, open-source
  harness — accessible from terminal, desktop, and mobile, deployable
  anywhere, and adaptable to your team.
</p>

[🖥️ **Download for macOS**](https://github.com/slopus/happy-desktop/releases/latest) • [📱 **iOS App**](https://apps.apple.com/us/app/kissopen-claude-code-client/id6748571505) • [🤖 **Android App**](https://play.google.com/store/apps/details?id=com.ex3ndr.kissopen) • [📚 **Documentation**](https://happy.engineering/docs/) • [💬 **Discord**](https://discord.gg/fX9WBAhyfD)

</div>

https://github.com/user-attachments/assets/d193098c-4c60-440b-b91e-274a76d923d5

<h3 align="center">
Step 1: Download the desktop app
</h3>

<p align="center">
<a href="https://github.com/slopus/happy-desktop/releases/latest"><b>⬇️&nbsp;&nbsp;Download Kissopen for macOS</b></a>
</p>

<p align="center">
Open it — setup runs itself.
</p>

Or install through our [Homebrew tap](https://github.com/slopus/homebrew-tap):

```sh
brew install --cask slopus/tap/kissopen
```

The cask selects the native macOS build, or a Linux AppImage on x64/arm64 for
releases that include Linux. On Linux, launch with `kissopen-desktop`; a graphical
session and FUSE support are required. Upgrade with
`brew upgrade --cask slopus/tap/kissopen`.

<h3 align="center">
Step 2: Connect your phone
</h3>

<p align="center">
<a href="https://apps.apple.com/us/app/kissopen-claude-code-client/id6748571505"><img width="135" height="39" alt="appstore" src="https://github.com/user-attachments/assets/45e31a11-cf6b-40a2-a083-6dc8d1f01291" /></a>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a href="https://play.google.com/store/apps/details?id=com.ex3ndr.kissopen"><img width="135" height="39" alt="googleplay" src="https://github.com/user-attachments/assets/acbba639-858f-4c74-85c7-92a4096efbf5" /></a>
</p>

<p align="center">
Scan the QR code in the desktop app — your sessions follow you everywhere.
</p>

<h3 align="center">
Step 3: Start coding
</h3>

<p align="center">
Open a project and ask for what you want. Invite your team when you want company.
</p>

## 🔥 Why Kissopen

Serious work with coding agents outgrows a terminal tab fast. Sessions die
with the window that held them. Every vendor's agent lives in its own app
with its own tools, its own permissions, and its own idea of a session, so
switching models means abandoning context. Your teammates can't see what
your agent is doing, let alone step in. And the moment the work matters,
someone asks where the code is going and who can read it.

Kissopen exists to remove those walls. One harness runs every agent you already
pay for, keeps every session alive and durable, lets your whole team work
inside the same conversation, and never ships your work anywhere you didn't
point it. This repository is the macOS app — the place where that harness
becomes a full working environment: conversations beside the files, diffs,
terminals, and previews the work actually touches.

## 👥 Natively multiplayer

An agent session shouldn't be a private transcript. Bring your team into one
session with every agent: anyone can share context, steer the conversation,
approve decisions, and take over in real time. Start a task at your desk,
check it from your phone, hand it to a teammate — it's the same session, the
same permission boundary, the same history, on every device.

## 🤖 One harness. Every agent.

The best model for planning isn't the best model for building or reviewing,
and you shouldn't have to abandon your context to switch. Let Claude plan,
Codex build, and Grok review — or run them side by side and compare. Each
model still gets its native prompts and tools, so nothing is dumbed down to
a lowest common denominator, but the session, the permissions, and the
context stay together across every handoff. Kissopen adds no account of its
own; it uses the sign-ins already on your machine.

## 🔧 Yours to run. Yours to change.

A tool this close to your code has to answer to you, not to a vendor's
roadmap. Kissopen is open source end to end: run it on your hardware, in your
cloud, or in ours, and change it to fit how your team actually works. Kissopen
adopts itself to build itself — the pressure of daily use is the product
roadmap.

## 🔐 Secure and compliant

You can't bring an agent into real work if you can't say where the data
goes. With Kissopen the answer is short: nowhere you didn't send it. No
telemetry, no hosted account, no third-party servers by default. Your
projects stay ordinary directories on your machine, and everything that
travels between agents, teammates, and devices is end-to-end encrypted —
relays carry ciphertext they cannot read. That is what makes Kissopen safe to
run inside a corporate network: the only party that ever sees your prompts
is the model provider you chose, under its own terms.

## 🚀 How to use it

Download the desktop app and open it — that is the whole setup. Kissopen
downloads and starts its agent runtime on its own, finds the Claude, Codex,
and Grok sign-ins already on your machine, and asks you to point it at a
folder you work in. From there, just work: open a project, start a session,
and ask for what you want.

When you want company, invite people. Share a session with a teammate and
you are both inside the same conversation — steering, approving, and taking
over in real time — or grab the [mobile app](https://apps.apple.com/us/app/kissopen-claude-code-client/id6748571505)
and take your own sessions with you.

## 🧭 How you work in it

- **Projects, workspaces, and sessions.** Navigate everything the daemon knows
  about, start new sessions where the work belongs, and keep parallel efforts
  organized instead of scattered across terminal tabs.
- **Durable, streaming conversations.** Watch an agent think and act in real
  time; the transcript is a permanent record, not a scrollback buffer.
- **Files, diffs, and editing.** See what changed, review diffs, open and edit
  files, and preview results without leaving the app.
- **Terminals.** Real terminals attached to the machine doing the work.
- **Browser and HTML preview.** Open web content and rendered HTML inside
  Kissopen instead of bouncing to an external browser.
  Workspace service browsing keeps Chromium on your machine and sends only a
  selected service's traffic through its owning Kissopen Agent connection. Ask the
  agent to start a remote server with `service_start`, then open `http://localhost:PORT`
  in that remote workspace. In local workspaces, ordinary localhost URLs stay direct
  and do not require the service API or a registered service. An exact sandboxed
  service, local or remote, can be opened as
  `http://service-SERVICE_ID.localhost`; the browser switches to a private,
  workspace-specific origin. Ordinary internet traffic stays direct. This does
  not expose ordinary shell listeners or create a public sharing link. The first
  service release requires the updated Nightly native host and Agent preview,
  and the service host must support strict Linux sandboxing and delegated
  resource controllers. Cross-origin pages and redirects cannot silently gain
  access to a private service. Private pages currently use plain HTTP under
  `.kissopen.invalid`; secure-context-only browser features are not enabled. A dev
  server with a Host allowlist must allow this private suffix (for Vite,
  `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=.kissopen.invalid`).
- **Models, providers, and usage.** Choose models and effort per session, and
  see what your work is costing as it happens.
- **Notes and visibility.** Keep notes alongside the work, and see what agents
  and their processes are doing at any moment.

## 🏠 Who We Are

We're engineers scattered across Bay Area coffee shops and hacker houses,
constantly checking how our AI coding agents are progressing on our pet
projects during lunch breaks. Kissopen was born from the frustration of not
being able to peek at our AI coding tools building our side hustles while
we're away from our keyboards. We believe the best tools come from
scratching your own itch and sharing with the community.

## 📚 Documentation & Contributing

- **[Documentation Website](https://happy.engineering/docs/)** - Learn how to use Kissopen effectively
- **[Development Guide](DEVELOPMENT.md)** - Repository setup, browser mode, profiling, and validation
- **[Discord](https://discord.gg/fX9WBAhyfD)** - Ask questions and share what you build

## License

MIT License - see [LICENSE](LICENSE) for details.
