/*
The account's relay, as the window sees it.

The main process holds the credential and does the decrypting; this only
follows what it publishes. So there is no connecting, no retrying and no
error handling here — a relay that cannot be reached is a quiet degradation,
and the window keeps showing this machine.

An external store rather than a hook, matching the other bridge-backed state
in this folder, so a React tree can subscribe to it with useSyncExternalStore
and a test can drive it without one.
*/
import type { KissopenDesktopBridge } from "../shared/desktopContract";
import { t } from "kissopen-desktop-state/i18n";
import type {
    RelayMachineView,
    RelayProjectView,
    RelaySessionView,
    RelayState,
} from "../shared/relayContract";

export interface RelayStore {
    /** Null while nobody is signed in, or before the first answer arrives. */
    getSnapshot(): RelayState;
    subscribe(listener: () => void): () => void;
    /** Stops following. The store keeps whatever it last saw. */
    dispose(): void;
}

export function relayStoreCreate(bridge: KissopenDesktopBridge): RelayStore {
    const listeners = new Set<() => void>();
    let snapshot: RelayState = null;

    const publish = (next: RelayState): void => {
        snapshot = next === null ? null : relayWithoutRepeatedMachines(next);
        for (const listener of listeners) listener();
    };

    // Both: the push covers everything from here on, and the ask covers the
    // window that opened after the relay was already being read.
    const unsubscribe = bridge.relaySubscribe(publish);
    void bridge
        .relayGet()
        .then((state) => {
            // A pushed update may already have arrived and be newer than this.
            if (snapshot === null && state !== null) publish(state);
        })
        .catch(() => undefined);

    return {
        getSnapshot: () => snapshot,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        dispose() {
            unsubscribe();
            listeners.clear();
        },
    };
}

/*
One computer's Agent can be on the account's list more than once. Every time
it paired it registered under a new machine id, and the old entries stayed —
this Mac showed three times in 远程控制, one of them offline, and its own
projects appeared again under 云端与其他电脑的项目. The entries of one
installation share its host and its Agent's folder, which is how they are
told apart from two computers.

This computer's installation keeps only the entry that is this computer: the
others' conversations are its own, already listed as its projects. Another
computer's older entries are left out only when they hold no conversations,
so nothing that can be opened goes missing.
*/
export function relayWithoutRepeatedMachines(
    state: NonNullable<RelayState>,
): NonNullable<RelayState> {
    const installationOf = (machine: RelayMachineView): string | undefined => {
        const host = machine.metadata?.host;
        const folder = machine.metadata?.kissopenHomeDir;
        if (!host || !folder) return undefined;
        return `${host.toLowerCase()}\0${folder.replace(/[\\/]+$/u, "").toLowerCase()}`;
    };
    const withSessions = new Set(
        state.sessions.flatMap((session) => (session.machineId ? [session.machineId] : [])),
    );
    const groups = new Map<string, RelayMachineView[]>();
    for (const machine of state.machines) {
        const key = installationOf(machine);
        if (key === undefined) continue;
        groups.set(key, [...(groups.get(key) ?? []), machine]);
    }
    const hidden = new Set<string>();
    /*
     * An older entry of another computer that still holds conversations stays,
     * but a project two entries list under the same name is the same folder
     * seen twice, and is shown once.
     */
    const shadowed = new Set<string>();
    for (const machines of groups.values()) {
        if (machines.length < 2) continue;
        const local = machines.find((machine) => machine.kind === "this");
        const newest = machines.reduce((a, b) => (b.activeAt > a.activeAt ? b : a));
        for (const machine of machines) {
            if (local ? machine !== local : machine !== newest && !withSessions.has(machine.id))
                hidden.add(machine.id);
        }
        if (local) continue;
        /*
         * One folder listed by two entries is shown once — the relay lists it
         * under each, with the same project id. The copy kept is the one on the
         * entry that is online, whose conversations can still be asked for its
         * board and files; then the one with conversations that say where the
         * folder is, then more conversations, then the most recent.
         */
        const byName = new Map<string, RelayProjectView>();
        const rank = (project: RelayProjectView): [number, number, number, number] => [
            machines.find((machine) => machine.id === project.machineId)?.active ? 1 : 0,
            state.sessions.some(
                (session) =>
                    session.projectId === project.id &&
                    session.machineId === project.machineId &&
                    typeof session.metadata?.path === "string",
            )
                ? 1
                : 0,
            project.sessions,
            project.updatedAt,
        ];
        const better = (a: RelayProjectView, b: RelayProjectView): boolean => {
            const [x, y] = [rank(a), rank(b)];
            for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return x[i]! > y[i]!;
            return false;
        };
        for (const project of state.projects) {
            if (!project.name || !machines.some((machine) => machine.id === project.machineId))
                continue;
            const kept = byName.get(project.name);
            if (!kept) byName.set(project.name, project);
            else if (better(project, kept)) {
                shadowed.add(`${kept.machineId}:${kept.id}`);
                byName.set(project.name, project);
            } else shadowed.add(`${project.machineId}:${project.id}`);
        }
    }
    if (hidden.size === 0 && shadowed.size === 0) return state;
    return {
        ...state,
        machines: state.machines.filter((machine) => !hidden.has(machine.id)),
        projects: state.projects.filter(
            (project) =>
                !shadowed.has(`${project.machineId}:${project.id}`) &&
                (project.machineId === undefined || !hidden.has(project.machineId)),
        ),
    };
}

/** Cloud is a service, not a host the reader needs to identify. Other computers
 * retain their chosen name, hostname, or ID when metadata is unavailable. */
export function relayMachineName(machine: RelayMachineView): string {
    if (machine.kind === "cloud") return t("云端");
    return machineOwnName(machine.metadata?.displayName) || machine.metadata?.host || machine.id;
}

/*
A machine's name without the product suffix agents before 0.4.69-preview.1029 put after it
("mac-mini — KISSOPEN Agent"). They still report it until they update, and a person reading
which computer a conversation runs on only needs the computer.
*/
function machineOwnName(name: string | undefined): string | undefined {
    return name?.replace(/\s+—\s+(?:KISSOPEN|KissOpen) Agent$/u, "") || undefined;
}

/**
 * What to call a conversation.
 *
 * A bot's conversation is called whatever the bot is called. It is one
 * continuous chat with an identity rather than a thing that turns out to be
 * about something, and its name follows a rename — a summary written once
 * would still say "Chief of Staff" long after the bot was renamed. This is the
 * rule the phone already applies, and the two lists name the same conversation.
 *
 * Everything else takes the title the agent wrote for it — the summary it
 * publishes once the conversation has said enough to be about something — and,
 * until it has one, the working directory's last segment, which is how the
 * person thinks of the place. A session whose metadata will not open under this
 * account's key keeps its place in the list without a name: hiding it would
 * make a conversation that exists look like one that does not.
 */
export function relaySessionName(session: RelaySessionView): string | null {
    const bot = session.metadata?.bot?.name?.trim();
    if (bot) return bot;
    const title = session.metadata?.summary?.text.trim();
    if (title) return title;
    const path = session.metadata?.path;
    if (!path) return null;
    const segments = path.split(/[/\\]/).filter(Boolean);
    return segments.at(-1) ?? path;
}
