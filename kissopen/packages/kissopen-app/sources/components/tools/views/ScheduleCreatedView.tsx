import { machineOwnName } from '@/utils/machineOwnName';
import * as React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { scheduleIntentSet } from '@/kissopen/scheduleIntent';
import { describeRecurrence, describeTarget } from '@/kissopen/scheduleText';
import { useMachine } from '@/sync/storage';
import { t } from '@/text';
import { type CreatedSchedule, parseScheduleCreation } from '@/utils/scheduleCreation';
import { toolResultText } from '@/utils/toolResult';
import { ToolViewProps } from './_all';

/**
 * A scheduled task the assistant made.
 *
 * The card's header says it was created (see knownTools); the body is the task.
 *
 * The server has already created it, so this is a confirmation and nothing
 * more: what it is called, when it runs and where. There is nothing to press
 * to make it happen; pressing it opens the task in Scheduled tasks, where it
 * can be paused or deleted like any other.
 *
 * While the call runs, the card header shows the ordinary running state. When
 * the server needs the time made clearer, the assistant asks in its own words,
 * so nothing is drawn here; a failure is one quiet line.
 */
export const ScheduleCreatedView = React.memo<ToolViewProps>(({ tool }) => {
    const answer = parseScheduleCreation(tool.result);
    if (answer?.status === 'created') return <CreatedCard schedule={answer.schedule} />;
    if (answer?.status === 'failed') return <FailedLine error={answer.error} />;
    if (!answer && tool.state === 'error') return <FailedLine error={toolResultText(tool.result) ?? ''} />;
    return null;
});

function CreatedCard({ schedule }: { schedule: CreatedSchedule }) {
    const router = useRouter();
    const machineId = schedule.target.startsWith('machine:') ? schedule.target.slice('machine:'.length) : '';
    const machine = useMachine(machineId);
    const machineName = machineOwnName(machine?.metadata?.displayName) || machine?.metadata?.host || undefined;
    const place = [describeTarget(schedule, machineName), schedule.project_name].filter(Boolean).join(' · ');
    const body = (
        <View style={styles.card}>
            <Text style={styles.name} numberOfLines={2}>{schedule.name}</Text>
            {schedule.recurrence ? <Text style={styles.line} numberOfLines={1}>{describeRecurrence(schedule)}</Text> : null}
            <Text style={styles.line} numberOfLines={1}>{place}</Text>
        </View>
    );
    if (!schedule.id) return body;
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${schedule.name}, ${t('kissopen.schedules.createdOpen')}`}
            onPress={() => {
                // The schedules surface is a section of the home, not a route;
                // the home takes the intent and opens this task's detail.
                scheduleIntentSet(schedule.id, '');
                router.navigate('/');
            }}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
            {body}
        </Pressable>
    );
}

function FailedLine({ error }: { error: string }) {
    return (
        <Text style={styles.failed} numberOfLines={2}>
            {t('kissopen.schedules.createFailed', { error })}
        </Text>
    );
}

const styles = StyleSheet.create(theme => ({
    card: { gap: 4, paddingHorizontal: 12, paddingVertical: 10 },
    name: { color: theme.colors.text, fontSize: 15, lineHeight: 21, ...Typography.default('semiBold') },
    line: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18, ...Typography.default() },
    failed: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18, paddingHorizontal: 12, paddingVertical: 8, ...Typography.default() },
}));
