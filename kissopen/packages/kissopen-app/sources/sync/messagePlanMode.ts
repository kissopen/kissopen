import type { NormalizedMessage } from './typesRaw';

/** Last explicit plan transition in a batch; null means it says nothing. */
export function messagePlanMode(messages: NormalizedMessage[]): boolean | null {
    let planMode: boolean | null = null;
    for (const message of messages) {
        if (message.role !== 'agent') continue;
        for (const content of message.content) {
            if (content.type !== 'tool-call') continue;
            if (content.name === 'EnterPlanMode' || content.name === 'enter_plan_mode') planMode = true;
            if (content.name === 'ExitPlanMode' || content.name === 'exit_plan_mode') planMode = false;
        }
    }
    return planMode;
}