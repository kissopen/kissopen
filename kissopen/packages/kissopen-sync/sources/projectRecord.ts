/*
Opening a project record.

A project names itself under its own key, so reading its name is the same
three steps everywhere: take the project's data key if it has one, open the
encryptor that key implies, and read the JSON. A client that did this
differently would show a different name for the same project.

Only the name and kind are read here. Avatars are private blobs with their own
key derivation and their own loading story, which belongs to whichever client
draws them.
*/
import { decodeBase64 } from './crypto/base64';
import type { Encryption } from './encryption/encryption';
import type { ApiProjectRecord, ProjectMetadata } from './projectTypes';

/** The project encryption this record implies: its own key, or the account's. */
async function openFor(
    record: Pick<ApiProjectRecord, 'dataEncryptionKey'>,
    encryption: Pick<Encryption, 'decryptEncryptionKey' | 'openEncryption'>,
) {
    // Null is the legacy form: the account secretbox, not a per-project key.
    if (record.dataEncryptionKey === null || record.dataEncryptionKey === undefined)
        return encryption.openEncryption(null);
    const dataKey = await encryption.decryptEncryptionKey(record.dataEncryptionKey);
    if (!dataKey) return null;
    return encryption.openEncryption(dataKey);
}

function readMetadata(value: unknown): ProjectMetadata | null {
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (!name) return null;
    const kind = typeof record.kind === 'string' && record.kind.trim() ? record.kind.trim() : null;
    return { name, kind };
}

/**
 * The name a project calls itself, or null when this account cannot read it.
 *
 * Null rather than a placeholder: a project whose name will not open is not a
 * project called "Untitled", and a caller that wants to say so can say it in
 * its own words.
 */
export async function projectMetadataRead(
    record: Pick<ApiProjectRecord, 'dataEncryptionKey' | 'metadata'>,
    encryption: Pick<Encryption, 'decryptEncryptionKey' | 'openEncryption'>,
): Promise<ProjectMetadata | null> {
    try {
        const encryptor = await openFor(record, encryption);
        if (!encryptor) return null;
        const decrypted = await encryptor.decrypt([decodeBase64(record.metadata, 'base64')]);
        return readMetadata(decrypted[0] ?? null);
    } catch {
        return null;
    }
}
