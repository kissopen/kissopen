/*
The platform as Node has it.

Used by this package's own tests and by the desktop client. It is kept beside
the neutral code rather than in the desktop repository because the thing that
matters about it is agreement: these bytes have to match what the phone's
native modules produce, and the tests that prove it live here.

libsodium-wrappers needs one await before it will do anything. `nodeSodium()`
does that await once; callers that install this platform must await it first,
which is why installation is asynchronous here and instant on the phone.
*/
import { createHash, randomBytes, randomUUID as nodeRandomUUID, createCipheriv, createDecipheriv } from 'node:crypto';
import { createRequire } from 'node:module';
import type { SyncPlatform, SyncSodium, SyncAes, SyncBase64, SyncRandom } from './platform';

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * The input as a valid encoding of itself would be written.
 *
 * Re-encoding is how this tells good input from bad, and padding is the one
 * difference that is not an error: callers pass both padded and unpadded
 * base64url, and Node always emits it unpadded.
 */
function normalise(value: string, encoding: 'base64' | 'base64url'): string {
    return encoding === 'base64url' ? value.replace(/=+$/, '') : value;
}

/**
 * AES-256-GCM in the framing every client shares.
 *
 * nonce(12) + ciphertext + tag(16), base64. That layout is what the phone's
 * native module emits; Node puts the tag in a separate call, so it is appended
 * here rather than left where Node leaves it.
 */
const aes: SyncAes = {
    async encryptAsyncAES(data: string, key64: string): Promise<string> {
        const key = Buffer.from(key64, 'base64');
        const iv = randomBytes(IV_LENGTH);
        const cipher = createCipheriv('aes-256-gcm', key, iv);
        const body = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
        return Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64');
    },
    async decryptAsyncAES(data: string, key64: string): Promise<string> {
        const key = Buffer.from(key64, 'base64');
        const raw = Buffer.from(data, 'base64');
        const iv = raw.subarray(0, IV_LENGTH);
        const tag = raw.subarray(raw.length - TAG_LENGTH);
        const body = raw.subarray(IV_LENGTH, raw.length - TAG_LENGTH);
        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
    },
};

const base64: SyncBase64 = {
    decodeBase64(value: string, encoding: 'base64' | 'base64url' = 'base64'): Uint8Array {
        // Node's Buffer quietly drops anything that is not base64 and returns
        // whatever it managed to read. Every other implementation refuses, and
        // callers rely on that: a mistyped backup key has to be rejected, not
        // silently turned into some shorter key that decrypts nothing.
        const buffer = Buffer.from(value, encoding === 'base64url' ? 'base64url' : 'base64');
        if (buffer.toString(encoding === 'base64url' ? 'base64url' : 'base64') !== normalise(value, encoding))
            throw new Error('Invalid base64');
        return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    },
    encodeBase64(buffer: Uint8Array, encoding: 'base64' | 'base64url' = 'base64'): string {
        return Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength).toString(
            encoding === 'base64url' ? 'base64url' : 'base64',
        );
    },
};

const random: SyncRandom = {
    getRandomBytes(length: number): Uint8Array {
        return new Uint8Array(randomBytes(length));
    },
    randomUUID(): string {
        return nodeRandomUUID();
    },
    async sha512(data: Uint8Array): Promise<Uint8Array> {
        return new Uint8Array(createHash('sha512').update(data).digest());
    },
};

/**
 * libsodium, ready to use.
 *
 * Loaded through require rather than import: the package's ESM build asks for
 * a sibling module it does not ship, so `import` of it fails under Node even
 * though the same package works in a bundler. The CJS build is the one that
 * works everywhere, and this is the only place that has to know.
 *
 * Deferred so that a client which never touches box encryption does not pay
 * for loading the WASM build at startup.
 */
export async function nodeSodium(): Promise<SyncSodium> {
    const require = createRequire(import.meta.url);
    let loaded: unknown;
    try {
        loaded = require('libsodium-wrappers');
    } catch (error) {
        /*
        A host that bundles this file resolves the require from its own output,
        not from this package, so libsodium-wrappers has to be a dependency of
        that host as well. Deep-importing it instead is not open to us: its
        exports map offers only the package root, and its ESM build imports a
        file it does not ship.
        */
        throw new Error(
            'libsodium-wrappers could not be loaded; a host that bundles ' +
                '@kissopen/kissopen-sync/node must depend on it too. ' +
                (error as Error).message,
        );
    }
    const sodium = (loaded as { default?: unknown }).default ?? loaded;
    await (sodium as { ready: Promise<void> }).ready;
    return sodium as unknown as SyncSodium;
}

/** The whole platform, once libsodium has finished waking up. */
export async function nodePlatform(): Promise<SyncPlatform> {
    return { sodium: await nodeSodium(), aes, base64, random };
}

export { aes as nodeAes, base64 as nodeBase64, random as nodeRandom };
