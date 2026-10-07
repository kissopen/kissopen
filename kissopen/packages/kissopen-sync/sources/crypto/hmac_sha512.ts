/*
HMAC-SHA512, built here rather than taken from the host.

Only the hash is a platform capability. The construction around it stays in
one place so every client derives the same key from the same secret — if this
differed between phone and desktop, the symptom would be a device that syncs
and then cannot read anything.
*/
import { syncPlatform } from '../platform';

export async function hmac_sha512(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const { random } = syncPlatform();
    const blockSize = 128; // SHA512 block size in bytes
    const opad = 0x5c;
    const ipad = 0x36;

    // Prepare key
    let actualKey = key;
    if (key.length > blockSize) {
        // If key is longer than block size, hash it
        actualKey = await random.sha512(new Uint8Array(key));
    }

    // Pad key to block size
    const paddedKey = new Uint8Array(blockSize);
    paddedKey.set(actualKey);

    // Create inner and outer padded keys
    const innerKey = new Uint8Array(blockSize);
    const outerKey = new Uint8Array(blockSize);

    for (let i = 0; i < blockSize; i++) {
        innerKey[i] = paddedKey[i] ^ ipad;
        outerKey[i] = paddedKey[i] ^ opad;
    }

    // Inner hash: SHA512(innerKey || data)
    const innerData = new Uint8Array(blockSize + data.length);
    innerData.set(innerKey);
    innerData.set(data, blockSize);
    const innerHash = await random.sha512(innerData);

    // Outer hash: SHA512(outerKey || innerHash)
    const outerData = new Uint8Array(blockSize + 64); // 64 bytes for SHA512 hash
    outerData.set(outerKey);
    outerData.set(new Uint8Array(innerHash), blockSize);
    const finalHash = await random.sha512(outerData);

    return new Uint8Array(finalHash);
}
