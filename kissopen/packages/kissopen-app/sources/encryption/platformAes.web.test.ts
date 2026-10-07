/**
 * The web AES implementation, exercised through the shared package.
 *
 * Two properties are being held here. The first is the round trip, against the
 * same crypto.subtle the web build uses, in the combined format rn-encryption
 * emits natively (12-byte nonce + ciphertext + 16-byte tag) — so a successful
 * round trip implies the native side can read it.
 *
 * The second is newer and matters more now that the desktop client shares this
 * code: what the web writes, Node reads, and the other way round. That is the
 * same person's phone and computer opening the same conversation.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { syncPlatformInstall } from '@kissopen/kissopen-sync/platform';
import { nodePlatform } from '@kissopen/kissopen-sync/node';
import {
    encryptAESGCMString,
    decryptAESGCMString,
    encryptAESGCM,
    decryptAESGCM,
} from '@kissopen/kissopen-sync/crypto/aes';
import type { SyncPlatform } from '@kissopen/kissopen-sync/platform';
import * as webAes from './platformAes.web';
import { encodeBase64 } from './base64';

let base: SyncPlatform;

/** Installs the web AES over an otherwise ordinary Node platform. */
async function useWebAes() {
    syncPlatformInstall({ ...base, aes: webAes });
}

/** Back to Node's, for the two-sided compatibility checks. */
function useNodeAes() {
    syncPlatformInstall(base);
}

beforeAll(async () => {
    base = await nodePlatform();
    await useWebAes();
});

function randomKeyB64(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return encodeBase64(bytes);
}

describe('aes.web', () => {
    it('round-trips a string', async () => {
        const key = randomKeyB64();
        const plain = JSON.stringify({ msg: 'Hello, World!', n: 42 });
        const encrypted = await encryptAESGCMString(plain, key);
        expect(typeof encrypted).toBe('string');
        const decrypted = await decryptAESGCMString(encrypted, key);
        expect(decrypted).toBe(plain);
    });

    it('produces a fresh IV per call (no two ciphertexts equal)', async () => {
        const key = randomKeyB64();
        const a = await encryptAESGCMString('same', key);
        const b = await encryptAESGCMString('same', key);
        expect(a).not.toBe(b);
    });

    it('rejects ciphertext encrypted under a different key', async () => {
        const k1 = randomKeyB64();
        const k2 = randomKeyB64();
        const encrypted = await encryptAESGCMString('secret', k1);
        const result = await decryptAESGCMString(encrypted, k2);
        expect(result).toBeNull();
    });

    it('rejects truncated ciphertext gracefully', async () => {
        const key = randomKeyB64();
        const encrypted = await encryptAESGCMString('hello', key);
        const result = await decryptAESGCMString(encrypted.slice(0, 4), key);
        expect(result).toBeNull();
    });

    it('round-trips a Uint8Array via the bytes API', async () => {
        const key = randomKeyB64();
        const data = new TextEncoder().encode('Hello, World!');
        const encrypted = await encryptAESGCM(data, key);
        expect(encrypted).toBeInstanceOf(Uint8Array);
        const decrypted = await decryptAESGCM(encrypted, key);
        expect(decrypted).toBeInstanceOf(Uint8Array);
        expect(new TextDecoder().decode(decrypted!)).toBe('Hello, World!');
    });

    it('produces wire format: 12-byte IV prefix + ciphertext + 16-byte tag', async () => {
        const key = randomKeyB64();
        const encrypted = await encryptAESGCMString('a', key);
        // base64 payload = IV(12) + ciphertext("a" → 1 byte) + GCM tag(16) = 29 bytes
        const decoded = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
        expect(decoded.length).toBe(12 + 1 + 16);
    });
});

describe('web and Node agree on the wire', () => {
    it('Node reads what the web wrote', async () => {
        const key = randomKeyB64();
        await useWebAes();
        const encrypted = await encryptAESGCMString('从手机写的', key);
        useNodeAes();
        expect(await decryptAESGCMString(encrypted, key)).toBe('从手机写的');
    });

    it('the web reads what Node wrote', async () => {
        const key = randomKeyB64();
        useNodeAes();
        const encrypted = await encryptAESGCMString('从桌面写的', key);
        await useWebAes();
        expect(await decryptAESGCMString(encrypted, key)).toBe('从桌面写的');
    });
});
