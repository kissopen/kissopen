import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { artifactBinaryRead, artifactRead, productRoot } from './agent-artifacts.mjs';
const [platform = process.platform, arch = process.arch, input] = process.argv.slice(2);
if (!['darwin', 'win32', 'linux'].includes(platform) || !['arm64', 'x64'].includes(arch) || input) {
    throw new Error('Usage: node scripts/stage-kissopen-agent.mjs PLATFORM ARCH. Import verified artifacts first; raw binaries are not accepted.');
}
const { lock, directory, entry, bytes } = await artifactBinaryRead(platform, arch);
const notices = await artifactRead(directory, lock.licenses);
const name = `kissopen-agent${platform === 'win32' ? '.exe' : ''}`;
const target = join(productRoot, `kissopen-desktop/packages/kissopen-desktop-electron/build/kissopen-agent/${arch}`);
await mkdir(target, { recursive: true });
await writeFile(join(target, name), bytes);
await chmod(join(target, name), 0o755);
await writeFile(join(target, 'UPSTREAM_LICENSES.txt'), notices);
await writeFile(join(target, 'manifest.json'), JSON.stringify({ version: lock.agentVersion, platform, arch, sha256: entry.sha256 }, null, 2) + '\n');
console.log(`Staged verified independent Agent ${lock.agentVersion} for ${platform}-${arch}`);
