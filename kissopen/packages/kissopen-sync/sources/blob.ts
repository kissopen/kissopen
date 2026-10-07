/*
Binary blobs, encrypted under a session's own blob key.

Separate from the message encryptors because it carries raw bytes rather than
JSON: an image is handed to the model as a file, not as a field in a record.

Wire format: nonce (24 bytes) then the secretbox. Fixed by what is already on
the server, so this is a description, not a choice — a client that framed it
differently would upload pictures nobody else could open.
*/
import { syncPlatform } from './platform';

/**
 * Encrypts a blob with a 32-byte key. Returns nonce + ciphertext.
 *
 * The defensive copies are not superstition: the phone's native libsodium
 * reads an argument's whole underlying ArrayBuffer rather than the view, so a
 * Uint8Array that is a window onto a larger buffer is read as the larger
 * buffer — either rejected as the wrong key length, or encrypted with bytes
 * the caller never passed.
 */
export function encryptBlob(data: Uint8Array, key: Uint8Array): Uint8Array {
    const { sodium, random } = syncPlatform();
    const nonce = random.getRandomBytes(sodium.crypto_secretbox_NONCEBYTES);
    const encrypted = sodium.crypto_secretbox_easy(standalone(data), nonce, standalone(key));
    const result = new Uint8Array(nonce.length + encrypted.length);
    result.set(nonce, 0);
    result.set(standalone(encrypted), nonce.length);
    return result;
}

/**
 * The bytes back, or null when they will not open.
 *
 * Null rather than a throw: a blob that does not open under this account's key
 * is a thing a caller displays as unavailable, not an error that should take
 * the surrounding conversation down with it.
 */
export function decryptBlob(bundle: Uint8Array, key: Uint8Array): Uint8Array | null {
    const { sodium } = syncPlatform();
    if (bundle.length < sodium.crypto_secretbox_NONCEBYTES + 16) return null;
    const nonce = bundle.slice(0, sodium.crypto_secretbox_NONCEBYTES);
    const ciphertext = bundle.slice(sodium.crypto_secretbox_NONCEBYTES);
    try {
        return sodium.crypto_secretbox_open_easy(ciphertext, nonce, standalone(key));
    } catch {
        return null;
    }
}

/** A view onto exactly its own bytes, copying only when it is not one already. */
function standalone(bytes: Uint8Array): Uint8Array {
    return bytes.byteOffset === 0 && bytes.buffer.byteLength === bytes.length ? bytes : bytes.slice();
}
