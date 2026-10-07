/*
AES-256-GCM as the web has it — crypto.subtle.

Wire format mirrors what the native `rn-encryption` module emits on iOS
(`AES.GCM.seal` produces nonce(12) + ciphertext + tag(16)) and on Android (the
same layout), so a blob encrypted on one of a person's devices opens on
another. Output is base64; keys are 32-byte AES-256 passed as base64.

`rn-encryption` does ship a web fallback through `web-secure-encryption`, so
going through it here would work. Implementing against crypto.subtle directly
drops the dependency hop from the web bundle and lets Metro resolve a cheaper
platform module without a runtime Platform.OS check.
*/
const ALGO = 'AES-GCM';
const IV_LEN = 12;

function decodeBase64(value: string): Uint8Array {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function encodeBase64(buffer: Uint8Array): string {
    // Chunked: String.fromCharCode.apply blows the stack past ~64KB on web.
    const CHUNK = 0x8000;
    let binary = '';
    for (let i = 0; i < buffer.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, buffer.subarray(i, i + CHUNK) as unknown as number[]);
    }
    return btoa(binary);
}

async function importKey(key64: string, usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
    const keyBytes = decodeBase64(key64);
    return crypto.subtle.importKey('raw', keyBytes as BufferSource, { name: ALGO }, false, [usage]);
}

export async function encryptAsyncAES(data: string, key64: string): Promise<string> {
    const key = await importKey(key64, 'encrypt');
    const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
    const ciphertext = await crypto.subtle.encrypt(
        { name: ALGO, iv: iv as BufferSource },
        key,
        new TextEncoder().encode(data) as BufferSource,
    );
    const out = new Uint8Array(iv.length + ciphertext.byteLength);
    out.set(iv, 0);
    out.set(new Uint8Array(ciphertext), iv.length);
    return encodeBase64(out);
}

export async function decryptAsyncAES(data: string, key64: string): Promise<string | null> {
    try {
        const key = await importKey(key64, 'decrypt');
        const bundle = decodeBase64(data);
        const plaintext = await crypto.subtle.decrypt(
            { name: ALGO, iv: bundle.slice(0, IV_LEN) as BufferSource },
            key,
            bundle.slice(IV_LEN) as BufferSource,
        );
        return new TextDecoder().decode(plaintext);
    } catch {
        return null;
    }
}
