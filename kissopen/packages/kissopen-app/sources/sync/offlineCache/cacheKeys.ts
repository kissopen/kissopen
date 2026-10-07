/*
 * Names for what the on-device cache keeps.
 *
 * Everything the phone caches belongs to one account on one server, so every
 * name starts from an account key. The key is a digest of the server address
 * and the account's public id — never the token or the recovery secret — so
 * the cache neither holds a credential nor mixes two accounts' data when the
 * phone signs in to another one.
 *
 * Pure: no storage here, so the naming rules can be tested on their own.
 */

/** FNV-1a, 32 bits, over the UTF-8 bytes of the text, from a chosen offset basis. */
function fnv1a32(value: string, basis: number): number {
    let hash = basis >>> 0;
    for (const byte of new TextEncoder().encode(value)) {
        hash ^= byte;
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash;
}

/**
 * A 64-bit digest as 16 lowercase hex digits: two FNV-1a passes with
 * different offset bases. A name, not a secret — collisions only need to be
 * unlikely between the handful of accounts one phone ever holds.
 */
export function cacheDigest(value: string): string {
    const high = fnv1a32(value, 0x811c9dc5);
    const low = fnv1a32(value, 0x050c5d1f);
    return high.toString(16).padStart(8, '0') + low.toString(16).padStart(8, '0');
}

/** The account's cache namespace: one server, one account id. */
export function cacheAccountKey(serverUrl: string, accountId: string): string {
    return cacheDigest(`${serverUrl.replace(/\/+$/, '')}\n${accountId}`);
}

/**
 * A file name for an id the server chose. Ids are usually already safe
 * (letters, digits, dashes); anything else is replaced by its digest so a
 * strange id can never reach outside the cache folder.
 */
export function cacheFileName(id: string): string {
    return /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : `h${cacheDigest(id)}`;
}

/** One project file on one computer (or the cloud), e.g. `.kissopen/board.json`. */
export function projectFileCacheKey(machineId: string, projectPath: string, file: string): string {
    return `project-file:${cacheDigest(`${machineId}\n${projectPath}\n${file}`)}`;
}
