import { access, chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { artifactDirectory, artifactRead, productRoot } from './agent-artifacts.mjs';

const directory = process.argv[2] && resolve(process.argv[2]);
const expectedManifestHash = process.argv[3];
if (!directory || !/^[a-f0-9]{64}$/.test(expectedManifestHash ?? '')) {
    throw new Error('Usage: node scripts/import-agent-artifacts.mjs DIRECTORY TRUSTED_MANIFEST_SHA256');
}
const manifestBytes = await readFile(join(directory, 'manifest.json'));
if (createHash('sha256').update(manifestBytes).digest('hex') !== expectedManifestHash) {
    throw new Error('Agent manifest does not match the trusted release hash');
}
const manifest = JSON.parse(manifestBytes);
if (manifest.schemaVersion !== 1 || !/^\d+\.\d+\.\d+(?:-preview\.\d+)?$/.test(manifest.agentVersion) ||
    manifest.sdk?.name !== '@kissopen/kissopen-agent-client' || !/^\d+\.\d+\.\d+(?:-preview\.\d+)?$/.test(manifest.sdk.version) ||
    manifest.sdk.file !== `kissopen-kissopen-agent-client-${manifest.sdk.version}.tgz` ||
    manifest.licenses?.file !== 'UPSTREAM_LICENSES.txt' || !Array.isArray(manifest.binaries) || !manifest.binaries.length) {
    throw new Error('Invalid Agent release manifest');
}
const targets = new Set();
for (const binary of manifest.binaries) {
    const target = `${binary.platform}-${binary.arch}`;
    if (!/^(darwin|linux)-(arm64|x64)$|^win32-x64$/.test(target) || targets.has(target) ||
        binary.file !== `kissopen-agent-${target}${binary.platform === 'win32' ? '.exe' : ''}`) throw new Error('Invalid or duplicate binary target');
    targets.add(target);
}
// Verify the entire set before writing any product dependency or cache.
const entries = [manifest.sdk, manifest.licenses, ...manifest.binaries];
const verified = await Promise.all(entries.map(async entry => [entry, await artifactRead(directory, entry)]));
const cache = artifactDirectory(manifest.agentVersion);
const vendor = join(productRoot, 'kissopen-desktop/vendor/agent');
const immutableWrite = async (path, bytes) => {
    try {
        const previous = await readFile(path);
        if (!previous.equals(bytes)) throw new Error(`Refusing to replace a different version-pinned artifact: ${path}`);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await writeFile(path, bytes, { flag: 'wx', mode: 0o644 });
    }
};
// Check immutable destinations before any import mutation.
for (const [entry, bytes] of verified) {
    for (const path of [join(cache, entry.file), ...(entry === manifest.sdk ? [join(vendor, entry.file)] : [])]) {
        try { await access(path); if (!(await readFile(path)).equals(bytes)) throw new Error(`Artifact version already exists with different content: ${path}`); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
}
await mkdir(cache, { recursive: true });
await mkdir(vendor, { recursive: true });
for (const [entry, bytes] of verified) await immutableWrite(join(cache, entry.file), bytes);
// Byte identity is immutable; executability is restored on idempotent imports too.
for (const binary of manifest.binaries) await chmod(join(cache, binary.file), 0o755);
await immutableWrite(join(vendor, manifest.sdk.file), verified[0][1]);
for (const packageName of ['kissopen-desktop-state', 'kissopen-desktop-electron', 'kissopen-desktop-gym']) {
    const path = join(productRoot, 'kissopen-desktop/packages', packageName, 'package.json');
    const pkg = JSON.parse(await readFile(path, 'utf8'));
    pkg.dependencies[manifest.sdk.name] = `file:../../vendor/agent/${manifest.sdk.file}`;
    await writeFile(path, JSON.stringify(pkg, null, 4) + '\n');
}
await writeFile(join(productRoot, 'agent-artifacts.lock.json'), JSON.stringify({ ...manifest, manifestSha256: expectedManifestHash }, null, 2) + '\n');
console.log(`Pinned Agent ${manifest.agentVersion} and SDK ${manifest.sdk.version}. Run pnpm --dir kissopen-desktop install to update its lockfile. No runtime was installed or restarted.`);
