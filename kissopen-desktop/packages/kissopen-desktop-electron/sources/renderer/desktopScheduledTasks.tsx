import { useSyncExternalStore } from "react";
import { RelaySchedulesView } from "./relaySchedulesView";
import type { CloudRequest } from "./relayCloudApi";
import {
    LOCAL_KISSOPEN_AGENT_ID,
    type KissopenAgentDirectoryStore,
} from "./kissopenAgentDirectoryStore";
import type { KissopenStore } from "kissopen-desktop-state";

/** Supplies account-owned machine metadata, without mounting cloud chat or boards. */
export function DesktopScheduledTasks(props: {
    readonly request: CloudRequest;
    readonly directory: KissopenAgentDirectoryStore;
    readonly account: KissopenStore;
}) {
    const state = useSyncExternalStore(
        props.directory.subscribe,
        props.directory.get,
        props.directory.get,
    );
    const account = useSyncExternalStore(
        props.account.subscribe,
        props.account.get,
        props.account.get,
    );
    return (
        <RelaySchedulesView
            key={account.scheduleNavigation}
            {...(account.scheduleDraft === null ? {} : { draft: account.scheduleDraft })}
            {...(account.scheduleFocus === null ? {} : { focus: account.scheduleFocus })}
            onDraftSettled={props.account.scheduleProposalSettle}
            request={props.request}
            allowCloud={false}
            machines={[]}
            projects={[]}
            sessions={[]}
            localProjects={
                state.kissopenAgents
                    .find((entry) => entry.id === LOCAL_KISSOPEN_AGENT_ID)
                    ?.projects.filter((project) => project.kind === "regular")
                    .map((project) => ({ path: project.path, name: project.name })) ?? []
            }
        />
    );
}
