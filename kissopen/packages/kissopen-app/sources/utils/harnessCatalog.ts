import type { NewSessionAgentType } from '@/sync/persistence';

/**
 * The coding agents Kissopen can start a session with, and what to call them in
 * the UI. `rig` is the wire/CLI id of Kissopen's own agent; it is only ever shown
 * as "KissOpen". `agy` is Antigravity's binary name for the same reason.
 */
export const HARNESS_NAMES: Record<NewSessionAgentType, string> = {
    claude: 'Claude Code',
    codex: 'Codex',
    rig: 'KissOpen',
    agy: 'Antigravity',
    gemini: 'Gemini',
    openclaw: 'OpenClaw',
};

/**
 * Harnesses you can no longer start a session with.
 *
 * Gemini's CLI login is dead for individual accounts — it now refuses with
 * "This client is no longer supported […] migrate to the Antigravity suite",
 * which is the `agy` harness. OpenClaw is shelved for now. Both stay in
 * HARNESS_NAMES so an existing session still shows a real product name, and
 * neither is removed from the CLI, the wire, or the transcript renderers.
 */
export const RETIRED_HARNESSES: ReadonlySet<NewSessionAgentType> = new Set([
    'gemini',
    'openclaw',
]);

/** Pick order for every harness list: the ones people reach for come first. */
export const HARNESS_ORDER: readonly NewSessionAgentType[] = [
    'claude',
    'codex',
    'agy',
    'rig',
];

export function isRetiredHarness(key: NewSessionAgentType | string): boolean {
    return RETIRED_HARNESSES.has(key as NewSessionAgentType);
}

export type HarnessAvailability = Partial<Record<NewSessionAgentType, boolean>>;

export type HarnessOption = {
    key: NewSessionAgentType;
    name: string;
};

export function getHarnessName(key: NewSessionAgentType | string): string {
    return HARNESS_NAMES[key as NewSessionAgentType] ?? key;
}

/** Whether this machine has given the app enough evidence to offer a harness. */
export function isHarnessAvailable({
    availability,
    kissopenAgentAvailable,
    key,
}: {
    availability?: HarnessAvailability | null;
    kissopenAgentAvailable: boolean;
    key: NewSessionAgentType;
}): boolean {
    if (key === 'rig') return kissopenAgentAvailable;
    // Antigravity is niche enough that an old or incomplete capability report
    // must not advertise it speculatively. Its daemon has to say it is installed.
    if (key === 'agy') return availability?.agy === true;
    return !availability || availability[key] === true;
}

/**
 * The harnesses a machine actually has set up, in pick order.
 *
 * A harness with no CLI on the machine is left out rather than shown disabled:
 * a greyed-out row reads as something you can turn on from here, and you
 * cannot. Two things keep the list from ever being empty — the current
 * selection is usually included, and a machine that reports no capabilities at
 * all (an older daemon, or none selected yet) falls back to the familiar
 * catalog. Antigravity is the exception to both fallbacks: it is only listed
 * after an explicit installation report. A retired harness is also exempt from
 * the first rule, because keeping it listed would strand someone on it.
 */
export function listAvailableHarnesses({
    availability,
    kissopenAgentAvailable,
    selected,
}: {
    availability?: HarnessAvailability | null;
    kissopenAgentAvailable: boolean;
    selected?: NewSessionAgentType | null;
}): HarnessOption[] {
    const keys = HARNESS_ORDER.filter((key) => (
        (key === selected && key !== 'agy')
        || isHarnessAvailable({ availability, kissopenAgentAvailable, key })
    ));
    const fallback = HARNESS_ORDER.filter((key) => key !== 'agy');
    return (keys.length > 0 ? keys : fallback).map((key) => ({
        key,
        name: HARNESS_NAMES[key],
    }));
}
