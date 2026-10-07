import * as React from 'react';
import { Alert, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { GlassPanel } from './GlassControl';
import type { ConversationDetail } from './api/types';
import { t } from '@/text';

/** Shared by the lift and the material, which have to agree on the shape. */
const PANEL_RADIUS = 28;

type Action = 'rename' | 'pin' | 'archive' | 'delete';

/**
 * What can be done to the open conversation, from the capsule's "more" — the
 * same four things the desktop menu offers. It drops down from the capsule that
 * opened it, headed by the conversation's title, so the reader sees which
 * conversation they are about to change. Renaming happens in the menu itself;
 * deleting asks first, because it cannot be undone.
 */
export function ConversationMenu(props: {
    conversation: ConversationDetail | undefined;
    open: boolean;
    /** Where the header ends, status bar included; the menu hangs just below it. */
    top: number;
    onClose: () => void;
    onRename: (title: string) => Promise<void>;
    onPin: (pinned: boolean) => Promise<void>;
    onArchive: () => Promise<void>;
    onDelete: () => Promise<void>;
}) {
    const { theme } = useUnistyles();
    const [renaming, setRenaming] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');
    const pinned = !!props.conversation?.pinned;

    const close = () => { setRenaming(false); setError(''); props.onClose(); };
    const run = async (action: () => Promise<void>) => {
        setBusy(true); setError('');
        try { await action(); close(); } catch (e) { setError(e instanceof Error ? e.message : t('kissopen.menu.actionFailed')); } finally { setBusy(false); }
    };
    const choose = (action: Action) => {
        if (action === 'rename') { setTitle(props.conversation?.title ?? ''); setRenaming(true); return; }
        if (action === 'pin') return void run(() => props.onPin(!pinned));
        if (action === 'archive') return void run(props.onArchive);
        Alert.alert(t('kissopen.menu.deleteTitle'), t('kissopen.menu.deleteDescription'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('common.delete'), style: 'destructive', onPress: () => void run(props.onDelete) },
        ]);
    };
    const rows: { action: Action; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; danger?: boolean }[] = [
        { action: 'rename', label: t('common.rename'), icon: 'pencil-outline' },
        { action: 'pin', label: pinned ? t('kissopen.menu.unpin') : t('kissopen.menu.pin'), icon: pinned ? 'pin' : 'pin-outline' },
        { action: 'archive', label: t('kissopen.menu.archive'), icon: 'archive-outline' },
        { action: 'delete', label: t('common.delete'), icon: 'trash-outline', danger: true },
    ];

    return (
        // Drawn under the status bar on Android too, so `top` measures from
        // the same edge the header does.
        <Modal visible={props.open} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
            <View style={styles.root}>
                <Pressable accessibilityLabel={t('kissopen.nav.closeMenu')} style={styles.backdrop} onPress={close} />
                <View style={[styles.panelLift, { top: props.top + 4 }]}>
                    {/* Inert glass: the rows and the rename field own their own
                        touches, and interactive glass would take the responder
                        away from the TextInput. On Android the menu is its own
                        window, where the blur cannot see the conversation
                        behind it; the glass would be a faint tint over crisp
                        text, so the panel is opaque there. */}
                    <GlassPanel style={styles.panel} fallbackColor={Platform.OS === 'android' ? theme.colors.surfaceHigh : undefined}>
                        {renaming ? <>
                            <Text style={styles.heading}>{t('kissopen.menu.renameTitle')}</Text>
                            <TextInput style={styles.field} value={title} onChangeText={setTitle} autoFocus maxLength={200} editable={!busy}
                                placeholder={t('kissopen.menu.conversationName')} placeholderTextColor={theme.colors.textSecondary} accessibilityLabel={t('kissopen.menu.conversationName')}
                                onSubmitEditing={() => { if (title.trim()) void run(() => props.onRename(title.trim())); }} />
                            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
                            <View style={styles.buttons}>
                                <Pressable accessibilityRole="button" style={styles.button} onPress={() => setRenaming(false)} disabled={busy}>
                                    <Text style={styles.buttonText}>{t('common.cancel')}</Text>
                                </Pressable>
                                <Pressable accessibilityRole="button" style={[styles.button, styles.primary]} disabled={busy || !title.trim()}
                                    onPress={() => void run(() => props.onRename(title.trim()))}>
                                    <Text style={[styles.buttonText, styles.primaryText]}>{t('common.save')}</Text>
                                </Pressable>
                            </View>
                        </> : <>
                            {!!props.conversation?.title && <Text numberOfLines={1} style={styles.title}>{props.conversation.title}</Text>}
                            {rows.map(row => (
                                <Pressable key={row.action} accessibilityRole="button" disabled={busy} onPress={() => choose(row.action)}
                                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                                    <Ionicons name={row.icon} size={22} color={row.danger ? theme.colors.textDestructive : theme.colors.text} />
                                    <Text style={[styles.rowText, row.danger && { color: theme.colors.textDestructive }]}>{row.label}</Text>
                                </Pressable>
                            ))}
                            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
                        </>}
                    </GlassPanel>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create(theme => ({
    root: { flex: 1 },
    // A dropdown dims nothing: the conversation stays readable around it.
    backdrop: { ...StyleSheet.absoluteFillObject },
    // Lift and position only. The shadow lives out here because the glass
    // clips itself to PANEL_RADIUS on the blur and Android paths, and a view
    // cannot both clip its contents and cast a shadow.
    panelLift: {
        position: 'absolute', right: 12, width: 280, maxWidth: '92%', borderRadius: PANEL_RADIUS,
        shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 16,
    },
    // GlassSkin centres its children, which would shrink every row to the
    // width of its label; the menu needs them stacked and stretched instead.
    panel: {
        width: '100%', paddingVertical: 8, paddingHorizontal: 6, borderRadius: PANEL_RADIUS,
        alignItems: 'stretch', justifyContent: 'flex-start',
    },
    title: { fontSize: 16, color: theme.colors.textSecondary, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6 },
    row: { minHeight: 56, borderRadius: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
    // A translucent tint, so the press reads the same on the glass and on the
    // opaque Android panel.
    pressed: { backgroundColor: theme.colors.surfaceRipple },
    rowText: { fontSize: 17, color: theme.colors.text },
    heading: { fontSize: 17, color: theme.colors.text, padding: 12, ...Typography.default('semiBold') },
    field: { marginHorizontal: 8, color: theme.colors.text, backgroundColor: theme.colors.input.background, borderRadius: 12, padding: 14, fontSize: 16, minHeight: 48 },
    error: { color: theme.colors.textDestructive, fontSize: 14, paddingHorizontal: 16, paddingVertical: 8 },
    buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 8 },
    button: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    primary: { backgroundColor: theme.colors.text },
    buttonText: { fontSize: 16, color: theme.colors.text, ...Typography.default('semiBold') },
    primaryText: { color: theme.colors.surface },
}));
