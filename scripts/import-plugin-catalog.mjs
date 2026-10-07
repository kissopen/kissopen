// Mirror a published data catalog, never account data or executable installers.
// Usage: node scripts/import-plugin-catalog.mjs --source https://host/downloads/plugins/ --out /new/path
import { createHash } from 'node:crypto';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';

const option = (name) => process.argv[process.argv.indexOf(name) + 1];
if (!process.argv.includes('--source') || !process.argv.includes('--out'))
    throw new Error('Specify --source and a new --out directory.');
const source = new URL(option('--source'));
if (source.protocol !== 'https:' || source.username || source.password || source.search || source.hash)
    throw new Error('Use a public HTTPS catalog directory without credentials or query parameters.');
if (!source.pathname.endsWith('/')) source.pathname += '/';
const destination = resolve(option('--out'));
try {
    await stat(destination);
    throw new Error('The destination already exists; choose a new directory.');
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
}
const safe = (path) => typeof path === 'string' && /^[a-zA-Z0-9._/-]+$/.test(path) &&
    !path.startsWith('/') && !path.split('/').some(part => !part || part === '.' || part === '..');
async function download(path, limit) {
    if (!safe(path)) throw new Error('Invalid catalog asset path.');
    const response = await fetch(new URL(path, source), { redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Catalog asset ${path}: HTTP ${response.status}`);
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
        size += chunk.length;
        if (size > limit) throw new Error(`Catalog asset ${path} exceeds its size limit.`);
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}
async function save(path, data) {
    const target = join(destination, path);
    await mkdir(resolve(target, '..'), { recursive: true });
    await writeFile(target, data, { flag: 'wx', mode: 0o644 });
}
const raw = await download('index.json', 1024 * 1024);
const index = JSON.parse(raw.toString('utf8'));
if (!Array.isArray(index.plugins) || !index.plugins.length || index.plugins.length > 512)
    throw new Error('The catalog must contain 1–512 plugins.');
const names = new Set();
for (const item of index.plugins) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(item.id) || names.has(item.id) ||
        !safe(item.file) || item.file.includes('/') || !item.file.endsWith('.zip') ||
        !/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isSafeInteger(item.bytes) ||
        item.bytes < 1 || item.bytes > 8 * 1024 * 1024 ||
        (item.icon && (!safe(item.icon) || !/^icons\/[a-z][a-z0-9-]*\.png$/.test(item.icon))))
        throw new Error('The catalog contains an invalid or duplicate entry.');
    names.add(item.id);
}
await mkdir(dirname(destination), { recursive: true, mode: 0o755 });
await mkdir(destination, { recursive: false, mode: 0o755 });
let at = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
    while (at < index.plugins.length) {
        const item = index.plugins[at++];
        const archive = await download(item.file, 8 * 1024 * 1024);
        if (archive.length !== item.bytes || createHash('sha256').update(archive).digest('hex') !== item.sha256)
            throw new Error(`Plugin ${item.id} failed its size/SHA-256 check.`);
        await save(item.file, archive);
        const detail = await download(`details/${item.id}.json`, 512 * 1024);
        if (JSON.parse(detail.toString('utf8')).id !== item.id)
            throw new Error(`Plugin ${item.id} has mismatched details.`);
        await save(`details/${item.id}.json`, detail);
        if (item.icon) await save(item.icon, await download(item.icon, 2 * 1024 * 1024));
    }
}));
// Publish the index last: a partial mirror is never an installable catalog.
await save('index.json', raw);
await save('provenance.json', Buffer.from(JSON.stringify({
    source: source.href, importedAt: new Date().toISOString(), plugins: index.plugins.length,
    indexSHA256: createHash('sha256').update(raw).digest('hex'),
    note: 'Published plugin packages only; no user data, credentials, or cloud workspace state.',
}, null, 2) + '\n'));
console.log(`Verified ${index.plugins.length} plugin packages, details and icons: ${destination}`);
