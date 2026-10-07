import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

export const productRoot = resolve(import.meta.dirname, '..');
export const artifactDirectory = version => join(productRoot, '.local/agent', version);
export const artifactLockRead = async () => {
    const lock = JSON.parse(await readFile(join(productRoot, 'agent-artifacts.lock.json'), 'utf8'));
    if (lock.schemaVersion !== 1 || !/^\d+\.\d+\.\d+(?:-preview\.\d+)?$/.test(lock.agentVersion)) {
        throw new Error('Unsupported Agent artifact lock. Import a verified release first.');
    }
    return lock;
};

export async function artifactRead(directory, entry) {
    if (!entry || typeof entry.file !== 'string' || basename(entry.file) !== entry.file ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(entry.file) || !Number.isSafeInteger(entry.size) || entry.size <= 0 ||
        !/^[a-f0-9]{64}$/.test(entry.sha256 ?? '')) throw new Error('Invalid Agent artifact entry');
    const bytes = await readFile(join(directory, entry.file));
    if (bytes.length !== entry.size || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) {
        throw new Error(`Agent artifact failed integrity verification: ${entry.file}`);
    }
    return bytes;
}

export async function artifactBinaryRead(platform, arch) {
    const lock = await artifactLockRead();
    const entry = lock.binaries.find(item => item.platform === platform && item.arch === arch);
    if (!entry) throw new Error(`Agent ${lock.agentVersion} does not include ${platform}-${arch}. Import that release target first.`);
    const directory = artifactDirectory(lock.agentVersion);
    return { lock, entry, directory, bytes: await artifactRead(directory, entry) };
}
