import * as React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { cacheDirectory, EncodingType, makeDirectoryAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { GeneratingImage, imageGenerationProgress } from '@/components/GeneratingImage';
import { Modal as Dialog } from '@/modal';
import { sessionReadFile } from '@/sync/ops';
import type { ImageGenerationPresentation } from '@/sync/typesMessage';
import { t } from '@/text';
import { ToolViewProps } from './_all';

/** The square a picture on its way occupies, and the longest side of one that arrived. */
const SIDE = 280;

/**
 * An image-generation call: a halftone field with an estimate while the
 * picture is coming, and the picture itself once it has.
 *
 * The estimate is made from how long the call has run — generation reports
 * nothing while it works — and the field fills in as it climbs, never
 * reaching the end on its own. The picture travels with the result as a small
 * preview, so it is drawn the moment the call completes and sized from its own
 * dimensions, at the width the field held, so nothing jumps. Tapping it opens
 * it full screen, where the full-resolution file is read from the machine that
 * made it and can be saved.
 */
export const ImageGenerationView = React.memo<ToolViewProps>(({ tool, sessionId }) => {
    const picture = tool.presentation?.type === 'image_generation' ? tool.presentation : undefined;
    const running = tool.state === 'running';
    const [open, setOpen] = React.useState(false);
    // A clock for the estimate, ticking only while there is something to time.
    const [now, setNow] = React.useState(() => Date.now());
    React.useEffect(() => {
        if (!running) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [running]);

    if (picture) {
        const scale = SIDE / Math.max(picture.width, picture.height);
        const width = Math.max(1, Math.round(picture.width * scale));
        const height = Math.max(1, Math.round(picture.height * scale));
        const preview = `data:image/webp;base64,${picture.preview}`;
        return (
            <View style={styles.container}>
                <Pressable
                    accessibilityRole="imagebutton"
                    accessibilityLabel={t('kissopen.picture.enlarge')}
                    onPress={() => setOpen(true)}
                    style={({ pressed }) => [pressed && { opacity: 0.85 }]}
                >
                    <Image
                        source={{ uri: preview }}
                        style={[styles.picture, { width, height }]}
                        contentFit="cover"
                        transition={200}
                        accessibilityIgnoresInvertColors
                    />
                </Pressable>
                {open && <PictureViewer picture={picture} preview={preview} sessionId={sessionId} onClose={() => setOpen(false)} />}
            </View>
        );
    }
    if (!running) return null;
    const progress = imageGenerationProgress(now - (tool.startedAt ?? tool.createdAt));
    return (
        <View style={styles.container}>
            <GeneratingImage
                progress={progress}
                label={`${Math.round(progress * 100)}%`}
                width={SIDE}
                height={SIDE}
            />
        </View>
    );
});

/**
 * The picture full screen, with a way to keep it.
 *
 * Opens on the preview at once and swaps in the full file when the machine
 * that made it answers; saving hands the file to the system's share sheet,
 * which on a phone is where "save to Photos" lives. If the full file cannot be
 * read, the preview is what is shown and saved, and nothing pretends otherwise.
 */
function PictureViewer(props: {
    picture: ImageGenerationPresentation;
    preview: string;
    sessionId?: string;
    onClose: () => void;
}) {
    const { theme } = useUnistyles();
    const insets = useSafeAreaInsets();
    const [full, setFull] = React.useState<string>();
    const [saving, setSaving] = React.useState(false);
    React.useEffect(() => {
        let cancelled = false;
        if (!props.sessionId) return;
        void sessionReadFile(props.sessionId, props.picture.path).then(response => {
            if (cancelled || !response.success || !response.content) return;
            setFull(response.content);
        });
        return () => { cancelled = true; };
    }, [props.sessionId, props.picture.path]);

    const save = async () => {
        if (saving) return;
        setSaving(true);
        try {
            if (!cacheDirectory || !(await Sharing.isAvailableAsync())) throw new Error('unavailable');
            const bytes = full ?? props.picture.preview;
            const extension = full ? (props.picture.mediaType === 'image/jpeg' ? 'jpg' : 'png') : 'webp';
            const name = `${(props.picture.path.split(/[\\/]/).pop() ?? 'picture').replace(/\.[^.]+$/, '')}.${extension}`;
            const directory = `${cacheDirectory}shared-files/${Date.now()}/`;
            await makeDirectoryAsync(directory, { intermediates: true });
            const uri = directory + name;
            await writeAsStringAsync(uri, bytes, { encoding: EncodingType.Base64 });
            await Sharing.shareAsync(uri, { mimeType: full ? props.picture.mediaType : 'image/webp', dialogTitle: name });
        } catch {
            Dialog.alert(t('common.error'), t('kissopen.picture.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal visible animationType="fade" onRequestClose={props.onClose} statusBarTranslucent>
            <View style={styles.viewer}>
                <Image
                    source={{ uri: full ? `data:${props.picture.mediaType};base64,${full}` : props.preview }}
                    style={styles.viewerImage}
                    contentFit="contain"
                    transition={150}
                    accessibilityIgnoresInvertColors
                />
                <View style={[styles.viewerBar, { paddingTop: insets.top + 8 }]}>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={props.onClose} style={styles.viewerButton}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('kissopen.picture.save')} onPress={() => void save()} style={styles.viewerButton} disabled={saving}>
                        <Ionicons name="download-outline" size={24} color={saving ? theme.colors.textSecondary : '#fff'} />
                    </Pressable>
                </View>
                {!full && !!props.sessionId && (
                    <Text style={[styles.viewerHint, { bottom: insets.bottom + 16 }]}>{t('kissopen.picture.loadingFull')}</Text>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create(theme => ({
    container: { paddingHorizontal: 12, paddingVertical: 8 },
    picture: { borderRadius: 12, backgroundColor: theme.colors.surface },
    viewer: { flex: 1, backgroundColor: '#000' },
    viewerImage: { flex: 1 },
    viewerBar: {
        position: 'absolute', left: 0, right: 0, top: 0,
        flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12,
    },
    viewerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)' },
    viewerHint: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 13 },
}));
