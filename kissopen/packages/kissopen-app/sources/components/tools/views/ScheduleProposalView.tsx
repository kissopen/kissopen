import * as React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { RoundButton } from '@/components/RoundButton';
import { Typography } from '@/constants/Typography';
import { scheduleDraftIntentSet } from '@/kissopen/scheduleIntent';
import { t } from '@/text';
import { ToolViewProps } from './_all';

/**
 * A task the assistant proposed, waiting for the person.
 *
 * The assistant cannot schedule anything: it does not know where a task could
 * run, and a plan that existed before the person read it is exactly what
 * Scheduled tasks exists to prevent. So its proposal is a card, and pressing it
 * opens Scheduled tasks with the request already said — the server reads it the
 * way it reads anything typed there, asks about the timing if it must, and shows
 * the plan before anything exists.
 */
export const ScheduleProposalView = React.memo<ToolViewProps>(({ tool }) => {
    const router = useRouter();
    const request = requestOf(tool.input);
    if (!request) return null;
    return (
        <View style={styles.card}>
            <Text style={styles.request}>{request}</Text>
            <Text style={styles.hint}>{t('kissopen.schedules.proposalHint')}</Text>
            <RoundButton
                title={t('kissopen.schedules.proposalOpen')}
                size="normal"
                onPress={() => {
                    scheduleDraftIntentSet(request);
                    // The schedules surface is a section of the home, not a
                    // route; the home takes the intent when it is shown.
                    router.navigate('/');
                }}
            />
        </View>
    );
});

/** The one sentence the assistant wrote, from wherever the call carries it. */
function requestOf(input: unknown): string | undefined {
    const record = input as { request?: unknown; input?: { request?: unknown } } | null | undefined;
    const value = record?.request ?? record?.input?.request;
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

const styles = StyleSheet.create(theme => ({
    card: { gap: 10, paddingHorizontal: 12, paddingVertical: 12 },
    request: { color: theme.colors.text, fontSize: 15, lineHeight: 22, ...Typography.default() },
    hint: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19, ...Typography.default() },
}));
