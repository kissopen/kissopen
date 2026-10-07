import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import Slider from '@react-native-community/slider';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { RoundButton } from '@/components/RoundButton';
import { Typography } from '@/constants/Typography';
import { Modal } from '@/modal';
import { t } from '@/text';
import { client } from './api/client';
import { APIError } from './api/protocol';
import type { Theme, ThemeDoc, ThemeGenerated, ThemesPage, ThemeWrite } from './api/types';
import { serverOrigin } from './platform/transport';
import { base64FromUri } from './cloudImage';
import { themeApply, themePreview, useAppliedTheme } from './useTheme';

/*
 * The theme settings screen: the theme in use, the built-in ones, a model
 * that writes one from a sentence, the account's own themes (with sharing,
 * export and a background picture), the gallery of published themes, and
 * import from JSON or a share link. Choosing anything asks the server and
 * paints the app at once (useTheme.ts).
 */

const SHARE_BASE = `${serverOrigin}/app/?theme=`;

/** The share link's theme id, a bare id, or nothing. */
function themeIdOf(text: string): string {
    const trimmed = text.trim();
    const link = trimmed.match(/[?&]theme=([A-Za-z0-9_-]+)/);
    if (link) return link[1];
    return /^[A-Za-z0-9_-]{6,64}$/.test(trimmed) ? trimmed : '';
}

/** A pasted theme file (`ThemeWrite`, or a bare document), or nothing. */
function themeWriteOf(text: string): ThemeWrite | undefined {
    try {
        const value = JSON.parse(text);
        if (!value || typeof value !== 'object') return undefined;
        const doc: ThemeDoc | undefined = value.doc && typeof value.doc === 'object' ? value.doc : value.light && value.dark ? value : undefined;
        if (!doc || !doc.light || !doc.dark) return undefined;
        return {
            name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : t('kissopen.themes.nameDefault'),
            description: typeof value.description === 'string' ? value.description : '',
            source: 'user',
            doc: { version: 1, font: doc.font || 'sans', radius: doc.radius || 'soft', light: doc.light, dark: doc.dark, background: doc.background ?? null },
        };
    } catch {
        return undefined;
    }
}

const fontLabel = (font: string) => font === 'serif' ? t('kissopen.themes.fontSerif') : font === 'mono' ? t('kissopen.themes.fontMono') : t('kissopen.themes.fontSans');
const radiusLabel = (radius: string) => radius === 'sharp' ? t('kissopen.themes.radiusSharp') : radius === 'round' ? t('kissopen.themes.radiusRound') : t('kissopen.themes.radiusSoft');

/** Both appearances of a theme at a glance: canvas, a card, a line of text and the accent. */
export const ThemeSwatch = React.memo(function ThemeSwatch({ doc, width = 72, height = 44 }: { doc: ThemeDoc; width?: number; height?: number }) {
    const { theme } = useUnistyles();
    const radius = doc.radius === 'sharp' ? 2 : doc.radius === 'round' ? 12 : 6;
    return (
        <View style={[styles.swatch, { width, height, borderRadius: radius, borderColor: theme.colors.divider }]}>
            {[doc.light, doc.dark].map((p, i) => (
                <View key={i} style={[styles.swatchHalf, { backgroundColor: p.canvas }]}>
                    <View style={[styles.swatchCard, { backgroundColor: p.surface, borderColor: p.line, borderRadius: Math.max(2, radius / 2) }]}>
                        <View style={[styles.swatchText, { backgroundColor: p.text }]} />
                        <View style={[styles.swatchMuted, { backgroundColor: p.muted }]} />
                    </View>
                    <View style={[styles.swatchAccent, { backgroundColor: p.accent }]} />
                </View>
            ))}
        </View>
    );
});

function Chip({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'accent' | 'green' | 'peach' }) {
    const { theme } = useUnistyles();
    const colors = tone === 'accent' ? { bg: theme.colors.home.accentSoft, fg: theme.colors.home.accent }
        : tone === 'green' ? { bg: theme.colors.home.greenSoft, fg: theme.colors.home.green }
            : tone === 'peach' ? { bg: theme.colors.home.peachSoft, fg: theme.colors.home.peachText }
                : { bg: theme.colors.surfaceHighest, fg: theme.colors.textSecondary };
    return <View style={[styles.chip, { backgroundColor: colors.bg }]}><Text style={[styles.chipText, { color: colors.fg }]}>{label}</Text></View>;
}

function Action({ label, onPress, destructive, disabled }: { label: string; onPress: () => void; destructive?: boolean; disabled?: boolean }) {
    const { theme } = useUnistyles();
    return (
        <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.action, pressed && styles.actionPressed, disabled && styles.actionDisabled]} accessibilityRole="button">
            <Text style={[styles.actionText, { color: destructive ? theme.colors.home.danger : theme.colors.home.accent }]}>{label}</Text>
        </Pressable>
    );
}

export const ThemesScreen = React.memo(function ThemesScreen() {
    const { theme } = useUnistyles();
    const applied = useAppliedTheme();
    const [page, setPage] = React.useState<ThemesPage>();
    const [gallery, setGallery] = React.useState<Theme[]>();
    const [query, setQuery] = React.useState('');
    const [sort, setSort] = React.useState<'uses' | 'new'>('uses');
    const [prompt, setPrompt] = React.useState('');
    const [generated, setGenerated] = React.useState<ThemeGenerated>();
    const [generating, setGenerating] = React.useState(false);
    const [importText, setImportText] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [notice, setNotice] = React.useState('');
    const noticeTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);

    const say = React.useCallback((text: string) => {
        setNotice(text);
        clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(''), 3000);
    }, []);
    React.useEffect(() => () => clearTimeout(noticeTimer.current), []);

    const load = React.useCallback(async () => {
        try { setPage(await client.themes()); } catch { /* the next action asks again */ }
    }, []);
    React.useEffect(() => { void load(); }, [load]);

    React.useEffect(() => {
        let alive = true;
        const timer = setTimeout(async () => {
            try {
                const out = await client.themesGallery(query, sort);
                if (alive) setGallery(out.themes);
            } catch { if (alive) setGallery(current => current ?? []); }
        }, query ? 300 : 0);
        return () => { alive = false; clearTimeout(timer); };
    }, [query, sort]);

    /** Runs one request at a time; an error is shown the way the server phrased it. */
    const perform = React.useCallback(async (action: () => Promise<void>) => {
        if (busy) return;
        setBusy(true);
        try { await action(); }
        catch (e) { Modal.alert(t('common.error'), e instanceof Error ? e.message : t('kissopen.errors.requestFailedRetry')); }
        finally { setBusy(false); }
    }, [busy]);

    const select = React.useCallback((id: string) => perform(async () => {
        await client.themeSelect(id);
        setPage(current => current ? { ...current, selected: id } : current);
        say(id ? t('kissopen.themes.applied') : t('kissopen.themes.defaultName'));
    }), [perform, say]);

    const replaceMine = React.useCallback((updated: Theme) => {
        setPage(current => current ? { ...current, mine: current.mine.map(one => one.id === updated.id ? updated : one) } : current);
        if (applied?.id === updated.id) themeApply(updated);
    }, [applied?.id]);

    const generate = React.useCallback(() => {
        const text = prompt.trim();
        if (!text || generating) return;
        setGenerating(true);
        (async () => {
            try {
                setGenerated(await client.themeGenerate(text));
            } catch (e) {
                const message = e instanceof APIError && e.status === 503 ? t('kissopen.themes.generateUnavailable') : e instanceof Error ? e.message : t('kissopen.errors.requestFailedRetry');
                Modal.alert(t('common.error'), message);
            } finally { setGenerating(false); }
        })();
    }, [prompt, generating]);

    const saveGenerated = React.useCallback(() => {
        if (!generated) return;
        void perform(async () => {
            const made = await client.themeCreate({ name: generated.name, description: generated.description, source: 'ai', doc: generated.doc });
            await client.themeSelect(made.id);
            setPage(current => current ? { ...current, selected: made.id, mine: [made, ...current.mine] } : current);
            setGenerated(undefined);
            say(t('kissopen.themes.saved'));
        });
    }, [generated, perform, say]);

    const share = React.useCallback(async (one: Theme) => {
        const link = SHARE_BASE + one.id;
        await Clipboard.setStringAsync(link);
        say(t('kissopen.themes.shareCopied'));
        if (Platform.OS !== 'web') {
            try { await Share.share({ message: t('kissopen.themes.shareMessage', { name: one.name, link }) }); } catch { /* dismissed */ }
        }
    }, [say]);

    const exportTheme = React.useCallback(async (one: Theme) => {
        await Clipboard.setStringAsync(JSON.stringify({ name: one.name, description: one.description, doc: one.doc }, null, 2));
        say(t('kissopen.themes.exportCopied'));
    }, [say]);

    const remove = React.useCallback(async (one: Theme) => {
        if (!await Modal.confirm(t('kissopen.themes.delete'), t('kissopen.themes.deleteConfirm', { name: one.name }), { destructive: true, confirmText: t('common.delete'), cancelText: t('common.cancel') })) return;
        void perform(async () => {
            await client.themeDelete(one.id);
            setPage(current => current ? { ...current, selected: current.selected === one.id ? '' : current.selected, mine: current.mine.filter(item => item.id !== one.id) } : current);
            if (applied?.id === one.id) themeApply(null);
        });
    }, [perform, applied?.id]);

    const importTheme = React.useCallback(() => {
        const text = importText.trim();
        if (!text) return;
        const write = themeWriteOf(text);
        const id = write ? '' : themeIdOf(text);
        if (!write && !id) { Modal.alert(t('common.error'), t('kissopen.themes.importInvalid')); return; }
        void perform(async () => {
            if (write) {
                const made = await client.themeCreate(write);
                await client.themeSelect(made.id);
                setPage(current => current ? { ...current, selected: made.id, mine: [made, ...current.mine] } : current);
            } else {
                const found = await client.theme(id);
                await client.themeSelect(found.id);
                setPage(current => current ? { ...current, selected: found.id } : current);
            }
            setImportText('');
            say(t('kissopen.themes.imported'));
        });
    }, [importText, perform, say]);

    // The background picture belongs to the theme in use when it is one of mine.
    const editing = React.useMemo(() => page?.mine.find(one => one.id === page.selected && one.id === applied?.id), [page, applied?.id]);
    const background = editing?.doc.background ?? null;
    const writeOf = (one: Theme, doc: ThemeDoc): ThemeWrite => ({ name: one.name, description: one.description, source: one.source === 'ai' ? 'ai' : 'user', doc });
    const pickBackground = React.useCallback(() => {
        if (!editing) return;
        void perform(async () => {
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 0.85, exif: false });
            if (result.canceled || !result.assets[0]) return;
            const asset = result.assets[0];
            const data = asset.base64 ?? await base64FromUri(asset.uri);
            const image = await client.themeImageUpload(asset.mimeType || 'image/jpeg', data);
            const doc: ThemeDoc = { ...editing.doc, background: { url: image.url, opacity: background?.opacity ?? 0.3, blur: background?.blur ?? 0 } };
            replaceMine(await client.themeUpdate(editing.id, writeOf(editing, doc)));
            say(t('kissopen.themes.backgroundSaved'));
        });
    }, [editing, background, perform, replaceMine, say]);
    const updateBackground = React.useCallback((change: Partial<{ opacity: number; blur: number }> | null) => {
        if (!editing) return;
        void perform(async () => {
            const doc: ThemeDoc = { ...editing.doc, background: change === null || !background ? null : { ...background, ...change } };
            replaceMine(await client.themeUpdate(editing.id, writeOf(editing, doc)));
        });
    }, [editing, background, perform, replaceMine]);

    const selectedId = page?.selected ?? applied?.id ?? '';

    const row = (one: Theme, extra?: React.ReactNode) => (
        <Pressable key={one.id} onPress={() => void select(one.id)} disabled={busy} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <ThemeSwatch doc={one.doc} />
            <View style={styles.rowCopy}>
                <View style={styles.rowTitleLine}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{one.name}</Text>
                    {one.featured && <Chip label={t('kissopen.themes.featured')} tone="peach" />}
                    {selectedId === one.id && <Chip label={t('kissopen.themes.applied')} tone="accent" />}
                </View>
                <Text style={styles.rowMeta} numberOfLines={1}>
                    {[one.owner ? t('kissopen.themes.by', { name: one.owner }) : '', t('kissopen.themes.uses', { count: one.uses })].filter(Boolean).join(' · ')}
                </Text>
                {extra}
            </View>
        </Pressable>
    );

    return (
        <ItemList>
            {!!notice && <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View>}

            <ItemGroup title={t('kissopen.themes.current')}>
                <View style={styles.card}>
                    {applied ? <ThemeSwatch doc={applied.doc} width={88} height={56} /> : <View style={[styles.swatchDefault, { backgroundColor: theme.colors.home.accentSoft }]}><Ionicons name="color-palette-outline" size={26} color={theme.colors.home.accent} /></View>}
                    <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle}>{applied?.name ?? t('kissopen.themes.defaultName')}</Text>
                        <Text style={styles.rowMeta}>{applied ? `${fontLabel(applied.doc.font)} · ${radiusLabel(applied.doc.radius)}` : t('kissopen.themes.defaultDescription')}</Text>
                    </View>
                </View>
                {!!applied && <Item title={t('kissopen.themes.restoreDefault')} icon={<Ionicons name="refresh-outline" size={29} color={theme.colors.home.accent} />} onPress={() => void select('')} disabled={busy} />}
            </ItemGroup>

            <ItemGroup title={t('kissopen.themes.system')}>
                {!page ? <Item title={t('common.loading')} loading /> : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                        {page.system.map(one => (
                            <Pressable key={one.id} onPress={() => void select(one.id)} disabled={busy} style={({ pressed }) => [styles.systemCard, selectedId === one.id && styles.systemCardSelected, pressed && styles.rowPressed]}>
                                <ThemeSwatch doc={one.doc} width={96} height={56} />
                                <Text style={styles.systemName} numberOfLines={1}>{one.name}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                )}
            </ItemGroup>

            <ItemGroup title={t('kissopen.themes.generate')} footer={page && !page.can_generate ? t('kissopen.themes.generateUnavailable') : undefined}>
                <View style={styles.form}>
                    <TextInput
                        style={styles.input}
                        value={prompt}
                        onChangeText={setPrompt}
                        placeholder={t('kissopen.themes.generatePlaceholder')}
                        placeholderTextColor={theme.colors.input.placeholder}
                        multiline
                        editable={!generating}
                    />
                    <RoundButton title={generating ? t('kissopen.themes.generating') : t('kissopen.themes.generateAction')} size="normal" onPress={generate} loading={generating} disabled={!prompt.trim() || (page ? !page.can_generate : false)} />
                </View>
                {!!generated && (
                    <View style={styles.preview}>
                        <View style={styles.card}>
                            <ThemeSwatch doc={generated.doc} width={88} height={56} />
                            <View style={styles.rowCopy}>
                                <Text style={styles.rowTitle}>{generated.name}</Text>
                                {!!generated.description && <Text style={styles.rowMeta} numberOfLines={2}>{generated.description}</Text>}
                                <Text style={styles.rowMeta}>{`${fontLabel(generated.doc.font)} · ${radiusLabel(generated.doc.radius)}`}</Text>
                            </View>
                        </View>
                        <View style={styles.actions}>
                            <Action label={t('kissopen.themes.tryIt')} onPress={() => themePreview(generated.name, generated.doc)} />
                            <Action label={t('kissopen.themes.save')} onPress={saveGenerated} disabled={busy} />
                            <Action label={t('kissopen.themes.another')} onPress={generate} disabled={generating} />
                        </View>
                    </View>
                )}
            </ItemGroup>

            <ItemGroup title={t('kissopen.themes.mine')} footer={page && page.mine.length === 0 ? t('kissopen.themes.mineEmpty') : undefined}>
                {page?.mine.map(one => row(one, (
                    <>
                        <View style={styles.rowTitleLine}>
                            <Chip label={one.public ? t('kissopen.themes.public') : t('kissopen.themes.private')} tone={one.public ? 'green' : 'muted'} />
                        </View>
                        <View style={styles.actions}>
                            <Action label={t('kissopen.themes.apply')} onPress={() => void select(one.id)} disabled={busy || selectedId === one.id} />
                            <Action label={one.public ? t('kissopen.themes.unpublish') : t('kissopen.themes.publish')} onPress={() => void perform(async () => replaceMine(await client.themePublish(one.id, !one.public)))} disabled={busy} />
                            <Action label={t('kissopen.themes.share')} onPress={() => void share(one)} />
                            <Action label={t('kissopen.themes.export')} onPress={() => void exportTheme(one)} />
                            <Action label={t('kissopen.themes.delete')} onPress={() => void remove(one)} destructive disabled={busy} />
                        </View>
                    </>
                )))}
            </ItemGroup>

            <ItemGroup title={t('kissopen.themes.background')} footer={t('kissopen.themes.backgroundFooter')}>
                {editing ? (
                    <>
                        <Text style={styles.editingLine}>{t('kissopen.themes.editing', { name: editing.name })}</Text>
                        <Item title={t('kissopen.themes.backgroundPick')} icon={<Ionicons name="image-outline" size={29} color={theme.colors.home.accent} />} onPress={pickBackground} disabled={busy} />
                        {!!background && (
                            <>
                                <View style={styles.sliderRow}>
                                    <Text style={styles.sliderLabel}>{t('kissopen.themes.backgroundOpacity')}</Text>
                                    <Slider style={styles.slider} minimumValue={0.05} maximumValue={1} step={0.05} value={background.opacity} onSlidingComplete={value => updateBackground({ opacity: Math.round(value * 100) / 100 })} minimumTrackTintColor={theme.colors.home.accent} maximumTrackTintColor={theme.colors.home.track} thumbTintColor={theme.colors.home.accent} />
                                </View>
                                <View style={styles.sliderRow}>
                                    <Text style={styles.sliderLabel}>{t('kissopen.themes.backgroundBlur')}</Text>
                                    <Slider style={styles.slider} minimumValue={0} maximumValue={40} step={1} value={background.blur} onSlidingComplete={value => updateBackground({ blur: Math.round(value) })} minimumTrackTintColor={theme.colors.home.accent} maximumTrackTintColor={theme.colors.home.track} thumbTintColor={theme.colors.home.accent} />
                                </View>
                                <Item title={t('kissopen.themes.backgroundRemove')} destructive icon={<Ionicons name="trash-outline" size={29} color={theme.colors.home.danger} />} onPress={() => updateBackground(null)} disabled={busy} />
                            </>
                        )}
                    </>
                ) : null}
            </ItemGroup>

            <ItemGroup title={t('kissopen.themes.gallery')} footer={gallery && gallery.length === 0 ? (query ? t('kissopen.themes.galleryNotFound') : t('kissopen.themes.galleryEmpty')) : undefined}>
                <View style={styles.searchLine}>
                    <View style={styles.search}>
                        <Ionicons name="search-outline" size={16} color={theme.colors.textSecondary} />
                        <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder={t('kissopen.themes.gallerySearch')} placeholderTextColor={theme.colors.input.placeholder} autoCorrect={false} autoCapitalize="none" returnKeyType="search" />
                    </View>
                    {(['uses', 'new'] as const).map(key => (
                        <Pressable key={key} onPress={() => setSort(key)} style={[styles.sortChip, sort === key && styles.sortChipSelected]}>
                            <Text style={[styles.sortText, sort === key && styles.sortTextSelected]}>{key === 'uses' ? t('kissopen.themes.sortUses') : t('kissopen.themes.sortNew')}</Text>
                        </Pressable>
                    ))}
                </View>
                {!gallery ? <View style={styles.loading}><ActivityIndicator color={theme.colors.home.accent} /></View> : gallery.map(one => row(one))}
            </ItemGroup>

            <ItemGroup title={t('kissopen.themes.importTitle')}>
                <View style={styles.form}>
                    <TextInput
                        style={[styles.input, Typography.mono()]}
                        value={importText}
                        onChangeText={setImportText}
                        placeholder={t('kissopen.themes.importPlaceholder')}
                        placeholderTextColor={theme.colors.input.placeholder}
                        multiline
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                    <RoundButton title={t('kissopen.themes.importAction')} size="normal" onPress={importTheme} disabled={!importText.trim() || busy} />
                </View>
            </ItemGroup>
        </ItemList>
    );
});

const styles = StyleSheet.create((theme) => ({
    notice: { marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.home.accentSoft },
    noticeText: { color: theme.colors.home.accent, fontSize: 14, ...Typography.default('semiBold') },
    card: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
    swatchDefault: { width: 88, height: 56, borderRadius: theme.borderRadius.md, alignItems: 'center', justifyContent: 'center' },
    swatch: { flexDirection: 'row', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
    swatchHalf: { flex: 1, padding: 5, justifyContent: 'space-between' },
    swatchCard: { borderWidth: StyleSheet.hairlineWidth, padding: 3, gap: 2 },
    swatchText: { height: 3, width: '80%', borderRadius: 2 },
    swatchMuted: { height: 2, width: '55%', borderRadius: 2 },
    swatchAccent: { width: 9, height: 9, borderRadius: 5, alignSelf: 'flex-end' },
    chips: { paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
    systemCard: { alignItems: 'center', gap: 6, padding: 6, borderRadius: theme.borderRadius.lg, borderWidth: 2, borderColor: 'transparent' },
    systemCardSelected: { borderColor: theme.colors.home.accent, backgroundColor: theme.colors.home.accentSoft },
    systemName: { color: theme.colors.text, fontSize: 13, maxWidth: 96, ...Typography.default('semiBold') },
    form: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
    input: { minHeight: 72, maxHeight: 180, paddingHorizontal: 12, paddingVertical: 10, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.input.background, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.divider, color: theme.colors.input.text, fontSize: 15, textAlignVertical: 'top', ...Typography.default() },
    preview: { paddingBottom: 8 },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
    rowPressed: { backgroundColor: theme.colors.surfacePressed },
    rowCopy: { flex: 1, gap: 4 },
    rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    rowTitle: { color: theme.colors.text, fontSize: 16, flexShrink: 1, ...Typography.default('semiBold') },
    rowMeta: { color: theme.colors.textSecondary, fontSize: 13 },
    chip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
    chipText: { fontSize: 11, ...Typography.default('semiBold') },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4, paddingHorizontal: 12, paddingBottom: 4 },
    action: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: theme.borderRadius.md },
    actionPressed: { backgroundColor: theme.colors.surfacePressed },
    actionDisabled: { opacity: 0.4 },
    actionText: { fontSize: 14, ...Typography.default('semiBold') },
    editingLine: { color: theme.colors.textSecondary, fontSize: 13, paddingHorizontal: 16, paddingTop: 10 },
    sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 6 },
    sliderLabel: { color: theme.colors.text, fontSize: 15, width: 72 },
    slider: { flex: 1, height: 36 },
    searchLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
    search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 36, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.input.background, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.divider },
    searchInput: { flex: 1, color: theme.colors.input.text, fontSize: 15, paddingVertical: 0, ...Typography.default() },
    sortChip: { paddingHorizontal: 10, height: 30, borderRadius: 999, justifyContent: 'center', backgroundColor: theme.colors.surfaceHighest },
    sortChipSelected: { backgroundColor: theme.colors.home.accentSoft },
    sortText: { color: theme.colors.textSecondary, fontSize: 13, ...Typography.default('semiBold') },
    sortTextSelected: { color: theme.colors.home.accent },
    loading: { padding: 24, alignItems: 'center' },
}));
