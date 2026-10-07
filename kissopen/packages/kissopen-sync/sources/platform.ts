/*
The three things this package cannot do by itself.

Everything else here is plain TypeScript and runs anywhere. These three are
primitives the host has to supply, because the phone reaches them through
native modules and the desktop reaches them through Node — and the bytes they
produce have to be identical either way, or two of the same person's devices
would read the same conversation differently.

The host installs one implementation at startup. Nothing in this package
reaches for a global, an environment variable or a bundler extension to find
one: a wrong implementation should fail loudly at wiring time rather than
quietly at the first message.
*/

/** A libsodium box key pair, named because callers hold onto one. */
export interface SyncKeyPair {
    readonly publicKey: Uint8Array;
    readonly privateKey: Uint8Array;
}

/** The libsodium surface this package uses. Deliberately no wider. */
export interface SyncSodium {
    crypto_sign_seed_keypair(seed: Uint8Array): SyncKeyPair;
    crypto_sign_detached(message: Uint8Array, privateKey: Uint8Array): Uint8Array;
    readonly crypto_box_NONCEBYTES: number;
    readonly crypto_box_PUBLICKEYBYTES: number;
    readonly crypto_secretbox_NONCEBYTES: number;
    crypto_box_seed_keypair(seed: Uint8Array): SyncKeyPair;
    crypto_box_keypair(): SyncKeyPair;
    crypto_box_easy(message: Uint8Array, nonce: Uint8Array, publicKey: Uint8Array, privateKey: Uint8Array): Uint8Array;
    crypto_box_open_easy(ciphertext: Uint8Array, nonce: Uint8Array, publicKey: Uint8Array, privateKey: Uint8Array): Uint8Array;
    crypto_secretbox_easy(message: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
    crypto_secretbox_open_easy(ciphertext: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
}

/**
 * AES-256-GCM over base64 strings.
 *
 * The wire format is fixed by what the phone's native module emits, and the
 * web implementation in the app already mirrors it byte for byte. A host that
 * supplies its own must match that, not invent a framing of its own.
 */
export interface SyncAes {
    encryptAsyncAES(data: string, key64: string): Promise<string>;
    /**
     * Null when the ciphertext does not open under this key.
     *
     * A host may also throw, and callers here treat the two the same. The web
     * implementation returns null and the phone's native module throws; making
     * the contract admit both is what keeps a failed decrypt behaving the same
     * on every platform.
     */
    decryptAsyncAES(data: string, key64: string): Promise<string | null>;
}

/**
 * Base64, which every runtime has and none of them the same way.
 *
 * A capability rather than one neutral implementation because the phone uses a
 * native module for it deliberately: this sits under every message that
 * arrives, and `atob` on Hermes is not the same trade.
 */
export interface SyncBase64 {
    decodeBase64(value: string, encoding?: 'base64' | 'base64url'): Uint8Array;
    encodeBase64(buffer: Uint8Array, encoding?: 'base64' | 'base64url'): string;
}

/** Randomness and hashing, the parts a runtime keeps to itself. */
export interface SyncRandom {
    getRandomBytes(length: number): Uint8Array;
    randomUUID(): string;
    /** SHA-512 of the given bytes. */
    sha512(data: Uint8Array): Promise<Uint8Array>;
}

export interface SyncPlatform {
    readonly sodium: SyncSodium;
    readonly aes: SyncAes;
    readonly base64: SyncBase64;
    readonly random: SyncRandom;
}

let installed: SyncPlatform | undefined;

/**
 * Installs the host's implementation. Called once, before anything else here.
 *
 * Installing twice is allowed and replaces the previous one: tests do it, and
 * a host that reconfigures itself should not have to tear the module down.
 */
export function syncPlatformInstall(platform: SyncPlatform): void {
    installed = platform;
}

/**
 * The installed platform.
 *
 * Throws rather than falling back. There is no safe default for any of these:
 * a stub would produce ciphertext nobody else can read, and the failure would
 * surface much later, as a conversation that syncs but cannot be opened.
 */
export function syncPlatform(): SyncPlatform {
    if (!installed)
        throw new Error(
            "kissopen-sync has no platform installed; call syncPlatformInstall() during startup",
        );
    return installed;
}
