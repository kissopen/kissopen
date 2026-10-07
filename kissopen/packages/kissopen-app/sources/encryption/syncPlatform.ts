/*
What this app supplies to @kissopen/kissopen-sync.

The shared package does the reduction and the encryption; these are the few
primitives it cannot reach by itself. Everything here is a native or web module
that Metro picks per platform, which is why the wiring is one file rather than
scattered imports inside the package.

Installed once, from the app's entry point, before anything reads a message.
*/
import { digest, CryptoDigestAlgorithm, getRandomBytes, randomUUID } from 'expo-crypto';
import type { SyncPlatform } from '@kissopen/kissopen-sync/platform';
import sodium from '@/encryption/libsodium.lib';
import { encryptAsyncAES, decryptAsyncAES } from '@/encryption/platformAes';
import { decodeBase64, encodeBase64 } from '@/encryption/platformBase64';

export const appSyncPlatform: SyncPlatform = {
    sodium: sodium as unknown as SyncPlatform['sodium'],
    aes: { encryptAsyncAES, decryptAsyncAES },
    base64: { decodeBase64, encodeBase64 },
    random: {
        getRandomBytes,
        randomUUID,
        async sha512(data: Uint8Array): Promise<Uint8Array> {
            // digest 收 BufferSource，而 Uint8Array 的缓冲区类型是宽的：它
            // 可能背着 SharedArrayBuffer，那不是 BufferSource。这里传进来的
            // 一路都是普通 Uint8Array。
            const bytes = data as Uint8Array<ArrayBuffer>;
            return new Uint8Array(await digest(CryptoDigestAlgorithm.SHA512, bytes));
        },
    },
};
