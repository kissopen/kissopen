#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { resolveAppMarket } = require('../app-market.cjs');
const eas = require('../eas.json');

function releaseCommand(action, env = process.env, config = eas) {
    const app = resolveAppMarket(env);
    if (!app.projectId) throw new Error('Configure the selected market’s EAS project ID before building, submitting or publishing updates. The old shared project is not used.');
    const profile = `${app.market}-${app.variant}`;
    if (!config.build[profile]) throw new Error('No build profile for this market and environment');
    const args = [];
    if (action === 'build') {
        args.push('build', '--profile', profile, '--platform', 'ios');
    } else if (action === 'update') {
        args.push('update', '--channel', app.channel, '--platform', 'all');
    } else if (action === 'submit') {
        const submit = config.submit[profile]?.ios;
        if (!submit || !/^\d+$/.test(submit.ascAppId || '') || submit.bundleIdentifier !== app.bundleId) throw new Error('Create the matching App Store Connect app and fill its numeric ascAppId in eas.json before submitting.');
        args.push('submit', '--profile', profile, '--platform', 'ios', '--latest');
    } else { throw new Error('Expected build, update or submit'); }
    return { app, args };
}

if (require.main === module) {
    try {
        const { app, args } = releaseCommand(process.argv[2]);
        // Expo is resolved again by EAS; pass the exact validated identity.
        const env = { ...process.env, APP_MARKET: app.market, APP_ENV: app.variant };
        const interactive = process.argv.includes('--interactive');
        if (!interactive) args.push('--non-interactive');
        console.log(`${app.name}: ${app.bundleId}; channel ${app.channel}`);
        const result = spawnSync('eas', args, { cwd: path.resolve(__dirname, '..'), env, stdio: 'inherit' });
        if (result.error) throw result.error;
        process.exitCode = result.status ?? 1;
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { releaseCommand };
