import { t } from "kissopen-desktop-state";
import { useState } from "react";
import { secretaryStillUrl } from "./assets";
import { Icon, type IconName } from "./Icon";
import { ScrollArea } from "./Scrollbar";
import { SegmentedControl } from "./SegmentedControl";

export type AssistantPanelItem = {
    readonly id: string;
    readonly icon: IconName;
    readonly title: string;
    readonly detail?: string;
    /** When it happened, already in words — "12:33", "昨天". */
    readonly when?: string;
    /** Marks an item that waits on the person, or is working now. */
    readonly tone?: "waiting" | "working";
    readonly onOpen?: () => void;
};

export type AssistantPanelTab = "activity" | "todo" | "running" | "files";

export type AssistantPanelProps = {
    readonly name: string;
    /** Whether the assistant can be reached now. */
    readonly connected: boolean;
    readonly activity: readonly AssistantPanelItem[];
    readonly todo: readonly AssistantPanelItem[];
    readonly running: readonly AssistantPanelItem[];
    readonly files: readonly AssistantPanelItem[];
    /** Browser notifications, where the page can offer them. */
    readonly notifications?: {
        readonly state: "on" | "off" | "blocked" | "unavailable";
        readonly onEnable: () => void;
    };
    /** Where the panel opens; it keeps its own choice after that. */
    readonly initialTab?: AssistantPanelTab;
};

const EMPTY: Record<AssistantPanelTab, string> = {
    activity: "今天还没有动静。对话、计划任务和看板的变化会出现在这里。",
    todo: "没有等你决定的事。",
    running: "现在没有在进行的工作。",
    files: "项目里上传和生成的文件会出现在这里。",
};

/**
 * C-303 AssistantPanel — the assistant's column in the web client.
 *
 * Who is working for the person and whether it can be reached, then four
 * short lists: what happened today, what waits on them, what is running now
 * and the files lately made or handed over. Every row opens the thing it is
 * about. Which list is showing is the panel's own; everything else is props.
 */
export function AssistantPanel(props: AssistantPanelProps) {
    const [tab, setTab] = useState<AssistantPanelTab>(props.initialTab ?? "activity");
    const items = props[tab];
    return (
        <section className="kissopen-assistant-panel" data-kissopen-desktop-ui="assistant-panel">
            <header className="kissopen-assistant-panel__head">
                <img
                    alt=""
                    className="kissopen-assistant-panel__avatar"
                    draggable={false}
                    src={secretaryStillUrl}
                />
                <span className="kissopen-assistant-panel__name">{props.name}</span>
                <span
                    className="kissopen-assistant-panel__status"
                    data-connected={props.connected ? "" : undefined}
                >
                    <span className="kissopen-assistant-panel__dot" aria-hidden="true" />
                    {props.connected ? t("已连接") : t("连接中断")}
                </span>
                {props.notifications?.state === "off" && (
                    <button
                        className="kissopen-assistant-panel__notify"
                        onClick={props.notifications.onEnable}
                        type="button"
                    >
                        <Icon name="bell" size={14} />
                        {t("开启浏览器通知")}
                    </button>
                )}
                {props.notifications?.state === "blocked" && (
                    <span className="kissopen-assistant-panel__notify-note">
                        {t("浏览器已屏蔽通知")}
                    </span>
                )}
            </header>
            <div className="kissopen-assistant-panel__tabs">
                <SegmentedControl
                    aria-label={t("小秘书")}
                    onChange={(value) => setTab(value as AssistantPanelTab)}
                    segments={[
                        { value: "activity", label: t("动态"), icon: "history" },
                        {
                            value: "todo",
                            label: props.todo.length
                                ? `${t("待办")} ${props.todo.length}`
                                : t("待办"),
                            icon: "check-circle",
                        },
                        {
                            value: "running",
                            label: props.running.length
                                ? `${t("运行中")} ${props.running.length}`
                                : t("运行中"),
                            icon: "clock",
                        },
                        { value: "files", label: t("文件"), icon: "files" },
                    ]}
                    size="small"
                    value={tab}
                />
            </div>
            <ScrollArea
                className="kissopen-assistant-panel__scroll"
                viewportClassName="kissopen-assistant-panel__viewport"
            >
                {items.length === 0 ? (
                    <p className="kissopen-assistant-panel__empty">{t(EMPTY[tab])}</p>
                ) : (
                    <ul className="kissopen-assistant-panel__list">
                        {items.map((item) => (
                            <li key={item.id}>
                                <button
                                    className="kissopen-assistant-panel__item"
                                    data-tone={item.tone}
                                    disabled={!item.onOpen}
                                    onClick={item.onOpen}
                                    type="button"
                                >
                                    <span
                                        className="kissopen-assistant-panel__icon"
                                        aria-hidden="true"
                                    >
                                        <Icon name={item.icon} size={16} />
                                    </span>
                                    <span className="kissopen-assistant-panel__copy">
                                        <span className="kissopen-assistant-panel__title">
                                            {item.title}
                                        </span>
                                        {item.detail && (
                                            <span className="kissopen-assistant-panel__detail">
                                                {item.detail}
                                            </span>
                                        )}
                                        {item.when && (
                                            <span className="kissopen-assistant-panel__when">
                                                {item.when}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </ScrollArea>
        </section>
    );
}
