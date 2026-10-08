# CLI installers

The website serves `install.sh` at `https://kissopen.com/install` and `PKGBUILD`
at `https://kissopen.com/install/PKGBUILD`. Both install the published
`@kissopen/kissopen-terminal` package, whose executable is `kissopen`.

The shell installer requires Node.js 24+ and npm. It installs into `~/.local`
without sudo and reports the PATH adjustment when needed. It does not start or
restart an Agent.

The Arch package is built locally with `paru -Bi DIRECTORY` or `yay -Bi DIRECTORY`.
It is distributed from this website; it is not registered in the AUR. Updates
require downloading the current PKGBUILD and running the same installation steps.

Homebrew uses the root `Formula/kissopen.rb` through:

```sh
brew tap kissopen/cli https://github.com/kissopen/kissopen
brew install kissopen/cli/kissopen
```

For a CLI update, publish npm first, then update the installer version,
PKGBUILD version and SHA-256, and Homebrew URL and SHA-256 from that exact npm
tarball. Verify `kissopen --version` and `kissopen --help` before deploying.
Build the website with `node website/scripts/build.mjs`.

The CLI requires Node.js 24+. Standalone Agent auto-download currently supports
Windows x64 and Linux x64 / ARM64; the macOS Agent release is still pending.
