/*
Remote control: the account's machines, as cards, each listing its projects.

Shaped after the Providers page, because it is the same kind of page — a set of
things the account has, each with what it holds inside it — and a reader who
has learnt one should not have to learn the other. The machine is the card; the
projects on it are the rows.

A project is picked, not a machine: "work on that computer" is not something a
person means, and "that project, over there" is. Picking one opens it.
*/
import { Badge, Box, EmptyState, Icon, KissopenPageHeading, ScrollArea } from "kissopen-desktop-ui";
import { t } from "kissopen-desktop-state";
import type { RelayMachineView, RelayProjectView, RelayState } from "../shared/relayContract";
import { relayMachineName } from "./relayStore";

/*
The conversations on a machine that belong to no project.

They are still work, and still reachable, so the card ends with a row for them
rather than quietly listing fewer conversations than the machine has. Its id is
one no project can have.
*/
export const RELAY_LOOSE_PROJECT = "";

export function RelayMachinesView(props: {
    readonly state: RelayState;
    /** How many conversations each machine holds, by machine id. */
    readonly counts: ReadonlyMap<string, number>;
    /** Conversations on a machine that name no project, by machine id. */
    readonly loose: ReadonlyMap<string, number>;
    readonly onPick: (machineId: string, projectId: string) => void;
}) {
    if (!props.state) {
        return (
            <EmptyState
                icon="agents"
                title={t("还没有连上账号")}
                description={t("登录后这里会列出账号里的机器。")}
            />
        );
    }
    if (props.state.error) {
        // A source that cannot be reached is not an account with one computer.
        return (
            <EmptyState
                icon="agents"
                title={t("读不到账号里的机器")}
                description={props.state.error}
            />
        );
    }
    if (props.state.machines.length === 0) {
        return (
            <EmptyState
                icon="agents"
                title={t("账号里还没有机器")}
                description={t("在电脑上装好KissOpen智能体，或开通云端工作空间。")}
            />
        );
    }

    return (
        <div className="kissopen-relay-page">
            <KissopenPageHeading
                eyebrow={`${t("KissOpen")} · ${t("在任何设备上继续工作")}`}
                title={t("远程控制")}
                description={t("账号里的每一台机器，以及它们上面的项目。")}
            />
            <ScrollArea className="kissopen-relay-machines-scroll">
                <div className="kissopen-relay-machines">
                    {props.state.machines.map((machine) => {
                        const projects = props.state!.projects.filter(
                            (project) => project.machineId === machine.id,
                        );
                        const loose = props.loose.get(machine.id) ?? 0;
                        return (
                            <article
                                key={machine.id}
                                className="kissopen-relay-machine"
                                data-kind={machine.kind}
                                data-active={machine.active ? "true" : "false"}
                            >
                                <header className="kissopen-relay-machine__header">
                                    <span className="kissopen-relay-machine__glyph">
                                        <Icon
                                            name={machine.kind === "cloud" ? "globe" : "agents"}
                                            size={16}
                                        />
                                    </span>
                                    <Box className="kissopen-relay-machine__naming">
                                        <span className="kissopen-relay-machine__name">
                                            {relayMachineName(machine)}
                                        </span>
                                        <span className="kissopen-relay-machine__meta">
                                            {/* Whether a machine is awake decides whether work
                                        sent to it happens now or waits, so it is said
                                        plainly. */}
                                            {machine.active ? t("在线") : t("离线")}
                                            {" · "}
                                            {countText(props.counts.get(machine.id) ?? 0)}
                                        </span>
                                    </Box>
                                    {badgeOf(machine)}
                                </header>
                                <Box className="kissopen-relay-machine__projects">
                                    {projects.map((project) => (
                                        <button
                                            key={project.id}
                                            type="button"
                                            className="kissopen-relay-project"
                                            onClick={() => props.onPick(machine.id, project.id)}
                                        >
                                            <Icon name="files" size={14} />
                                            <span className="kissopen-relay-project__name">
                                                {projectName(project)}
                                            </span>
                                            <span className="kissopen-relay-project__meta">
                                                {countText(project.sessions)}
                                            </span>
                                        </button>
                                    ))}
                                    {loose > 0 ? (
                                        <button
                                            type="button"
                                            className="kissopen-relay-project"
                                            onClick={() =>
                                                props.onPick(machine.id, RELAY_LOOSE_PROJECT)
                                            }
                                        >
                                            <Icon name="chat" size={14} />
                                            <span className="kissopen-relay-project__name">
                                                {t("其它对话")}
                                            </span>
                                            <span className="kissopen-relay-project__meta">
                                                {countText(loose)}
                                            </span>
                                        </button>
                                    ) : null}
                                    {projects.length === 0 && loose === 0 ? (
                                        <span className="kissopen-relay-machine__empty">
                                            {t("这台机器上还没有工作。")}
                                        </span>
                                    ) : null}
                                </Box>
                            </article>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}

/**
 * What a project calls itself, or what to say when it will not open.
 *
 * A project whose name this account cannot decrypt is not a project called
 * "Untitled" — it is one this window cannot read the name of, and saying so is
 * the honest row.
 */
function projectName(project: RelayProjectView): string {
    return project.name ?? t("读不到名字的项目");
}

/**
 * What marks a machine out.
 *
 * Only two are worth a badge. This computer, so the reader knows which card is
 * the one they are sitting at; and the cloud workspace, because it is the one
 * machine that is always awake and belongs to no desk.
 */
function badgeOf(machine: RelayMachineView) {
    if (machine.kind === "this") return <Badge label={t("本机")} />;
    if (machine.kind === "cloud") return <Badge label={t("KissOpen")} />;
    return null;
}

function countText(count: number): string {
    return count === 0 ? t("没有对话") : t("{count} 个对话", { count });
}
