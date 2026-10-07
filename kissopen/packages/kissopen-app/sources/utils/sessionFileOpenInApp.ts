import { Platform } from 'react-native';
import { cacheDirectory, EncodingType, getContentUriAsync, makeDirectoryAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { sessionReadFileWhole } from '@/sync/ops';

/** What the open-with sheet is told each document is, so it offers the right apps. */
const MIME_TYPES: Record<string, string> = {
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pdf: 'application/pdf',
    rtf: 'application/rtf',
    odt: 'application/vnd.oasis.opendocument.text',
    ods: 'application/vnd.oasis.opendocument.spreadsheet',
    odp: 'application/vnd.oasis.opendocument.presentation',
    epub: 'application/epub+zip',
    wps: 'application/vnd.ms-works',
    et: 'application/vnd.ms-excel',
    dps: 'application/vnd.ms-powerpoint',
    csv: 'text/csv',
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    heic: 'image/heic',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    html: 'text/html',
    zip: 'application/zip',
};

/** One file from the session, copied into this phone's cache under its own name. */
async function sessionFileCopy(sessionId: string, path: string): Promise<{ uri: string; name: string; mimeType: string }> {
    if (!cacheDirectory) throw new Error('Opening files in another app is not available here');
    const response = await sessionReadFileWhole(sessionId, path);
    if (!response.success || !response.content) throw new Error(response.error || 'The file could not be read');
    const name = path.split(/[\\/]/).pop() || 'file';
    const directory = `${cacheDirectory}shared-files/${Date.now()}/`;
    await makeDirectoryAsync(directory, { intermediates: true });
    const uri = directory + name;
    await writeAsStringAsync(uri, response.content, { encoding: EncodingType.Base64 });
    const extension = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
    return { uri, name, mimeType: MIME_TYPES[extension] ?? 'application/octet-stream' };
}

/**
 * Brings one file from the computer running the session onto this phone and
 * hands it to the system's share sheet: send it in a message, save it to Files,
 * AirDrop it. The copy lives in the app's cache, under the file's own name,
 * which is what the receiving app shows.
 */
export async function sessionFileShare(sessionId: string, path: string): Promise<void> {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available here');
    const file = await sessionFileCopy(sessionId, path);
    await Sharing.shareAsync(file.uri, { mimeType: file.mimeType, dialogTitle: file.name });
}

/**
 * Opens one file from the session in another app on this phone.
 *
 * Android has an open-with of its own, separate from sending: the file is
 * offered to every app that views its kind, through a content address it may
 * read. iOS has no such sheet apart from sharing — "Open in …" is a row of the
 * share sheet — so there it is the share sheet, which is where people look.
 */
export async function sessionFileOpenInApp(sessionId: string, path: string): Promise<void> {
    if (Platform.OS !== 'android') return sessionFileShare(sessionId, path);
    const file = await sessionFileCopy(sessionId, path);
    const contentUri = await getContentUriAsync(file.uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: file.mimeType,
        // FLAG_GRANT_READ_URI_PERMISSION: the viewing app may read this one file.
        flags: 1,
    });
}
