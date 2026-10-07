import * as React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { t } from '@/text';

export type HomeTabKey = 'home' | 'work' | 'chat' | 'files' | 'mine';

const TABS: readonly { key: HomeTabKey; icon: keyof typeof Ionicons.glyphMap; selectedIcon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'work', icon: 'checkbox-outline', selectedIcon: 'checkbox' },
    { key: 'chat', icon: 'chatbubble-outline', selectedIcon: 'chatbubble' },
    { key: 'files', icon: 'folder-outline', selectedIcon: 'folder' },
    { key: 'mine', icon: 'person-outline', selectedIcon: 'person' },
];

/** The height the bar takes above the bottom safe area. */
export const HOME_TAB_BAR_HEIGHT = 58;

/**
 * The app's five places, along the bottom: home, work, chat, the library and
 * the account. Chat itself runs full screen with its composer at the bottom,
 * so this bar is laid over every place but that one.
 */
export const HomeTabBar = React.memo(function HomeTabBar(props: { selected: HomeTabKey; onSelect: (key: HomeTabKey) => void }) {
    const { theme } = useUnistyles();
    const insets = useSafeAreaInsets();
    const labels: Record<HomeTabKey, string> = {
        home: t('kissopen.tabs.home'),
        work: t('kissopen.tabs.work'),
        chat: t('kissopen.tabs.chat'),
        files: t('kissopen.tabs.files'),
        mine: t('kissopen.tabs.mine'),
    };
    return (
        <View style={[styles.bar, { paddingBottom: insets.bottom }]} accessibilityRole="tablist">
            {TABS.map(tab => {
                const selected = tab.key === props.selected;
                const color = selected ? theme.colors.home.accent : theme.colors.home.muted;
                return (
                    <Pressable
                        key={tab.key}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        accessibilityLabel={labels[tab.key]}
                        onPress={() => props.onSelect(tab.key)}
                        style={styles.tab}
                    >
                        <Ionicons name={selected ? tab.selectedIcon : tab.icon} size={25} color={color} />
                        <Text style={[styles.label, { color }]}>{labels[tab.key]}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
});

const styles = StyleSheet.create(theme => ({
    bar: {
        flexDirection: 'row',
        backgroundColor: theme.colors.home.card,
        borderTopWidth: 1,
        borderTopColor: theme.colors.home.border,
    },
    tab: { flex: 1, height: HOME_TAB_BAR_HEIGHT, alignItems: 'center', justifyContent: 'center', gap: 3 },
    label: { fontSize: 11, ...Typography.default('semiBold') },
}));
