import * as React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { MessageView } from '@/components/MessageView';
import { RoundButton } from '@/components/RoundButton';
import { SessionComposer } from '@/-session/SessionComposer';
import { Typography } from '@/constants/Typography';
import { t } from '@/text';
import type { Message as DisplayMessage } from '@/sync/typesMessage';
import { api } from './api/client';
import { KissopenLoader } from './KissopenLoader';
import { absolute, describeRecurrence } from './scheduleText';

interface Draft {
    readonly name: string;
    readonly instruction: string;
    readonly target: string;
    readonly timezone: string;
    readonly recurrence: string;
    readonly weekday: number;
    readonly at_minute: number;
    readonly once_at: number;
    readonly next_run_at: number;
}

/** One line of what was said while settling this task. */
interface Line {
    readonly id: string;
    readonly who: 'person' | 'server';
    readonly text: string;
    /** Answers offered to this question, when it was one. */
    readonly choices?: readonly string[];
}

/** What the server is told of the exchange so far. */
interface Said {
    readonly who: 'person' | 'server';
    readonly text: string;
}

/**
 * Creating a schedule by talking about it.
 *
 * Nobody is asked for a cron expression, and nobody is asked to rewrite their
 * sentence either. What is typed goes to the server; when the server cannot
 * tell when this should run it asks, in the transcript, with the likely
 * answers to tap — the same way an assistant asks anywhere else in this app.
 * The whole exchange travels with the next line, so an answer means something
 * beside the question it answers.
 *
 * Nothing exists until the plan has been shown, with its first run spelled
 * out, and confirmed. Saying "created" before the server has answered with a
 * schedule is the other half of that.
 */
export function ScheduleCreate({ targets, folders, initialRequest, onCreated, onCancel }: {
    /**
     * Where a task can run: the cloud workspace, and each computer the server
     * will accept one for. The model never picks this — a task that quietly
     * landed on somebody's laptop is the failure the design forbids — so the
     * reader picks, and the cloud is the default.
     */
    targets: readonly { value: string; label: string }[];
    /** The folders on one machine, by target. Empty for the cloud, which has one home. */
    folders: (target: string) => readonly { path: string; name: string }[];
    /**
     * What an assistant proposed in a conversation. It is said as the first
     * line, as if typed here, so the server reads it the same way and asks the
     * same questions — the person still confirms before anything exists.
     */
    initialRequest?: string;
    onCreated: () => void;
    onCancel: () => void;
}) {
    const [lines, setLines] = React.useState<readonly Line[]>([]);
    const [draft, setDraft] = React.useState<Draft>();
    const [error, setError] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [target, setTarget] = React.useState('cloud');
    /** The folder's path, or '' for the machine's own assistant. */
    const [folder, setFolder] = React.useState('');
    const list = React.useRef<ScrollView>(null);
    const counter = React.useRef(0);
    const nextId = () => { counter.current += 1; return `schedule:new:${counter.current}`; };

    // The phone's own zone, so "tomorrow at nine" means the reader's nine.
    const timezone = React.useMemo(() => {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'; }
        catch { return 'Asia/Shanghai'; }
    }, []);

    const say = React.useCallback(async (spoken: string): Promise<boolean> => {
        const said = spoken.trim();
        if (!said || busy) return false;
        // What went before, without the line just said: that travels as the
        // newest thing, which is what the server is being asked to read.
        const before: Said[] = lines.map(line => ({ who: line.who, text: line.text }));
        setLines(current => [...current, { id: nextId(), who: 'person', text: said }]);
        setError(''); setDraft(undefined); setBusy(true);
        try {
            const answer = await api<{ draft?: Draft; needs?: string; choices?: string[] }>(
                '/schedules/draft', 'POST', { text: said, timezone, ...(before.length ? { said: before } : {}) },
            );
            const reply = answer.draft
                ? t('kissopen.schedules.draftLine', {
                    name: answer.draft.name,
                    rule: describeRecurrence(answer.draft),
                    time: absolute(answer.draft.next_run_at),
                })
                : answer.needs ?? '';
            setDraft(answer.draft);
            setLines(current => [...current, {
                id: nextId(), who: 'server', text: reply,
                ...(answer.choices?.length ? { choices: answer.choices } : {}),
            }]);
            return true;
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return false;
        } finally {
            setBusy(false);
        }
    }, [busy, lines, timezone]);

    // Said once, when the screen opens with a proposal. The ref keeps a second
    // render — or a strict-mode remount — from sending it again.
    const proposed = React.useRef(false);
    React.useEffect(() => {
        if (!initialRequest || proposed.current) return;
        proposed.current = true;
        void say(initialRequest);
    }, [initialRequest, say]);

    const create = React.useCallback(async () => {
        if (busy || !draft) return;
        setBusy(true); setError('');
        try {
            const chosen = folders(target).find(one => one.path === folder);
            await api('/schedules', 'POST', {
                target, name: draft.name, instruction: draft.instruction,
                ...(chosen ? { project_path: chosen.path, project_name: chosen.name } : {}),
                timezone: draft.timezone, recurrence: draft.recurrence, weekday: draft.weekday,
                at_minute: draft.at_minute, once_at: draft.once_at,
            });
            onCreated();
        } catch (e) {
            // Nothing was created. Saying otherwise would put a task in the
            // list that does not exist.
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }, [busy, draft, folder, folders, onCreated, target]);

    /*
     * The transcript, in the app's own message renderer.
     *
     * A question keeps its offered answers only while it is the last thing
     * said: tapping one is the same as typing it, and an answer to a question
     * three lines back is an answer to something already settled.
     */
    const messages = React.useMemo<DisplayMessage[]>(() => lines.map((line, index) => ({
        kind: line.who === 'person' ? 'user-text' as const : 'agent-text' as const,
        id: line.id, localId: null, createdAt: index,
        text: line.choices?.length && index === lines.length - 1 && !busy
            ? `${line.text}\n<options>\n${line.choices.map(choice => `<option>${choice}</option>`).join('\n')}\n</options>`
            : line.text,
    })), [busy, lines]);

    return <View style={styles.screen}>
        <ScrollView
            ref={list}
            style={styles.transcript}
            contentContainerStyle={styles.transcriptBody}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        >
            <View style={styles.head}>
                <Text style={styles.title}>{t('kissopen.schedules.createTitle')}</Text>
                <RoundButton title={t('common.cancel')} display="inverted" size="small" onPress={onCancel} />
            </View>
            <Text style={styles.description}>{t('kissopen.schedules.createHint')}</Text>
            {messages.map(message => <MessageView
                key={message.id}
                message={message}
                metadata={null}
                sessionId="schedule:new"
                onOptionPress={option => { void say(option.title); }}
            />)}
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            {busy && <View style={styles.center}><KissopenLoader size={24} /></View>}
        </ScrollView>

        {/* Where the reader commits, above the line they can still type on. */}
        {!!draft && <View style={styles.confirm}>
            <Text style={styles.rowLabel}>{t('kissopen.schedules.target')}</Text>
            <View style={styles.choices}>
                {targets.map(option => {
                    const chosen = option.value === target;
                    return <Pressable
                        key={option.value}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: chosen }}
                        disabled={busy}
                        style={({ pressed }) => [styles.choice, chosen && styles.chosen, pressed && { opacity: 0.7 }]}
                        onPress={() => { setTarget(option.value); setFolder(''); }}
                    >
                        <Text numberOfLines={1} style={[styles.choiceText, chosen && styles.chosenText]}>{option.label}</Text>
                    </Pressable>;
                })}
            </View>
            {folders(target).length > 0 && <>
                {/* Only on a machine with folders the relay knows. The
                    assistant is the default: a task that names no folder is a
                    message to it, as before. */}
                <Text style={styles.rowLabel}>{t('kissopen.schedules.runsIn')}</Text>
                <View style={styles.choices}>
                    {[{ path: '', name: t('kissopen.schedules.machineAssistant') }, ...folders(target)].map(option => {
                        const chosen = option.path === folder;
                        return <Pressable
                            key={option.path || 'assistant'}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: chosen }}
                            disabled={busy}
                            style={({ pressed }) => [styles.choice, chosen && styles.chosen, pressed && { opacity: 0.7 }]}
                            onPress={() => setFolder(option.path)}
                        >
                            <Text numberOfLines={1} style={[styles.choiceText, chosen && styles.chosenText]}>{option.name}</Text>
                        </Pressable>;
                    })}
                </View>
            </>}
            <RoundButton title={t('kissopen.schedules.confirmCreate')} loading={busy} onPress={() => void create()} />
        </View>}

        <SessionComposer onSubmit={say} />
    </View>;
}

const styles = StyleSheet.create(theme => ({
    screen: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
    transcript: { flex: 1 },
    transcriptBody: { padding: 20, gap: 12, flexGrow: 1, justifyContent: 'flex-end' },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    title: { color: theme.colors.text, fontSize: 24, flexGrow: 1, ...Typography.default('semiBold') },
    description: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 23, marginBottom: 4 },
    error: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21 },
    confirm: {
        gap: 12, paddingHorizontal: 20, paddingVertical: 12,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    choice: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
        backgroundColor: theme.colors.surface, maxWidth: '100%',
    },
    chosen: { backgroundColor: theme.colors.text },
    choiceText: { color: theme.colors.textSecondary, fontSize: 13 },
    chosenText: { color: theme.colors.surface },
    rowLabel: { color: theme.colors.textSecondary, fontSize: 14, flexGrow: 1, flexShrink: 0 },
    rowValue: { color: theme.colors.text, fontSize: 14, flexShrink: 1, textAlign: 'right' },
    center: { alignItems: 'center', paddingVertical: 16 },
}));
