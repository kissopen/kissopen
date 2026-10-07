import * as React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { StyleSheet } from 'react-native-unistyles';
import { layout } from '@/components/layout';
import type { MessageImage } from './api/types';
import { t } from '@/text';
import { KissopenLoader } from './KissopenLoader';

const WIDTH = 260;

/**
 * The pictures a cloud message carries, under its text. Each keeps the box its
 * own size calls for from the start, with a spinner until the bytes arrive, so
 * the transcript does not jump when a picture loads. Tapping one shows it whole.
 */
export function CloudMessageImages(props: { images: readonly MessageImage[]; own: boolean }) {
    const [open, setOpen] = React.useState<MessageImage>();
    // Older servers sent no address; there is nothing to load for those.
    const images = props.images.filter(image => image.url);
    if (!images.length) return null;
    return (
        <View style={styles.row}>
            <View style={[styles.column, props.own ? styles.own : styles.other]}>
                {images.map(image => <CloudMessageImage key={image.id} image={image} onOpen={() => setOpen(image)} />)}
            </View>
            <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(undefined)}>
                <Pressable accessibilityRole="button" accessibilityLabel={t('kissopen.conversation.closeImage')} style={styles.viewer} onPress={() => setOpen(undefined)}>
                    {open && <Image source={{ uri: open.url }} style={styles.full} contentFit="contain" />}
                </Pressable>
            </Modal>
        </View>
    );
}

function CloudMessageImage(props: { image: MessageImage; onOpen: () => void }) {
    const [loaded, setLoaded] = React.useState(false);
    const ratio = props.image.width > 0 && props.image.height > 0 ? props.image.height / props.image.width : 1;
    const height = Math.round(WIDTH * Math.min(Math.max(ratio, 0.4), 2));
    return (
        <Pressable accessibilityRole="imagebutton" accessibilityLabel={t('kissopen.conversation.viewImage', { name: props.image.name })} onPress={props.onOpen} style={[styles.tile, { width: WIDTH, height }]}>
            <Image source={{ uri: props.image.url }} style={styles.fill} contentFit="cover" transition={180} onLoad={() => setLoaded(true)} />
            {!loaded && <View style={styles.loading}><KissopenLoader size={20} /></View>}
        </Pressable>
    );
}

/** The box a picture being drawn will fill, said in words as well as shown. */
export function CloudDrawing() {
    return (
        <View style={styles.row}>
            <View style={[styles.column, styles.other]}>
                <View accessibilityRole="progressbar" accessibilityLabel={t('kissopen.conversation.generatingImage')} style={[styles.tile, { width: WIDTH, height: WIDTH }]}>
                    <View style={styles.loading}><KissopenLoader size={28} /><Text style={styles.caption}>{t('kissopen.conversation.generatingImageCaption')}</Text></View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    caption: { marginTop: 8, color: theme.colors.textSecondary, fontSize: 13 },
    row: { flexDirection: 'row', justifyContent: 'center' },
    column: { flexGrow: 1, flexBasis: 0, maxWidth: layout.maxWidth, paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
    own: { alignItems: 'flex-end' },
    other: { alignItems: 'flex-start' },
    tile: { maxWidth: '100%', borderRadius: 14, overflow: 'hidden', backgroundColor: theme.colors.surfaceHigh },
    fill: { width: '100%', height: '100%' },
    loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
    full: { width: '100%', height: '100%' },
}));
