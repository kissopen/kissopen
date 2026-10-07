# Requested previews

Release requests default to preview; production must be explicit. An agent chooses
an unused `X.Y.Z-preview.N` version from release history and writes user-facing
Markdown notes covering every included commit. Do not ask the person to type a
version. Merging to `main` no longer deploys the hosted renderer; all previews
are explicitly requested.

For Agent/native versions, inspect GitHub releases and tags. Renderer previews
have no release tag: inspect `gh run list --workflow local-web-pages.yml`; run
names contain their versions and successful deployments identify what shipped.

| Request                  | Dispatch from `main`                                                                  | Delivery                                                      |
| ------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Kissopen Agent preview      | Agent repository's `release-kissopen-agent.yml`: version, release_notes, prerelease=true | Agent binaries for Nightly                                    |
| Desktop native preview   | `desktop-release.yml`: version, release_notes, prerelease=true                        | Signed arm64/x64 Nightly apps and updater manifests           |
| Desktop renderer preview | `local-web-pages.yml`: version, release_notes                                         | Hosted renderer at `https://local.app.happy.engineering` only |

Each workflow validates and builds the requested source, then publishes in the same
run. No prepare/publish coordinator, bump-after-build commit, or artifact promotion
is needed. Preview versions are embedded without changing source manifests. Native
previews keep signing, notarization, verification, and checksum manifests; they do
not replace GitHub's latest stable release. Existing release tags/assets must not
be overwritten. Renderer metadata contains the version and full source SHA; notes
and identity are recorded in the workflow summary. A renderer request never ships
a native app or switches the Agent binary.

Use `gh workflow run ... --ref main` with `-f version=<chosen-version>` and
`-F release_notes=@.context/release-notes.md` (the `@` reads the file contents).
For Agent/native previews also pass `-F prerelease=true`; renderer has no such input.
Watch with `gh run watch`, and read back the
release notes, version, and assets before reporting success. For renderer previews,
verify Pages succeeded and the deployed `local-web-version.json` matches the build.
Do not create native release tags locally, push, restart an app, or deploy merely
because release tooling was changed.

Production needs no prior preview. Native production uses the same workflow with
`prerelease=false` and stable `X.Y.Z`, shipping both app flavors on macOS and Windows.
Windows installers remain unsigned and retain their installed-app and Agent checks;
native previews currently ship macOS Nightly only. Preserve the existing
requirement that root and Electron manifests match that stable version: update them
before dispatch under normal Git authorization. Standard bundles its renderer, so
production renderer delivery requires explicit native-release scope.

Nightly accepts supported stable and numbered preview Agent/native versions;
standard offers stable updates only. Existing Agent activation/drain controls,
native install-on-quit/install action, and compatibility guards remain unchanged.
Ship an initial stable native update so older Nightly hosts gain preview support;
a hosted renderer refresh cannot update Electron host code.

## Local macOS credentials

The macOS build script also supports notarization credentials stored by Apple's
`notarytool` in a local keychain. Set `APPLE_KEYCHAIN` to that keychain's path and
`APPLE_KEYCHAIN_PROFILE` to the stored profile name. The script verifies the
profile against Apple's service before beginning the build; the builder then
uses the same profile to notarize the app. Signing still requires a valid
Developer ID Application identity, and all packaged-app verification remains
mandatory.

Do not place app-specific passwords, signing private keys, or exported
certificates with private keys in source files. Local keychain setup does not
configure GitHub Actions: CI still needs its own explicitly authorized secrets.
Preparing credentials does not authorize a release, deployment, or restart.

## Homebrew and Linux

The standard desktop app is also distributed through `slopus/homebrew-tap`:

```sh
brew install --cask slopus/tap/kissopen
```

Stable native releases additionally build standard Linux x64 and arm64 AppImages
on native Ubuntu runners. `build-linux.yml` boots each actual AppImage with a
disposable profile and asserts that its packaged Electron renderer reaches the
welcome screen, saving a screenshot. Publishing is gated on both checks. Linux
Nightly and native Linux auto-updates are not shipped; use Homebrew to upgrade
Linux installations. Preview behavior and all macOS signing and Windows checks
remain unchanged.

The tap's scheduled/manual update workflow reads the latest stable GitHub release,
pins each artifact's SHA-256, and tests Homebrew installation, packaged app boot,
and uninstall on every supported OS/architecture before committing the new cask.
It uses only the tap's own workflow token, with no cross-repository secret. To
update the tap immediately after a stable release:

```sh
gh workflow run update-kissopen.yml --repo slopus/homebrew-tap --ref main
```

Check that workflow and the resulting cask version before reporting Homebrew
distribution complete. Never disable Gatekeeper or remove quarantine to make a
cask pass. Linux CI's Chromium sandbox override is test-runner-only, not part of
the cask or shipped app.
