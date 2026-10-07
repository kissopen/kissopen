// Package the desktop client for the host platform and architecture, using the
// Agent binary that `pnpm agent:stage` verified and staged for the same target.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { productRoot } from './agent-artifacts.mjs';

const desktop = join(productRoot, 'kissopen-desktop');
const commands = {
    darwin: ['desktop:mac:release', '--flavor=standard', `--arch=${process.arch}`],
    linux: ['--dir', 'packages/kissopen-desktop-electron', 'dist:linux'],
    win32: ['desktop:win:release', 'standard'],
};
const args = commands[process.platform];
if (!args) throw new Error(`Desktop packaging is not supported on ${process.platform}.`);
const result = spawnSync('pnpm', args, { cwd: desktop, stdio: 'inherit', shell: process.platform === 'win32' });
process.exitCode = result.status ?? 1;
