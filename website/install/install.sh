#!/usr/bin/env bash
set -euo pipefail

# Install the same published CLI as npm, without requiring a system-wide write.
version=0.3.7
prefix="${KISSOPEN_INSTALL_PREFIX:-$HOME/.local}"
case "${1:-}" in
  --help|-h)
    printf 'Install KissOpen CLI %s (requires Node.js 24+ and npm).\n' "$version"
    printf 'Usage: curl -fsSL https://kissopen.com/install | bash\n'
    printf 'Optional: set KISSOPEN_INSTALL_PREFIX (default: $HOME/.local).\n'
    exit 0 ;;
  '') ;;
  *) printf 'Unknown argument: %s\n' "$1" >&2; exit 1 ;;
esac
case "$(uname -s)/$(uname -m)" in
  Linux/x86_64|Linux/aarch64|Linux/arm64|Darwin/x86_64|Darwin/arm64) ;;
  *) printf 'Use npm install -g @kissopen/kissopen-terminal on this platform.\n' >&2; exit 1 ;;
esac
command -v node >/dev/null 2>&1 || { printf 'Install Node.js 24+ from https://nodejs.org/ first.\n' >&2; exit 1; }
node -e 'if(Number(process.versions.node.split(".")[0])<24)process.exit(1)' || { printf 'Node.js 24 or newer is required.\n' >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { printf 'npm is required. Install it with Node.js.\n' >&2; exit 1; }
case "$prefix" in /*) ;; *) printf 'KISSOPEN_INSTALL_PREFIX must be an absolute path.\n' >&2; exit 1 ;; esac
npm install --global --prefix "$prefix" --registry=https://registry.npmjs.org --no-audit --no-fund "@kissopen/kissopen-terminal@$version"
"$prefix/bin/kissopen" --version
printf '\nInstalled. Start a session with: kissopen\n'
case ":$PATH:" in
  *":$prefix/bin:"*) ;;
  *) printf '\nAdd this directory to your shell PATH: %s/bin\n' "$prefix"
     printf 'For this shell, run: export PATH=%q:"$PATH"\n' "$prefix/bin" ;;
esac
if [[ $(uname -s) == Darwin ]]; then
  printf '\nThe standalone macOS Agent release is still being prepared.\n'
fi
