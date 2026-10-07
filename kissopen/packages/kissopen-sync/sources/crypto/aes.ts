/*
AES-256-GCM, over the host's implementation.

The framing is not ours to choose: it is what the phone's native module emits
(nonce(12) + ciphertext + tag(16), base64), and every other implementation
mirrors it so that a blob written on one of a person's devices opens on
another. What lives here is only the shape-shifting around it.

The Uint8Array pair goes through UTF-8 rather than treating the bytes as
binary. That is not a good encoding for arbitrary bytes, and it is kept on
purpose: existing stored blobs were written this way, and the round trip is
what has to keep working. See the note in encryptor.ts.
*/
import { syncPlatform } from '../platform';
import { decodeUTF8, encodeUTF8 } from './text';

export async function encryptAESGCMString(data: string, key64: string): Promise<string> {
    return await syncPlatform().aes.encryptAsyncAES(data, key64);
}

export async function decryptAESGCMString(data: string, key64: string): Promise<string | null> {
    const res = await syncPlatform().aes.decryptAsyncAES(data, key64);
    return res === null ? null : res.trim();
}

export async function encryptAESGCM(data: Uint8Array, key64: string): Promise<Uint8Array> {
    const platform = syncPlatform();
    const encrypted = (await platform.aes.encryptAsyncAES(decodeUTF8(data), key64)).trim();
    return platform.base64.decodeBase64(encrypted);
}

export async function decryptAESGCM(data: Uint8Array, key64: string): Promise<Uint8Array | null> {
    const platform = syncPlatform();
    const raw = await platform.aes.decryptAsyncAES(platform.base64.encodeBase64(data), key64);
    return raw ? encodeUTF8(raw) : null;
}
