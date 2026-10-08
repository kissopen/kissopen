import type { MachineChoice } from '@/sync/machineChoices';
import type { SessionListItem } from '@/sync/storage';

/** The person-facing lines of the guide; the AI prompt itself stays in English. */
export type OfflineMachineTroubleshootingText = {
    steps: readonly string[];
    aiPromptLabel: string;
};

const DEFAULT_TEXT: OfflineMachineTroubleshootingText = {
    steps: [
        '1. Wake the machine and check internet.',
        '2. Run `kissopen` again.',
        '3. Reopen KissOpen.',
    ],
    aiPromptLabel: 'AI prompt:',
};

export type OfflineMachineTroubleshooting = {
    machineName: string;
    projectName: string;
    kissopenHomeDir: string;
    aiPrompt: string;
    message: string;
};

function projectNameFromPath(path: string | null | undefined): string | null {
    const normalized = path?.trim().replace(/[/\\]+$/, '');
    if (!normalized) return null;
    return normalized.split(/[/\\]/).pop() || null;
}

/**
 * Builds the compact offline help shown when an account has machines but none are reachable.
 * The newest known project chooses the machine so the copyable AI prompt points at useful local
 * Kissopen logs instead of giving generic networking advice.
 */
export function buildOfflineMachineTroubleshooting(
    choices: readonly MachineChoice[],
    sessions: readonly SessionListItem[] | null,
    text: OfflineMachineTroubleshootingText = DEFAULT_TEXT,
): OfflineMachineTroubleshooting {
    const sortedSessions = (sessions ?? [])
        .filter((item): item is Exclude<SessionListItem, string> => typeof item !== 'string')
        .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));

    let choice = [...choices].sort((left, right) => right.activeAt - left.activeAt)[0] ?? null;
    let session = null as (typeof sortedSessions)[number] | null;

    for (const candidate of sortedSessions) {
        const candidateChoice = choices.find((item) => item.machineIds.includes(candidate.metadata?.machineId ?? ''));
        if (!candidateChoice) continue;
        choice = candidateChoice;
        session = candidate;
        break;
    }

    const machineName = choice?.name?.trim() || 'this machine';
    const projectName = session?.metadata?.project?.name?.trim()
        || projectNameFromPath(session?.metadata?.path)
        || 'KissOpen';
    const kissopenHomeDir = choice?.kissopenMachine?.metadata?.kissopenHomeDir?.trim()
        || choice?.rigMachine?.metadata?.kissopenHomeDir?.trim()
        || session?.metadata?.kissopenHomeDir?.trim()
        || '~/.kissopen';
    const aiPrompt = `In ${kissopenHomeDir}, diagnose why KissOpen cannot reach "${machineName}" for project "${projectName}".`;

    return {
        machineName,
        projectName,
        kissopenHomeDir,
        aiPrompt,
        message: [
            ...text.steps,
            '',
            text.aiPromptLabel,
            aiPrompt,
        ].join('\n'),
    };
}