# Contributing

Use GitHub issues for reproducible bugs and pull requests for focused changes.
Do not include API keys, passwords, recovery codes, user conversations, or real
workspace data in issues, screenshots, logs, fixtures, or commits.

The client, Agent, and server have separate repositories. Place runtime/model
changes in `kissopen-agent`, relay/account changes in `kissopen-server`, and
client UI changes here. Preserve third-party attribution and follow the
`AGENTS.md` instructions in the directory you change.

Before submitting, run the relevant package's typecheck/build and existing
checks. Explain known failures rather than hiding them. Do not run inherited
release workflows, publish packages, or deploy a server as part of a normal PR.
