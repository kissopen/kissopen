import * as React from 'react';
import { Platform, Share, Text, TextInput, View } from 'react-native';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { ItemList } from '@/components/ItemList';
import { ItemGroup } from '@/components/ItemGroup';
import { Item } from '@/components/Item';
import { MarkdownView } from '@/components/markdown/MarkdownView';
import { kissopenAboutContent } from './aboutContent';
import { upstreamClientLicense } from './upstreamLicense';
import { t } from '@/text';

export function KissopenAboutScreen() {
    const { page } = useLocalSearchParams<{ page: string }>();
    const { theme } = useUnistyles();
    const [details, setDetails] = React.useState('');
    const [notice, setNotice] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const lock = React.useRef(false);
    const version = Constants.expoConfig?.version || 'unknown';
    const content = page === 'updates' || page === 'privacy' || page === 'usage' ? kissopenAboutContent[page] : undefined;
    if (!content && page !== 'feedback' && page !== 'licenses') return <Redirect href="/settings" />;
    // Titles are translated even though the markdown bodies stay in Chinese:
    // the changelog churns every release and the privacy text needs legal
    // review, so those are deliberately left for a human pass.
    const title = page === 'updates' ? t('settings.whatsNew')
        : page === 'privacy' ? t('settings.privacyPolicy')
            : page === 'usage' ? t('kissopen.about.userGuide')
                : page === 'feedback' ? t('settings.reportIssue')
                    : t('kissopen.about.licenses');
    const feedback = t('kissopen.about.feedbackTemplate', {
        version,
        platform: Platform.OS,
        osVersion: String(Platform.Version ?? ''),
        details: details.trim(),
    });
    const perform = async (action: () => Promise<void>) => {
        if (lock.current) return;
        lock.current = true; setBusy(true); setNotice('');
        try { await action(); }
        catch (e) { setNotice(e instanceof Error ? e.message : t('kissopen.errors.actionFailedRetry')); }
        finally { lock.current = false; setBusy(false); }
    };
    return <>
        <Stack.Screen options={{ title, headerShown: true, headerTransparent: false }} />
        <ItemList keyboardShouldPersistTaps="handled">
            {content && <View style={styles.body}><MarkdownView markdown={content.markdown} /></View>}
            {page === 'licenses' && <View style={styles.body}>
                <Text style={styles.text}>{t('kissopen.about.licensesIntro')}</Text>
                <Text selectable style={styles.license}>{upstreamClientLicense}</Text>
            </View>}
            {page === 'feedback' && <>
                <ItemGroup title={t('kissopen.about.feedbackTitle')} footer={t('kissopen.about.feedbackFooter')}>
                    <View style={styles.body}><Text style={styles.text}>{t('kissopen.about.feedbackGuidance')}</Text>
                        <TextInput accessibilityLabel={t('kissopen.about.issueLabel')} placeholder={t('kissopen.about.issuePlaceholder')} placeholderTextColor={theme.colors.textSecondary} multiline textAlignVertical="top" value={details} onChangeText={setDetails} style={styles.input} />
                    </View>
                    <Item title={t('kissopen.about.copyFeedback')} disabled={busy || !details.trim()} onPress={() => void perform(async () => { await Clipboard.setStringAsync(feedback); setNotice(t('kissopen.about.copiedFeedback')); })} />
                    {Platform.OS !== 'web' && <Item title={t('kissopen.about.shareFeedback')} disabled={busy || !details.trim()} onPress={() => void perform(async () => { await Share.share({ title: t('kissopen.about.feedbackTitle'), message: feedback }); })} />}
                </ItemGroup>
                <ItemGroup title={t('kissopen.about.attachedInfo')}><Item title={t('kissopen.about.appVersion')} detail={version} showChevron={false} /><Item title={t('kissopen.about.system')} detail={Platform.OS} showChevron={false} /></ItemGroup>
                {!!notice && <View style={styles.body}><Text accessibilityRole="alert" style={styles.text}>{notice}</Text></View>}
            </>}
        </ItemList>
    </>;
}
const styles = StyleSheet.create(theme => ({
    body: { padding: 20, gap: 16, width: '100%', maxWidth: 850, alignSelf: 'center' },
    text: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 24 },
    input: { minHeight: 170, padding: 16, color: theme.colors.text, backgroundColor: theme.colors.input.background, borderRadius: 16, fontSize: 16, lineHeight: 24 },
    license: { color: theme.colors.text, fontSize: 13, lineHeight: 21 },
}));
