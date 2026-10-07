import { NativeScrollEvent, NativeSyntheticEvent, Platform } from 'react-native';
import { openExternalUrl } from '@/utils/openExternalUrl';
import * as React from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '@/auth/AuthContext';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { useConnectTerminal } from '@/hooks/useConnectTerminal';
import { useLocalSettingMutable } from '@/sync/storage';
import { Modal } from '@/modal';
import { useMultiClick } from '@/hooks/useMultiClick';
import { useUnistyles } from 'react-native-unistyles';
import { t } from '@/text';
import { getServerUrl } from '@/sync/serverConfig';
import { KissopenProfileHeader } from '@/kissopen/KissopenProfileHeader';

/** Shared account sections, rendered directly inside the Me page's list. */
export const SettingsSections = React.memo(function SettingsSections() {
    const { theme } = useUnistyles();
    const router = useRouter();
    const appVersion = Constants.expoConfig?.version || '1.0.0';
    const auth = useAuth();
    const [devModeEnabled, setDevModeEnabled] = useLocalSettingMutable('devModeEnabled');

    const { connectTerminal, connectWithUrl, isLoading } = useConnectTerminal();

    // Use the multi-click hook for version clicks
    const handleVersionClick = useMultiClick(() => {
        // Toggle dev mode
        const newDevMode = !devModeEnabled;
        setDevModeEnabled(newDevMode);
        Modal.alert(
            t('modals.developerMode'),
            newDevMode ? t('modals.developerModeEnabled') : t('modals.developerModeDisabled')
        );
    }, {
        requiredClicks: 10,
        resetTimeout: 2000
    });

    return (

        <>
            {/* Connect Terminal - Only show on native platforms */}
            {Platform.OS !== 'web' && auth.isAuthenticated && !auth.credentials?.kissopenUserId && (
                <ItemGroup>
                    <Item
                        title={t('settings.scanQrCodeToAuthenticate')}
                        icon={<Ionicons name="qr-code-outline" size={29} color={theme.colors.home.accent} />}
                        onPress={connectTerminal}
                        loading={isLoading}
                        showChevron={false}
                    />
                    <Item
                        title={t('connect.enterUrlManually')}
                        icon={<Ionicons name="link-outline" size={29} color={theme.colors.home.accent} />}
                        onPress={async () => {
                            const url = await Modal.prompt(
                                t('modals.authenticateTerminal'),
                                t('modals.pasteUrlFromTerminal'),
                                {
                                    placeholder: 'kissopen://terminal?...',
                                    confirmText: t('common.authenticate')
                                }
                            );
                            if (url?.trim()) {
                                connectWithUrl(url.trim());
                            }
                        }}
                        showChevron={false}
                    />
                </ItemGroup>
            )}

            {/* Developer */}
            {(__DEV__ || devModeEnabled) && (
                <ItemGroup title={t('settings.developer')}>
                    <Item
                        title={t('settings.developerTools')}
                        icon={<Ionicons name="construct-outline" size={29} color={theme.colors.home.accent} />}
                        onPress={() => router.push('/dev')}
                    />
                </ItemGroup>
            )}

            <ItemGroup title={t('kissopen.about.title')}>
                <Item title={t('kissopen.about.website')} icon={<Ionicons name="globe-outline" size={29} color={theme.colors.textSecondary} />} onPress={() => openExternalUrl(getServerUrl())} />
                <Item title={t('settings.whatsNew')} subtitle={t('kissopen.settings.changelogSubtitle')} icon={<Ionicons name="sparkles-outline" size={29} color={theme.colors.textSecondary} />} onPress={() => router.push('/settings/about/updates')} />
                <Item title={t('settings.reportIssue')} subtitle={t('kissopen.settings.reportIssueSubtitle')} icon={<Ionicons name="chatbubble-ellipses-outline" size={29} color={theme.colors.textSecondary} />} onPress={() => router.push('/settings/about/feedback')} />
                <Item title={t('settings.privacyPolicy')} icon={<Ionicons name="shield-checkmark-outline" size={29} color={theme.colors.textSecondary} />} onPress={() => router.push('/settings/about/privacy')} />
                <Item title={t('kissopen.about.userGuide')} icon={<Ionicons name="document-text-outline" size={29} color={theme.colors.textSecondary} />} onPress={() => router.push('/settings/about/usage')} />
                <Item title={t('kissopen.about.licenses')} icon={<Ionicons name="code-slash-outline" size={29} color={theme.colors.textSecondary} />} onPress={() => router.push('/settings/about/licenses')} />
                <Item title={t('common.version')} detail={appVersion} icon={<Ionicons name="information-circle-outline" size={29} color={theme.colors.textSecondary} />} onPress={handleVersionClick} showChevron={false} />
            </ItemGroup>

            {auth.isAuthenticated && <ItemGroup>
                <Item title={t('common.logout')} destructive showChevron={false}
                    icon={<Ionicons name="log-out-outline" size={29} color={theme.colors.textDestructive} />}
                    onPress={() => void auth.logout()} />
            </ItemGroup>}

        </>
    );
});

/** Retain the legacy route without duplicating account controls or scroll views. */
export const SettingsView = React.memo(function SettingsView({
    topContentInset = 0,
    bottomContentInset = 0,
    onScroll,
}: {
    topContentInset?: number;
    bottomContentInset?: number;
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
    const router = useRouter();
    const { theme } = useUnistyles();
    return <ItemList
        style={{ paddingTop: 0 }}
        containerStyle={{ paddingTop: topContentInset, paddingBottom: bottomContentInset }}
        onScroll={onScroll}
        scrollEventThrottle={16}
    >
        <KissopenProfileHeader />
        <ItemGroup>
            <Item title={t('kissopen.settings.account')} icon={<Ionicons name="person-circle-outline" size={29} color={theme.colors.home.accent} />} onPress={() => router.push('/settings/account')} />
            <Item title={t('terminal.security')} icon={<Ionicons name="shield-checkmark-outline" size={29} color={theme.colors.home.accent} />} onPress={() => router.push('/settings/security')} />
            <Item title={t('kissopen.workStart.devices')} icon={<Ionicons name="desktop-outline" size={29} color={theme.colors.home.accent} />} onPress={() => router.push('/devices/connect')} />
            <Item title={t('settings.appearance')} icon={<Ionicons name="color-palette-outline" size={29} color={theme.colors.home.accent} />} onPress={() => router.push('/settings/appearance')} />
            <Item title={t('settingsLanguage.title')} icon={<Ionicons name="language-outline" size={29} color={theme.colors.home.accent} />} onPress={() => router.push('/settings/language')} />
        </ItemGroup>
        <SettingsSections />
    </ItemList>;
});
