import * as React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useUnistyles } from 'react-native-unistyles';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { SettingsSections } from '@/components/SettingsView';
import { KissopenProfileHeader } from './KissopenProfileHeader';
import { KissopenAccountRows } from './KissopenSettingsSection';
import { t } from '@/text';
import { useAuth } from '@/auth/AuthContext';

export type MineDestination = 'persona' | 'history' | 'projects' | 'schedules' | 'plugins' | 'devices' | 'appearance' | 'workspaceAccount' | 'security';

/**
 * The account tab: who is signed in and every place that is not
 * one of the five tabs — what the person said about their work, history,
 * scheduled tasks, plugins, the computers and account controls.
 */
export const MinePage = React.memo(function MinePage(props: {
    topInset: number;
    bottomInset: number;
    onOpen: (destination: MineDestination) => void;
}) {
    const { theme } = useUnistyles();
    const auth = useAuth();
    const icon = (name: keyof typeof Ionicons.glyphMap) => <Ionicons name={name} size={26} color={theme.colors.home.accent} />;
    return (
        <ItemList containerStyle={{ paddingTop: props.topInset + 12, paddingBottom: props.bottomInset + 24 }} contentInsetAdjustmentBehavior="never">
            <KissopenProfileHeader />
            <ItemGroup>
                <KissopenAccountRows />
                <Item title="Security" subtitle="Password, two-factor authentication and third-party sign-in" icon={icon('shield-checkmark-outline')} onPress={() => props.onOpen('security')} />
                <Item title={t('kissopen.persona.mineEntry')} icon={icon('id-card-outline')} onPress={() => props.onOpen('persona')} />
            </ItemGroup>
            <ItemGroup>
                <Item title={t('kissopen.nav.chatHistory')} icon={icon('chatbubbles-outline')} onPress={() => props.onOpen('history')} />
                <Item title={t('kissopen.nav.projects')} icon={icon('folder-open-outline')} onPress={() => props.onOpen('projects')} />
                <Item title={t('kissopen.nav.schedules')} icon={icon('time-outline')} onPress={() => props.onOpen('schedules')} />
                <Item title={t('kissopen.nav.plugins')} icon={icon('extension-puzzle-outline')} onPress={() => props.onOpen('plugins')} />
                <Item title={t('kissopen.workStart.devices')} icon={icon('desktop-outline')} onPress={() => props.onOpen('devices')} />
            </ItemGroup>
            <ItemGroup>
                {!auth.credentials?.kissopenUserId && <Item title={t('kissopen.settings.workspaceAccount')} subtitle={t('kissopen.settings.workspaceAccountSubtitle')} icon={icon('person-circle-outline')} onPress={() => props.onOpen('workspaceAccount')} />}
                <Item title={t('settings.appearance')} subtitle={t('settings.appearanceSubtitle')} icon={icon('color-palette-outline')} onPress={() => props.onOpen('appearance')} />
            </ItemGroup>
            <SettingsSections />
        </ItemList>
    );
});
