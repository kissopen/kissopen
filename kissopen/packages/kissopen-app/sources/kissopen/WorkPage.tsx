import * as React from 'react';
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line } from 'react-native-svg';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { layout } from '@/components/layout';
import { t } from '@/text';
import { Landscape, ProjectPicture } from './HomeArt';
import { sinceOf, type ProjectListItem } from './projectTime';

/** Something a first project could be, offered as a card to start from. */
export type WorkExample = { title: string; detail: string; picture: string };

/*
 * The work tab. With no project yet it is an invitation: say what you want to
 * move forward, and it becomes a project. Once there are projects they come
 * first, and the invitation stays below them for the next one.
 */
export const WorkPage = React.memo(function WorkPage(props: {
    projects: readonly ProjectListItem[];
    examples: readonly WorkExample[];
    topInset: number;
    bottomInset: number;
    onStart: (goal: string) => void;
    onProject: (id: string) => void;
    onDevices: () => void;
}) {
    const { theme } = useUnistyles();
    const { width } = useWindowDimensions();
    const pageWidth = Math.min(width, layout.maxWidth);
    const [goal, setGoal] = React.useState('');
    const input = React.useRef<TextInput>(null);
    const scroll = React.useRef<ScrollView>(null);
    const [cardY, setCardY] = React.useState(0);
    const now = Date.now();
    const start = () => {
        const text = goal.trim();
        if (!text) { input.current?.focus(); return; }
        props.onStart(text);
        setGoal('');
    };
    const pick = (example: WorkExample) => {
        setGoal(example.title);
        scroll.current?.scrollTo({ y: Math.max(0, cardY - 12), animated: true });
        input.current?.focus();
    };
    return (
        <ScrollView ref={scroll} style={styles.root} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: props.topInset + 8, paddingBottom: props.bottomInset + 24 }} showsVerticalScrollIndicator={false}>
            <View style={styles.page}>
                <Text style={styles.title} accessibilityRole="header">{t('kissopen.workStart.title')}</Text>
                <Text style={styles.lead}>{t('kissopen.workStart.lead')}</Text>

                {props.projects.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle} accessibilityRole="header">{t('kissopen.workStart.yourProjects')}</Text>
                        {props.projects.map((project, index) => (
                            <Pressable key={project.id} accessibilityRole="button" onPress={() => props.onProject(project.id)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                                <View style={styles.rowPicture}><ProjectPicture kind={PICTURES[index % PICTURES.length]!} width={56} height={56} /></View>
                                <View style={styles.rowCopy}>
                                    <Text style={styles.rowTitle} numberOfLines={1}>{project.name}</Text>
                                    <Text style={styles.rowDetail} numberOfLines={1}>{project.place} · {sinceOf(project.updatedAt, now)}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={theme.colors.home.muted} />
                            </Pressable>
                        ))}
                    </View>
                )}

                <View style={styles.card} onLayout={event => setCardY(event.nativeEvent.layout.y)}>
                    <View style={styles.cardArt} pointerEvents="none">
                        <Landscape id="work-start" width={pageWidth - 32} height={170} />
                    </View>
                    <View style={styles.cardTop}>
                        <Text style={styles.question} accessibilityRole="header">{t('kissopen.workStart.question')}</Text>
                        <View style={styles.motto} pointerEvents="none">
                            <Text style={styles.mottoText}>{t('kissopen.workStart.motto1')}</Text>
                            <Text style={styles.mottoText}>{t('kissopen.workStart.motto2')}</Text>
                        </View>
                    </View>
                    <View style={styles.form}>
                        <TextInput
                            ref={input}
                            style={styles.input}
                            value={goal}
                            onChangeText={setGoal}
                            placeholder={t('kissopen.workStart.placeholder')}
                            placeholderTextColor={theme.colors.home.muted}
                            returnKeyType="go"
                            onSubmitEditing={start}
                            maxLength={200}
                        />
                        <Pressable accessibilityRole="button" onPress={start} style={({ pressed }) => [styles.start, pressed && styles.pressed]}>
                            <Text style={styles.startText}>{t('kissopen.workStart.start')}</Text>
                            <Ionicons name="arrow-forward" size={20} color={theme.colors.home.onAccent} />
                        </Pressable>
                        <Text style={styles.hint}>{t('kissopen.workStart.hint')}</Text>
                        <View style={styles.steps}>
                            <Step icon="document-text" tint={theme.colors.home.accent} soft={theme.colors.home.accentSoft} title={t('kissopen.workStart.step1Title')} detail={t('kissopen.workStart.step1Detail')} />
                            <Dots color={theme.colors.home.accent} />
                            <Step icon="sparkles" tint={theme.colors.home.accent} soft={theme.colors.home.accentSoft} title={t('kissopen.workStart.step2Title')} detail={t('kissopen.workStart.step2Detail')} />
                            <Dots color={theme.colors.home.peach} />
                            <Step icon="bar-chart" tint={theme.colors.home.peach} soft={theme.colors.home.peachSoft} title={t('kissopen.workStart.step3Title')} detail={t('kissopen.workStart.step3Detail')} />
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle} accessibilityRole="header">{t('kissopen.workStart.examplesTitle')}</Text>
                    <Text style={styles.sectionLead}>{t('kissopen.workStart.examplesLead')}</Text>
                    {props.examples.map(example => (
                        <Pressable key={example.title} accessibilityRole="button" onPress={() => pick(example)} style={({ pressed }) => [styles.example, pressed && styles.pressed]}>
                            <View style={styles.examplePicture}><ProjectPicture kind={example.picture} width={110} height={88} /></View>
                            <View style={styles.rowCopy}>
                                <Text style={styles.exampleTitle} numberOfLines={2}>{example.title}</Text>
                                <Text style={styles.rowDetail} numberOfLines={2}>{example.detail}</Text>
                            </View>
                            <View style={styles.go}><Ionicons name="arrow-forward" size={18} color={theme.colors.home.peach} /></View>
                        </Pressable>
                    ))}
                </View>

                <View style={styles.formula}>
                    <Ionicons name="bulb-outline" size={24} color={theme.colors.home.accent} />
                    <Text style={styles.formulaText}>{t('kissopen.workStart.formula')}</Text>
                </View>

                <Pressable accessibilityRole="button" onPress={props.onDevices} style={({ pressed }) => [styles.devices, pressed && styles.pressed]}>
                    <Ionicons name="desktop-outline" size={18} color={theme.colors.home.muted} />
                    <Text style={styles.devicesText}>{t('kissopen.workStart.devices')}</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.home.muted} />
                </Pressable>
            </View>
        </ScrollView>
    );
});

function Step(props: { icon: keyof typeof Ionicons.glyphMap; tint: string; soft: string; title: string; detail: string }) {
    return (
        <View style={styles.step}>
            <View style={[styles.stepIcon, { backgroundColor: props.soft }]}><Ionicons name={props.icon} size={24} color={props.tint} /></View>
            <Text style={styles.stepTitle} numberOfLines={2}>{props.title}</Text>
            <Text style={styles.stepDetail} numberOfLines={2}>{props.detail}</Text>
        </View>
    );
}

function Dots(props: { color: string }) {
    return (
        <View style={styles.dots}>
            <Svg width="100%" height={4}><Line x1="0" y1="2" x2="100%" y2="2" stroke={props.color} strokeWidth={1.4} strokeDasharray="3 4" opacity={0.6} /></Svg>
        </View>
    );
}

const PICTURES = ['laptop', 'document', 'chart'];

const styles = StyleSheet.create(theme => ({
    root: { flex: 1, backgroundColor: theme.colors.home.bg },
    page: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: 16, gap: 14 },
    title: { color: theme.colors.text, fontSize: 30, lineHeight: 38, paddingHorizontal: 4, ...Typography.default('semiBold') },
    lead: { color: theme.colors.home.muted, fontSize: 15, lineHeight: 22, paddingHorizontal: 4, marginTop: -6 },
    pressed: { opacity: 0.7 },
    card: {
        backgroundColor: theme.colors.home.card, borderRadius: 22, overflow: 'hidden',
        borderWidth: 1, borderColor: theme.colors.home.border,
        shadowColor: theme.colors.home.shadow, shadowOpacity: 1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2,
    },
    cardArt: { position: 'absolute', top: 0, left: 0, right: 0, height: 170 },
    cardTop: { height: 150, paddingHorizontal: 20, justifyContent: 'center' },
    question: { color: theme.colors.text, fontSize: 21, lineHeight: 28, maxWidth: '56%', marginTop: 24, ...Typography.default('semiBold') },
    motto: { position: 'absolute', right: 16, top: 14, maxWidth: '44%', transform: [{ rotate: '-8deg' }], alignItems: 'flex-end' },
    mottoText: { color: theme.colors.home.muted, fontSize: 12, lineHeight: 18, fontStyle: 'italic', letterSpacing: 1, textAlign: 'right' },
    form: { backgroundColor: theme.colors.home.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, marginTop: -8, padding: 16, gap: 14 },
    input: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.home.border, backgroundColor: theme.colors.home.cardSoft, paddingHorizontal: 16, color: theme.colors.text, fontSize: 16 },
    start: { height: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.colors.home.accent },
    startText: { color: theme.colors.home.onAccent, fontSize: 17, ...Typography.default('semiBold') },
    hint: { color: theme.colors.home.muted, fontSize: 13, textAlign: 'center' },
    steps: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
    step: { flex: 1, alignItems: 'center', gap: 6 },
    stepIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    stepTitle: { color: theme.colors.text, fontSize: 14, textAlign: 'center', ...Typography.default('semiBold') },
    stepDetail: { color: theme.colors.home.muted, fontSize: 11, lineHeight: 15, textAlign: 'center' },
    dots: { width: 22, height: 4, marginTop: 26 },
    section: { gap: 10 },
    sectionTitle: { color: theme.colors.text, fontSize: 21, lineHeight: 28, paddingHorizontal: 4, marginTop: 8, ...Typography.default('semiBold') },
    sectionLead: { color: theme.colors.home.muted, fontSize: 14, paddingHorizontal: 4, marginTop: -6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: theme.colors.home.card, borderWidth: 1, borderColor: theme.colors.home.border },
    rowPicture: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden' },
    rowCopy: { flex: 1, gap: 4 },
    rowTitle: { color: theme.colors.text, fontSize: 16, ...Typography.default('semiBold') },
    rowDetail: { color: theme.colors.home.muted, fontSize: 13, lineHeight: 19 },
    example: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 18, backgroundColor: theme.colors.home.card, borderWidth: 1, borderColor: theme.colors.home.border },
    examplePicture: { width: 110, height: 88, borderRadius: 14, overflow: 'hidden' },
    exampleTitle: { color: theme.colors.text, fontSize: 17, ...Typography.default('semiBold') },
    go: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.home.peachSoft },
    formula: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, backgroundColor: theme.colors.home.accentSoft },
    formulaText: { flex: 1, color: theme.colors.text, fontSize: 14, lineHeight: 20, ...Typography.default('semiBold') },
    devices: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
    devicesText: { color: theme.colors.home.muted, fontSize: 14 },
}));
