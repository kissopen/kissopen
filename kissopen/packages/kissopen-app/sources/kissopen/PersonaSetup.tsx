import * as React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { layout } from '@/components/layout';
import { Typography } from '@/constants/Typography';
import { useHeaderHeight } from '@/utils/responsive';
import { t } from '@/text';
import { client } from './api/client';
import { APIError } from './api/protocol';
import type { Persona } from './api/types';
import { PersonAvatar } from './HomeArt';
import {
    PERSONA_GOALS,
    PERSONA_GOALS_MAX,
    PERSONA_INDUSTRIES,
    PERSONA_OCCUPATIONS,
    PERSONA_ROLES,
    PERSONA_TEAM_SIZES,
    PERSONA_TEXT_MAX,
    personaAnswersOf,
    personaChoiceToggle,
    personaGoalToggle,
    personaLeads,
    personaRoleChoose,
    personaUpdateOf,
    type PersonaAnswers,
} from './personaAnswers';

/*
 * The three questions the desktop asks right after signing in — what the
 * person's work is, whether they lead people, and what they want help with —
 * one at a time on the phone. The home page is written from the answers and
 * the assistant reads them, so nothing is asked that changes nothing. Every
 * question may be left and the whole thing skipped.
 *
 * Opened again from the account tab (`editing`), it sits under the screen's
 * header, starts from the answers kept, and has no skip: skipping would forget
 * them, and the header's back button already leaves without saving.
 */

const STEPS = ['kissopen.persona.stepWork', 'kissopen.persona.stepRole', 'kissopen.persona.stepGoals'] as const;
type OptionList = readonly { readonly value: string; readonly label: Parameters<typeof t>[0] }[];

export const PersonaSetup = React.memo(function PersonaSetup(props: {
    initial?: Persona | null;
    editing?: boolean;
    onSaved?: () => void;
}) {
    const { theme } = useUnistyles();
    const insets = useSafeAreaInsets();
    const headerHeight = useHeaderHeight();
    const scroll = React.useRef<ScrollView>(null);
    const [step, setStep] = React.useState(0);
    const [answers, setAnswers] = React.useState<PersonaAnswers>(() => personaAnswersOf(props.initial));
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');
    const last = step === STEPS.length - 1;

    const go = (next: number) => {
        setStep(next);
        scroll.current?.scrollTo({ y: 0, animated: false });
    };
    const save = async (skipped: boolean) => {
        if (busy) return;
        setBusy(true); setError('');
        try {
            await client.persona(personaUpdateOf(answers, skipped));
            props.onSaved?.();
        } catch (e) {
            if (e instanceof APIError && e.status === 401) { void client.forgetSession(); return; }
            setError(e instanceof Error ? e.message : t('kissopen.errors.requestFailedRetry'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={[styles.root, { paddingTop: props.editing ? 0 : insets.top }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={props.editing && Platform.OS === 'ios' ? Constants.statusBarHeight + headerHeight : 0}
        >
            <View style={styles.top}>
                <View style={styles.steps} accessibilityLabel={t('kissopen.persona.progress')}>
                    {STEPS.map((label, index) => (
                        <View key={label} style={styles.step}>
                            <View style={[styles.stepDot, index <= step && styles.stepDotOn]}>
                                {index < step
                                    ? <Ionicons name="checkmark" size={14} color={theme.colors.home.onAccent} />
                                    : <Text style={[styles.stepDigit, index === step && styles.stepDigitOn]}>{index + 1}</Text>}
                            </View>
                            <Text style={[styles.stepLabel, index === step && styles.stepLabelOn]} numberOfLines={2}>{t(label)}</Text>
                        </View>
                    ))}
                </View>
                {!props.editing && (
                    <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        hitSlop={8}
                        onPress={() => void save(true)}
                        style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
                    >
                        <Text style={styles.skipText}>{t('kissopen.persona.skip')}</Text>
                    </Pressable>
                )}
            </View>

            <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <View style={styles.page}>
                    {step === 0 && <>
                        <Text style={styles.title} accessibilityRole="header">{t('kissopen.persona.workTitle')}</Text>
                        <Text style={styles.lead}>{t('kissopen.persona.workLead')}</Text>
                        <ChoiceGroup
                            label={t('kissopen.persona.industry')}
                            options={PERSONA_INDUSTRIES}
                            value={answers.industry}
                            onChange={industry => setAnswers(current => ({ ...current, industry }))}
                        />
                        <ChoiceGroup
                            label={t('kissopen.persona.occupation')}
                            options={PERSONA_OCCUPATIONS}
                            value={answers.occupation}
                            onChange={occupation => setAnswers(current => ({ ...current, occupation }))}
                        />
                    </>}

                    {step === 1 && <>
                        <Text style={styles.title} accessibilityRole="header">{t('kissopen.persona.roleTitle')}</Text>
                        <Text style={styles.lead}>{t('kissopen.persona.roleLead')}</Text>
                        <View style={styles.roles} accessibilityRole="radiogroup" accessibilityLabel={t('kissopen.persona.role')}>
                            {PERSONA_ROLES.map((option, index) => {
                                const on = answers.role === option.value;
                                return (
                                    <Pressable
                                        key={option.value}
                                        accessibilityRole="radio"
                                        accessibilityState={{ checked: on }}
                                        onPress={() => setAnswers(current => personaRoleChoose(current, option.value))}
                                        style={({ pressed }) => [styles.role, on && styles.roleOn, pressed && styles.pressed]}
                                    >
                                        <View style={styles.roleArt}><PersonAvatar seed={index * 2 + 1} size={48} /></View>
                                        <View style={styles.roleCopy}>
                                            <Text style={styles.roleTitle}>{t(option.title)}</Text>
                                            <Text style={styles.roleDetail}>{t(option.detail)}</Text>
                                        </View>
                                        <Ionicons
                                            name={on ? 'checkmark-circle' : 'ellipse-outline'}
                                            size={24}
                                            color={on ? theme.colors.home.accent : theme.colors.home.muted}
                                        />
                                    </Pressable>
                                );
                            })}
                        </View>
                        {personaLeads(answers.role) && (
                            <View style={styles.group}>
                                <Text style={styles.groupLabel}>{t('kissopen.persona.teamSizeTitle')}</Text>
                                <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('kissopen.persona.teamSize')}>
                                    {PERSONA_TEAM_SIZES.map(size => (
                                        <Chip
                                            key={size.value}
                                            label={t(size.label)}
                                            on={answers.teamSize === size.value}
                                            role="radio"
                                            onPress={() => setAnswers(current => ({ ...current, teamSize: size.value }))}
                                        />
                                    ))}
                                </View>
                            </View>
                        )}
                    </>}

                    {step === 2 && <>
                        <Text style={styles.title} accessibilityRole="header">{t('kissopen.persona.goalsTitle')}</Text>
                        <Text style={styles.lead}>{t('kissopen.persona.goalsLead')}</Text>
                        <View style={styles.chips}>
                            {PERSONA_GOALS.map(goal => {
                                const on = answers.goals.includes(goal.value);
                                return (
                                    <Chip
                                        key={goal.value}
                                        label={t(goal.label)}
                                        on={on}
                                        role="checkbox"
                                        disabled={!on && answers.goals.length >= PERSONA_GOALS_MAX}
                                        onPress={() => setAnswers(current => ({ ...current, goals: personaGoalToggle(current.goals, goal.value) }))}
                                    />
                                );
                            })}
                        </View>
                    </>}
                </View>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
                <View style={styles.footerInner}>
                    {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
                    <View style={styles.actions}>
                        {step > 0 && (
                            <Pressable
                                accessibilityRole="button"
                                disabled={busy}
                                onPress={() => go(step - 1)}
                                style={({ pressed }) => [styles.button, styles.back, pressed && styles.pressed]}
                            >
                                <Text style={styles.backText}>{t('kissopen.persona.previous')}</Text>
                            </Pressable>
                        )}
                        <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ disabled: busy, busy }}
                            disabled={busy}
                            onPress={() => last ? void save(false) : go(step + 1)}
                            style={({ pressed }) => [styles.button, styles.next, busy && styles.nextBusy, pressed && styles.pressed]}
                        >
                            <Text style={styles.nextText} numberOfLines={1}>
                                {!last
                                    ? t('kissopen.persona.next')
                                    : busy
                                        ? t('kissopen.persona.preparing')
                                        : props.editing ? t('common.save') : t('kissopen.persona.finish')}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
});

/*
 * One question's choices, plus a way to say it in the person's own words when
 * none of them fits. Choosing again clears it: every question may be left.
 */
const ChoiceGroup = React.memo(function ChoiceGroup(props: {
    label: string;
    options: OptionList;
    value: string;
    onChange: (value: string) => void;
}) {
    const { theme } = useUnistyles();
    const listed = props.options.some(option => option.value === props.value);
    const custom = props.value !== '' && !listed;
    const [typing, setTyping] = React.useState(custom);
    return (
        <View style={styles.group}>
            <Text style={styles.groupLabel}>{props.label}</Text>
            <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={props.label}>
                {props.options.map(option => (
                    <Chip
                        key={option.value}
                        label={t(option.label)}
                        on={props.value === option.value}
                        role="radio"
                        onPress={() => { setTyping(false); props.onChange(personaChoiceToggle(props.value, option.value)); }}
                    />
                ))}
                <Chip
                    label={t('kissopen.persona.other')}
                    on={typing}
                    role="radio"
                    onPress={() => { setTyping(true); if (listed) props.onChange(''); }}
                />
            </View>
            {typing && (
                <TextInput
                    accessibilityLabel={t('kissopen.persona.ownWords')}
                    autoFocus
                    maxLength={PERSONA_TEXT_MAX}
                    onChangeText={props.onChange}
                    placeholder={t('kissopen.persona.ownWords')}
                    placeholderTextColor={theme.colors.textSecondary}
                    returnKeyType="done"
                    style={styles.input}
                    value={custom ? props.value : ''}
                />
            )}
        </View>
    );
});

const Chip = React.memo(function Chip(props: {
    label: string;
    on: boolean;
    role: 'radio' | 'checkbox';
    disabled?: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            accessibilityRole={props.role}
            accessibilityState={{ checked: props.on, disabled: !!props.disabled }}
            disabled={props.disabled}
            onPress={props.onPress}
            style={({ pressed }) => [styles.chip, props.on && styles.chipOn, props.disabled && styles.chipDisabled, pressed && styles.pressed]}
        >
            <Text style={[styles.chipText, props.on && styles.chipTextOn]}>{props.label}</Text>
        </Pressable>
    );
});

const styles = StyleSheet.create(theme => ({
    root: { flex: 1, backgroundColor: theme.colors.home.bg },
    top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, width: '100%', maxWidth: Math.min(layout.maxWidth, 600), alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    steps: { flex: 1, flexDirection: 'row', gap: 8 },
    step: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
    stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.home.track },
    stepDotOn: { backgroundColor: theme.colors.home.accent },
    stepDigit: { color: theme.colors.home.muted, fontSize: 12, ...Typography.default('semiBold') },
    stepDigitOn: { color: theme.colors.home.onAccent },
    stepLabel: { flexShrink: 1, color: theme.colors.home.muted, fontSize: 12, lineHeight: 16 },
    stepLabelOn: { color: theme.colors.text, ...Typography.default('semiBold') },
    skip: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 4 },
    skipText: { color: theme.colors.home.muted, fontSize: 15, ...Typography.default('semiBold') },
    scroll: { flex: 1 },
    content: { flexGrow: 1, paddingBottom: 24 },
    page: { width: '100%', maxWidth: Math.min(layout.maxWidth, 600), alignSelf: 'center', paddingHorizontal: 20, paddingTop: 20, gap: 16 },
    title: { color: theme.colors.text, fontSize: 26, lineHeight: 34, ...Typography.default('semiBold') },
    lead: { color: theme.colors.home.muted, fontSize: 15, lineHeight: 22, marginTop: -8 },
    group: { gap: 10, marginTop: 4 },
    groupLabel: { color: theme.colors.text, fontSize: 15, ...Typography.default('semiBold') },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.home.border, backgroundColor: theme.colors.home.card },
    chipOn: { borderColor: theme.colors.home.accent, backgroundColor: theme.colors.home.accentSoft },
    chipDisabled: { opacity: 0.4 },
    chipText: { color: theme.colors.text, fontSize: 15 },
    chipTextOn: { color: theme.colors.home.accent, ...Typography.default('semiBold') },
    input: { minHeight: 46, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.home.border, backgroundColor: theme.colors.home.card, color: theme.colors.text, fontSize: 16 },
    roles: { gap: 10 },
    role: {
        flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 76, padding: 14, borderRadius: 18,
        borderWidth: 1.5, borderColor: theme.colors.home.border, backgroundColor: theme.colors.home.card,
    },
    roleOn: { borderColor: theme.colors.home.accent, backgroundColor: theme.colors.home.accentSoft },
    roleArt: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden' },
    roleCopy: { flex: 1, gap: 2 },
    roleTitle: { color: theme.colors.text, fontSize: 16, lineHeight: 22, ...Typography.default('semiBold') },
    roleDetail: { color: theme.colors.home.muted, fontSize: 13, lineHeight: 18 },
    footer: { borderTopWidth: 1, borderTopColor: theme.colors.home.border, backgroundColor: theme.colors.home.bg, paddingTop: 12 },
    footerInner: { width: '100%', maxWidth: Math.min(layout.maxWidth, 600), alignSelf: 'center', paddingHorizontal: 20, gap: 10 },
    error: { color: theme.colors.home.peachText, fontSize: 14, lineHeight: 20 },
    actions: { flexDirection: 'row', gap: 12 },
    button: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
    back: { borderWidth: 1, borderColor: theme.colors.home.border, backgroundColor: theme.colors.home.card },
    backText: { color: theme.colors.text, fontSize: 16, ...Typography.default('semiBold') },
    next: { flex: 1, backgroundColor: theme.colors.home.accent },
    nextBusy: { opacity: 0.7 },
    nextText: { color: theme.colors.home.onAccent, fontSize: 16, ...Typography.default('semiBold') },
    pressed: { opacity: 0.7 },
}));
