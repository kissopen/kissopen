/*
AES-256-GCM as the phone has it — the native module.

Only the raw pair lives here. The shape-shifting around it (bytes, the
UTF-8 round trip, the base64 framing) is in @kissopen/kissopen-sync, so that
every client does it the same way. Metro picks `.web.ts` instead of this file
on the web.
*/
import * as crypto from 'rn-encryption';

export function encryptAsyncAES(data: string, key64: string): Promise<string> {
    return crypto.encryptAsyncAES(data, key64);
}

export function decryptAsyncAES(data: string, key64: string): Promise<string> {
    return crypto.decryptAsyncAES(data, key64);
}
