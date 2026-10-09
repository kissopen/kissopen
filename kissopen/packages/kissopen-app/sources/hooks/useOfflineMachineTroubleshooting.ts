import * as React from 'react';
import * as Clipboard from 'expo-clipboard';
import type { MachineChoice } from '@/sync/machineChoices';
import { useSessions } from '@/sync/storage';
import { Modal } from '@/modal';
import { t } from '@/text';
import { buildOfflineMachineTroubleshooting } from '@/utils/offlineMachineTroubleshooting';

export function useOfflineMachineTroubleshooting(choices: readonly MachineChoice[]): () => void {
    const sessions = useSessions();
    const guide = React.useMemo(
        () => buildOfflineMachineTroubleshooting(choices, sessions, {
            steps: [
                t('components.emptyMainScreen.troubleshootStepWake'),
                t('components.emptyMainScreen.troubleshootStepRun'),
                t('components.emptyMainScreen.troubleshootStepReopen'),
            ],
            aiPromptLabel: t('components.emptyMainScreen.troubleshootAiPromptLabel'),
        }),
        [choices, sessions],
    );

    return React.useCallback(() => {
        Modal.alert(t('components.emptyMainScreen.troubleshootTitle'), guide.message, [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('components.emptyMainScreen.copyAiPrompt'),
                onPress: () => {
                    void Clipboard.setStringAsync(guide.aiPrompt).catch(() => {
                        Modal.alert(t('common.error'), t('components.emptyMainScreen.copyAiPromptFailed'));
                    });
                },
            },
        ]);
    }, [guide]);
}