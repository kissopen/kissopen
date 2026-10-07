import * as React from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { GlassPanel } from './GlassControl';
import { t } from '@/text';

const PANEL_RADIUS = 28;

type FileAction = 'share' | 'openWith';

/**
 * The file viewer's "more": a ⋯ in the header that drops down what can be done
 * with the file beyond looking at it — share it, or open it in another app.
 * Drawn like the conversation menu, so the two read as one family. Whichever
 * action runs keeps the button busy until the system sheet takes over.
 */
export function FileActionsMenu(props: {
    onShare: () => Promise<void>;
    onOpenWith: () => Promise<void>;
}) {
    const { theme } = useUnistyles();
    const insets = useSafeAreaInsets();
    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);

    const choose = (action: FileAction) => {
        setOpen(false);
        setBusy(true);
        void (action === 'share' ? props.onShare() : props.onOpenWith()).finally(() => setBusy(false));
    };
    const rows: { action: FileAction; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
        { action: 'share', label: t('files.share'), icon: Platform.OS === 'android' ? 'share-social-outline' : 'share-outline' },
        { action: 'openWith', label: t('files.openInApp'), icon: 'open-outline' },
    ];

    return (
        <>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('files.moreActions')}
                disabled={busy}
                hitSlop={10}
                onPress={() => setOpen(true)}
            >
                {busy
                    ? <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                    : <Ionicons name={Platform.OS === 'android' ? 'ellipsis-vertical' : 'ellipsis-horizontal'} size={22} color={theme.colors.header.tint} />}
            </Pressable>
            <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
                <View style={styles.root}>
                    <Pressable accessibilityLabel={t('kissopen.nav.closeMenu')} style={styles.backdrop} onPress={() => setOpen(false)} />
                    <View style={[styles.panelLift, { top: insets.top + 52 }]}>
                        <GlassPanel style={styles.panel} fallbackColor={Platform.OS === 'android' ? theme.colors.surfaceHigh : undefined}>
                            {rows.map(row => (
                                <Pressable key={row.action} accessibilityRole="button" onPress={() => choose(row.action)}
                                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                                    <Ionicons name={row.icon} size={22} color={theme.colors.text} />
                                    <Text style={styles.rowText}>{row.label}</Text>
                                </Pressable>
                            ))}
                        </GlassPanel>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create(theme => ({
    root: { flex: 1 },
    backdrop: { ...StyleSheet.absoluteFillObject },
    panelLift: {
        position: 'absolute', right: 12, width: 240, maxWidth: '92%', borderRadius: PANEL_RADIUS,
        shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 16,
    },
    panel: {
        width: '100%', paddingVertical: 8, paddingHorizontal: 6, borderRadius: PANEL_RADIUS,
        alignItems: 'stretch', justifyContent: 'flex-start',
    },
    row: { minHeight: 52, borderRadius: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
    pressed: { backgroundColor: theme.colors.surfaceRipple },
    rowText: { fontSize: 17, color: theme.colors.text },
}));
