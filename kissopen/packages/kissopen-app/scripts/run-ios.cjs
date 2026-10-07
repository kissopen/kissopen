#!/usr/bin/env node
// expo run:ios alone reuses an existing native project. Refresh its identity
// first when switching variants; never delete local native files with --clean.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { resolveCommunityApp } = require('../community-app.cjs');
try {
    const app = resolveCommunityApp({ ...process.env, COMMUNITY_APP_ENV: process.env.COMMUNITY_APP_ENV || process.env.APP_ENV });
    const options = { cwd: path.resolve(__dirname, '..'), env: { ...process.env, COMMUNITY_APP_ENV: app.variant }, stdio: 'inherit' };
    for (const args of [['prebuild', '--platform', 'ios', '--no-install'], ['run:ios', ...(app.variant === 'production' ? ['--configuration', 'Release'] : []), ...process.argv.slice(2)]]) {
        const result = spawnSync('expo', args, options);
        if (result.error) throw result.error;
        if (result.status !== 0) process.exit(result.status ?? 1);
    }
} catch (error) { console.error(error.message); process.exitCode = 1; }
