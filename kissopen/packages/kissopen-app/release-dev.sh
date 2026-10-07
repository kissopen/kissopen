#!/bin/sh
set -eu
cd "$(dirname "$0")"
pnpm release:build:developer
