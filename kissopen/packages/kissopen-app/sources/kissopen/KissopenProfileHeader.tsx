import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Avatar } from '@/components/Avatar';
import { layout } from '@/components/layout';
import { Typography } from '@/constants/Typography';
import { Modal } from '@/modal';
import { t } from '@/text';
import { client } from './api/client';
import type { ProfileUser } from './api/types';
import { base64FromUri } from './cloudImage';

/** The server keeps avatars as a square it serves at up to this edge. */
const AVATAR_EDGE = 512;

const profileName = (user: ProfileUser) => user.display_name || user.username || user.phone;

/**
 * The account page header: the avatar and name, with a pencil on the
 * avatar that opens the profile editor. Signed out, it draws nothing; the
 * account section below already offers sign-in.
 */
export const KissopenProfileHeader = React.memo(function KissopenProfileHeader() {
    const { theme } = useUnistyles();
    const [user, setUser] = React.useState<ProfileUser>();
    useFocusEffect(React.useCallback(() => {
        let alive = true;
        void client.profile()
            .then(profile => { if (alive) setUser(profile.user); })
            .catch(() => { if (alive) setUser(undefined); });
        return () => { alive = false; };
    }, []));
    if (!user) return null;
    const edit = () => Modal.show({ component: ProfileEditor, props: { user, onSaved: setUser } });
    return <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('kissopen.profile.edit')} onPress={edit} style={styles.avatarButton}>
            <Avatar id={user.id} size={96} imageUrl={user.avatar_url || null} />
            <View style={[styles.badge, { backgroundColor: theme.colors.surfaceHighest, borderColor: theme.colors.groupped.background }]}>
                <Ionicons name="pencil" size={15} color={theme.colors.text} />
            </View>
        </Pressable>
        <Text style={styles.name} numberOfLines={1}>{profileName(user)}</Text>
        {!!user.username && !!user.display_name && <Text style={styles.username} numberOfLines={1}>@{user.username}</Text>}
    </View>;
});

type PickedAvatar = { uri: string; data: string };

/** The profile editor: a new avatar, the name, and the username, saved together. */
function ProfileEditor({ user, onSaved, onClose }: { user: ProfileUser; onSaved: (user: ProfileUser) => void; onClose: () => void }) {
    const { theme } = useUnistyles();
    const [name, setName] = React.useState(user.display_name);
    const [username, setUsername] = React.useState(user.username);
    const [avatar, setAvatar] = React.useState<PickedAvatar>();
    const [picking, setPicking] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState('');

    const pick = async () => {
        if (picking || saving) return;
        setPicking(true);
        setError('');
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 1,
            });
            const asset = result.canceled ? undefined : result.assets[0];
            if (!asset) return;
            // The system cropper returns a square; web has none, so crop the
            // centre square here before it is sized down for upload.
            const edge = Math.min(asset.width, asset.height);
            const crop = asset.width === asset.height ? [] : [{
                crop: { originX: (asset.width - edge) / 2, originY: (asset.height - edge) / 2, width: edge, height: edge },
            }];
            const image = await manipulateAsync(asset.uri, [...crop, { resize: { width: AVATAR_EDGE, height: AVATAR_EDGE } }], {
                compress: 0.85,
                format: SaveFormat.JPEG,
            });
            setAvatar({ uri: image.uri, data: await base64FromUri(image.uri) });
        } catch {
            setError(t('kissopen.profile.photoFailed'));
        } finally {
            setPicking(false);
        }
    };

    const save = async () => {
        if (saving) return;
        setSaving(true);
        setError('');
        try {
            let saved = user;
            if (avatar) {
                saved = await client.avatarUpload('image/jpeg', avatar.data);
                // Kept even if the name below is refused, so the header shows it.
                onSaved(saved);
                setAvatar(undefined);
            }
            const nextName = name.trim();
            if (nextName !== user.display_name || username !== user.username)
                saved = await client.profileUpdate({ display_name: nextName, username });
            onSaved(saved);
            onClose();
        } catch (e) {
            setError(e instanceof Error && e.message ? e.message : t('kissopen.profile.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    const inputStyle = [styles.input, { color: theme.colors.text, borderColor: theme.colors.divider }];
    return <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.divider }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('kissopen.profile.changePhoto')} onPress={pick} style={styles.editorAvatar}>
            <Avatar id={user.id} size={128} imageUrl={avatar?.uri ?? (user.avatar_url || null)} />
            <View style={[styles.cameraBadge, { backgroundColor: theme.colors.text }]}>
                {picking
                    ? <ActivityIndicator size="small" color={theme.colors.surface} />
                    : <Ionicons name="camera-outline" size={18} color={theme.colors.surface} />}
            </View>
        </Pressable>
        <Text style={styles.label}>{t('kissopen.profile.name')}</Text>
        <TextInput
            value={name}
            onChangeText={setName}
            maxLength={40}
            placeholder={t('kissopen.profile.name')}
            placeholderTextColor={theme.colors.input.placeholder}
            style={inputStyle}
            editable={!saving}
        />
        <Text style={styles.label}>{t('kissopen.profile.username')}</Text>
        <View style={[styles.input, styles.usernameRow, { borderColor: theme.colors.divider }]}>
            <Text style={[styles.at, { color: theme.colors.textSecondary }]}>@</Text>
            <TextInput
                value={username}
                onChangeText={value => setUsername(value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                maxLength={20}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t('kissopen.profile.usernamePlaceholder')}
                placeholderTextColor={theme.colors.input.placeholder}
                style={[styles.usernameInput, { color: theme.colors.text }]}
                editable={false}
            />
        </View>
        <Text style={styles.hint}>{t('kissopen.security.usernameHint')}</Text>
        <Text style={[styles.hint, !!error && { color: theme.colors.textDestructive }]}>{error || t('kissopen.profile.hint')}</Text>
        <Pressable
            accessibilityRole="button"
            onPress={save}
            disabled={saving || picking}
            style={({ pressed }) => [styles.save, { backgroundColor: theme.colors.text, opacity: pressed || saving ? 0.7 : 1 }]}
        >
            {saving
                ? <ActivityIndicator size="small" color={theme.colors.surface} />
                : <Text style={[styles.saveText, { color: theme.colors.surface }]}>{t('kissopen.profile.save')}</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onClose} disabled={saving} style={styles.cancel}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
    </View>;
}

const styles = StyleSheet.create(theme => ({
    header: {
        alignItems: 'center',
        paddingTop: 24,
        paddingBottom: 8,
        gap: 6,
        width: '100%',
        maxWidth: layout.maxWidth,
        alignSelf: 'center',
    },
    avatarButton: {
        marginBottom: 6,
    },
    badge: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 3,
        alignItems: 'center',
        justifyContent: 'center',
    },
    name: {
        color: theme.colors.text,
        fontSize: 20,
        maxWidth: '80%',
        ...Typography.default('semiBold'),
    },
    username: {
        color: theme.colors.textSecondary,
        fontSize: 14,
        ...Typography.default(),
    },
    card: {
        width: 360,
        maxWidth: '92%',
        alignSelf: 'center',
        borderRadius: 28,
        borderWidth: Platform.OS === 'web' ? 1 : 0.5,
        paddingHorizontal: 20,
        paddingTop: 28,
        paddingBottom: 12,
    },
    editorAvatar: {
        alignSelf: 'center',
        marginBottom: 20,
    },
    cameraBadge: {
        position: 'absolute',
        right: 2,
        bottom: 2,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        color: theme.colors.textSecondary,
        fontSize: 13,
        marginBottom: 8,
        marginLeft: 16,
        ...Typography.default(),
    },
    input: {
        height: 50,
        borderRadius: 25,
        borderWidth: 1,
        paddingHorizontal: 18,
        fontSize: 16,
        marginBottom: 16,
        ...Typography.default(),
    },
    usernameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    at: {
        fontSize: 16,
        marginRight: 2,
        ...Typography.default(),
    },
    usernameInput: {
        flex: 1,
        height: '100%',
        fontSize: 16,
        padding: 0,
        ...Typography.default(),
    },
    hint: {
        color: theme.colors.textSecondary,
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 20,
        ...Typography.default(),
    },
    save: {
        alignSelf: 'center',
        minWidth: 180,
        height: 50,
        borderRadius: 25,
        paddingHorizontal: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveText: {
        fontSize: 17,
        ...Typography.default('semiBold'),
    },
    cancel: {
        alignSelf: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
    },
    cancelText: {
        color: theme.colors.text,
        fontSize: 16,
        ...Typography.default(),
    },
}));
