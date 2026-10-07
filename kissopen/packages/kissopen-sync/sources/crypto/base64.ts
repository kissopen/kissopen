/*
Base64, over the host's implementation.

Nothing neutral is kept here on purpose. This sits under every message that
arrives, and the hosts differ in what is fast and what even exists: the phone
uses a native module, and a plain `atob` loop is not the same trade there.
*/
import { syncPlatform } from '../platform';

export function decodeBase64(value: string, encoding: 'base64' | 'base64url' = 'base64'): Uint8Array {
    return syncPlatform().base64.decodeBase64(value, encoding);
}

export function encodeBase64(buffer: Uint8Array, encoding: 'base64' | 'base64url' = 'base64'): string {
    return syncPlatform().base64.encodeBase64(buffer, encoding);
}
