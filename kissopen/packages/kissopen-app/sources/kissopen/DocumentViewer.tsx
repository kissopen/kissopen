import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { t } from '@/text';
import { api } from './api/client';
import type { DocumentPDF } from './api/types';
import { serverOrigin } from './platform/transport';

/** How a file is previewed: drawn as a PDF, converted to one first, or shown as a picture. */
export type DocumentPreviewKind = 'pdf' | 'office' | 'image';

const OFFICE = new Set([
    'doc', 'docx', 'docm', 'dot', 'dotx', 'rtf', 'odt', 'wps', 'wpt',
    'xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'ods', 'et', 'ett',
    'ppt', 'pptx', 'pptm', 'pps', 'ppsx', 'pot', 'potx', 'odp', 'dps', 'dpt',
]);
const IMAGE_TYPES: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    bmp: 'image/bmp', heic: 'image/heic', heif: 'image/heif',
    // Drawn by the same image view as a photo: it reads SVG on iOS and Android alike.
    svg: 'image/svg+xml',
};

/** Whether this file has a preview here, and which, from its name. */
export function documentPreviewKind(name: string): DocumentPreviewKind | null {
    const extension = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
    if (extension === 'pdf') return 'pdf';
    if (OFFICE.has(extension)) return 'office';
    if (extension in IMAGE_TYPES) return 'image';
    return null;
}

type Shown =
    | { readonly status: 'reading' }
    | { readonly status: 'converting' }
    | { readonly status: 'pdf'; readonly pdf: string }
    | { readonly status: 'image'; readonly uri: string }
    | { readonly status: 'error'; readonly message: string };

/**
 * One document, shown inside the app.
 *
 * A PDF is drawn page by page in the server's viewer page, a web view the
 * document is handed to by message, never by address. A Word, Excel,
 * PowerPoint or WPS file is sent to the account's server first and shown as the
 * PDF that comes back, so every format looks the same on every phone. A picture
 * is shown as itself. The bytes come from whoever the caller reads them from.
 */
export const DocumentViewer = React.memo(function DocumentViewer(props: {
    name: string;
    /** The file's bytes, base64-encoded. */
    load: () => Promise<string>;
}) {
    const { theme } = useUnistyles();
    const kind = documentPreviewKind(props.name);
    const [shown, setShown] = React.useState<Shown>({ status: 'reading' });
    const [attempt, setAttempt] = React.useState(0);
    const webView = React.useRef<WebView>(null);
    const pageReady = React.useRef(false);
    const pdfRef = React.useRef<string | null>(null);
    const { load, name } = props;

    const send = React.useCallback(() => {
        if (pageReady.current && pdfRef.current !== null)
            webView.current?.postMessage(JSON.stringify({ type: 'pdf', data: pdfRef.current }));
    }, []);

    React.useEffect(() => {
        let alive = true;
        setShown({ status: 'reading' });
        pdfRef.current = null;
        void (async () => {
            const data = await load();
            if (!alive) return;
            if (kind === 'image') {
                const extension = name.split('.').pop()!.toLowerCase();
                setShown({ status: 'image', uri: `data:${IMAGE_TYPES[extension]};base64,${data}` });
                return;
            }
            let pdf = data;
            if (kind === 'office') {
                setShown({ status: 'converting' });
                pdf = (await api<DocumentPDF>('/documents/pdf', 'POST', { name, data })).pdf;
                if (!alive) return;
            }
            pdfRef.current = pdf;
            setShown({ status: 'pdf', pdf });
            send();
        })().catch((error: unknown) => {
            if (alive) setShown({ status: 'error', message: error instanceof Error ? error.message : String(error) });
        });
        return () => { alive = false; };
    }, [load, name, kind, attempt, send]);

    const onMessage = React.useCallback((event: WebViewMessageEvent) => {
        let message: { type?: string; message?: string };
        try {
            message = JSON.parse(event.nativeEvent.data);
        } catch {
            return;
        }
        if (message.type === 'ready') {
            pageReady.current = true;
            send();
        } else if (message.type === 'error') {
            setShown({ status: 'error', message: message.message ?? '' });
        }
    }, [send]);

    if (shown.status === 'image')
        return (
            <ScrollView
                style={styles.stage}
                contentContainerStyle={styles.imageStage}
                maximumZoomScale={5}
                minimumZoomScale={1}
                centerContent
            >
                <Image source={{ uri: shown.uri }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
            </ScrollView>
        );

    return (
        <View style={styles.stage}>
            {/* The page loads while the file is still being read or converted, so the
                document shows the moment it arrives. */}
            {kind !== 'image' && shown.status !== 'error' && (
                <WebView
                    ref={webView}
                    source={{ uri: `${serverOrigin}/api/viewer/pdf.html` }}
                    onMessage={onMessage}
                    originWhitelist={[serverOrigin]}
                    style={[styles.web, shown.status !== 'pdf' && styles.hidden]}
                    javaScriptEnabled
                    allowsBackForwardNavigationGestures={false}
                    setSupportMultipleWindows={false}
                    onError={() => setShown({ status: 'error', message: t('files.previewFailed') })}
                />
            )}
            {shown.status !== 'pdf' && (
                <View style={styles.notice}>
                    {shown.status === 'error' ? (
                        <>
                            <Text style={styles.noticeTitle}>{t('files.previewFailed')}</Text>
                            <Text style={styles.noticeDetail}>{shown.message}</Text>
                            <Pressable
                                accessibilityRole="button"
                                onPress={() => {
                                    pageReady.current = false;
                                    setAttempt((value) => value + 1);
                                }}
                                style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
                            >
                                <Text style={styles.retryText}>{t('common.retry')}</Text>
                            </Pressable>
                        </>
                    ) : (
                        <>
                            <ActivityIndicator color={theme.colors.textSecondary} />
                            <Text style={styles.noticeDetail}>
                                {shown.status === 'converting' ? t('files.previewConverting') : t('files.previewReading')}
                            </Text>
                        </>
                    )}
                </View>
            )}
        </View>
    );
});

const styles = StyleSheet.create((theme) => ({
    stage: {
        flex: 1,
        backgroundColor: theme.colors.surface,
    },
    imageStage: {
        flexGrow: 1,
    },
    web: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    hidden: {
        opacity: 0,
    },
    notice: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        backgroundColor: theme.colors.surface,
    },
    noticeTitle: {
        fontSize: 17,
        color: theme.colors.text,
        textAlign: 'center',
        ...Typography.default('semiBold'),
    },
    noticeDetail: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        ...Typography.default(),
    },
    retry: {
        marginTop: 4,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: theme.colors.surfaceHigh,
    },
    retryText: {
        fontSize: 15,
        color: theme.colors.text,
        ...Typography.default('semiBold'),
    },
    pressed: {
        opacity: 0.7,
    },
}));
