import {
    localeCurrent,
    t,
    type KissopenAgentBoardCard,
    type KissopenHomeDigest,
} from "kissopen-desktop-state";
import { BoardCardStateBadge } from "./BoardBlocks";
import { useState, type ReactNode } from "react";
import { ProjectCreateDialog } from "./ProjectCreateDialog";
import { ScrollArea } from "./Scrollbar";
import { Ionicon } from "./vectorIcons/VectorIcon";

/*
The home page: the person's work at a glance, as tiles.

Until the person's own work exists it is a demonstration — written for their
industry and job, and marked as such at the top — and each block that real
work can fill is replaced as soon as there is some. Props only: the caller
owns loading, where "connect my business" goes, and what asking does.
*/

export type KissopenHomeFocusItem = { title: string; icon: string };
export type KissopenHomeData = {
    greeting: string;
    focus: { title: string; summary: string; items: readonly KissopenHomeFocusItem[] };
    team: {
        title: string;
        subtitle: string;
        members: readonly { name: string; group: string }[];
        groups: readonly { name: string; count: number; progress: number }[];
        support: string;
    };
    projects: readonly {
        name: string;
        tag: string;
        progress: number;
        status: string;
        status_label: string;
        picture: string;
    }[];
    forecast: {
        title: string;
        subtitle: string;
        range: string;
        unit: string;
        labels: readonly string[];
        actual: readonly number[];
        predicted: readonly number[];
        note: string;
    };
    wins: {
        title: string;
        value: string;
        label: string;
        delta: string;
        metrics: readonly { label: string; value: string }[];
        bars: readonly number[];
        bar_labels: readonly string[];
        note: string;
    };
};
/** A project the person really has, from any of their machines. */
export type KissopenHomeProject = {
    id: string;
    name: string;
    /** Where it lives, e.g. the machine's name. */
    place: string;
    /** Epoch milliseconds of its newest conversation. */
    updatedAt: number;
    conversations: number;
};
export type KissopenHomeProps = {
    /** How to greet: the account's name. */
    name: string;
    /** The instant the page is drawn for; the greeting and date follow it. */
    now: number;
    /** Absent while the first demonstration is being written. */
    data?: KissopenHomeData;
    error?: string;
    /** Real projects replace the demonstration's when there are any. */
    projects?: readonly KissopenHomeProject[];
    onRetry?: () => void;
    onConnect?: () => void;
    /**
     * Making a project from the home page. The header offers it — as the first
     * project when there is none — in place of connecting a business.
     */
    projectCreate?: {
        readonly first: boolean;
        /** Absent where projects are made in the cloud and have no folder to choose. */
        readonly onFolderPick?: () => Promise<string | undefined>;
        /** Resolves once the project exists and is being opened. */
        readonly onCreate: (name: string, folder?: string) => Promise<void>;
    };
    onAsk?: (text: string) => void;
    onProjectsOpen?: () => void;
    onProjectOpen?: (id: string) => void;
    /**
     * The person's own projects as their boards describe them. Once any board
     * can be read, the page is made of this instead of the demonstration.
     */
    digest?: KissopenHomeDigest;
    /** Opens one of this computer's projects, on its board. */
    onDigestProjectOpen?: (id: string) => void;
    /** Opens one board card's own conversation, in the project it is on. */
    onCardOpen?: (projectId: string, card: KissopenAgentBoardCard) => void;
    /** What the operator wants everyone to know now, shown above everything else. */
    announcements?: readonly {
        id: string;
        title: string;
        body: string;
        level: "info" | "warning";
    }[];
};

const PROJECT_COLORS = ["var(--home-accent)", "var(--home-green)", "var(--home-peach)"];

function greetingOf(now: number): string {
    const hour = new Date(now).getHours();
    if (hour < 5) return t("夜深了");
    if (hour < 11) return t("早上好");
    if (hour < 13) return t("中午好");
    if (hour < 18) return t("下午好");
    return t("晚上好");
}

function dateOf(now: number): string {
    const date = new Date(now);
    if (localeCurrent() !== "zh")
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            weekday: "short",
        });
    const day = date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
    const weekday = date.toLocaleDateString("zh-CN", { weekday: "short" });
    return `${day} · ${weekday}`;
}

function sinceOf(at: number, now: number): string {
    const minutes = Math.max(1, Math.round((now - at) / 60_000));
    if (minutes < 60) return t("{count} 分钟前", { count: minutes });
    const hours = Math.round(minutes / 60);
    if (hours < 24) return t("{count} 小时前", { count: hours });
    return t("{count} 天前", { count: Math.round(hours / 24) });
}

export function KissopenHome(props: KissopenHomeProps) {
    const [creating, setCreating] = useState(false);
    const projectCreate = props.projectCreate;
    const data = props.data;
    const realProjects = props.projects?.length ? props.projects : undefined;
    const digest = props.digest && props.digest.boards > 0 ? props.digest : undefined;
    return (
        <section className="kissopen-home" data-kissopen-desktop-ui="kissopen-home">
            <ScrollArea
                className="kissopen-home__scroll"
                viewportClassName="kissopen-home__viewport"
            >
                <div className="kissopen-home__page">
                    <header className="kissopen-home__header">
                        <div className="kissopen-home__hello">
                            <h1 className="kissopen-home__title">
                                {props.name
                                    ? t("{greeting}, {name}", {
                                          greeting: greetingOf(props.now),
                                          name: props.name,
                                      })
                                    : greetingOf(props.now)}
                            </h1>
                            <div className="kissopen-home__subtitle">
                                {digest ? (
                                    <>
                                        <span>{t("你的项目今天的情况都在这里。")}</span>
                                        <span className="kissopen-home__real-chip">
                                            {t("来自 {count} 个项目的看板", {
                                                count: digest.boards,
                                            })}
                                        </span>
                                    </>
                                ) : (
                                    <span>{data?.greeting ?? t("正在按你的工作准备首页…")}</span>
                                )}
                                {!digest && data && (
                                    <>
                                        <span className="kissopen-home__demo-chip">
                                            {t("AI 生成 · 演示数据")}
                                        </span>
                                        <span className="kissopen-home__demo-note">
                                            {t("连接业务或创建项目后，逐步替换为真实数据")}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="kissopen-home__header-side">
                            <span className="kissopen-home__date">
                                {dateOf(props.now)}
                                <DayIcon now={props.now} />
                            </span>
                            {projectCreate ? (
                                <button
                                    className="kissopen-home__connect"
                                    onClick={() => setCreating(true)}
                                    type="button"
                                >
                                    <Ionicon name="add" size={16} />
                                    {projectCreate.first ? t("创建第一个项目") : t("创建项目")}
                                </button>
                            ) : (
                                props.onConnect && (
                                    <button
                                        className="kissopen-home__connect"
                                        onClick={props.onConnect}
                                        type="button"
                                    >
                                        <LinkIcon />
                                        {t("连接我的业务")}
                                    </button>
                                )
                            )}
                        </div>
                    </header>

                    {props.announcements?.map((notice) => (
                        <div
                            key={notice.id}
                            className="kissopen-home__notice"
                            data-level={notice.level}
                            role="status"
                        >
                            <Ionicon
                                name={
                                    notice.level === "warning"
                                        ? "warning-outline"
                                        : "megaphone-outline"
                                }
                                size={18}
                            />
                            <div>
                                {notice.title && <strong>{notice.title}</strong>}
                                {notice.body && <p>{notice.body}</p>}
                            </div>
                        </div>
                    ))}

                    {digest ? (
                        <DigestPage
                            digest={digest}
                            now={props.now}
                            onProjectOpen={props.onDigestProjectOpen}
                            onCardOpen={props.onCardOpen}
                            {...(props.onProjectsOpen
                                ? { onProjectsOpen: props.onProjectsOpen }
                                : {})}
                        />
                    ) : !data ? (
                        props.error ? (
                            <div className="kissopen-home__problem" role="alert">
                                <span>{props.error}</span>
                                {props.onRetry && (
                                    <button
                                        className="kissopen-home__link"
                                        onClick={props.onRetry}
                                        type="button"
                                    >
                                        {t("重试")}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <HomeSkeleton />
                        )
                    ) : (
                        <>
                            <div className="kissopen-home__row kissopen-home__row--top">
                                <FocusCard focus={data.focus} onAsk={props.onAsk} />
                                <TeamCard team={data.team} />
                            </div>
                            <div className="kissopen-home__row kissopen-home__row--three">
                                <section
                                    className="kissopen-home__card"
                                    aria-labelledby="home-projects"
                                >
                                    <CardHeading
                                        id="home-projects"
                                        title={t("正在推进")}
                                        {...(props.onProjectsOpen
                                            ? {
                                                  action: t("查看全部"),
                                                  onAction: props.onProjectsOpen,
                                              }
                                            : {})}
                                        {...(realProjects ? { badge: t("你的项目") } : {})}
                                    />
                                    <div className="kissopen-home__projects">
                                        {realProjects
                                            ? realProjects.slice(0, 3).map((project, index) => (
                                                  <button
                                                      className="kissopen-home__project kissopen-home__project--real"
                                                      key={project.id}
                                                      onClick={() =>
                                                          props.onProjectOpen?.(project.id)
                                                      }
                                                      type="button"
                                                  >
                                                      <ProjectPicture
                                                          kind={
                                                              REAL_PICTURES[
                                                                  index % REAL_PICTURES.length
                                                              ]!
                                                          }
                                                      />
                                                      <span className="kissopen-home__project-copy">
                                                          <span className="kissopen-home__project-name">
                                                              {project.name}
                                                          </span>
                                                          <span className="kissopen-home__project-tag">
                                                              {project.place}
                                                          </span>
                                                          <span className="kissopen-home__project-meta">
                                                              {t("{since}更新 · {count} 段对话", {
                                                                  since: sinceOf(
                                                                      project.updatedAt,
                                                                      props.now,
                                                                  ),
                                                                  count: project.conversations,
                                                              })}
                                                          </span>
                                                      </span>
                                                  </button>
                                              ))
                                            : data.projects.map((project, index) => (
                                                  <div
                                                      className="kissopen-home__project"
                                                      key={project.name}
                                                  >
                                                      <ProjectPicture kind={project.picture} />
                                                      <span className="kissopen-home__project-copy">
                                                          <span className="kissopen-home__project-name">
                                                              {project.name}
                                                          </span>
                                                          <span className="kissopen-home__project-tag">
                                                              {project.tag}
                                                          </span>
                                                          <span className="kissopen-home__progress-line">
                                                              <span className="kissopen-home__bar">
                                                                  <span
                                                                      className="kissopen-home__bar-fill"
                                                                      style={{
                                                                          width: `${project.progress}%`,
                                                                          background:
                                                                              PROJECT_COLORS[
                                                                                  index % 3
                                                                              ],
                                                                      }}
                                                                  />
                                                              </span>
                                                              <span className="kissopen-home__percent">
                                                                  {project.progress}%
                                                              </span>
                                                          </span>
                                                      </span>
                                                      {project.status !== "on_track" &&
                                                          project.status_label && (
                                                              <span
                                                                  className="kissopen-home__status"
                                                                  data-status={project.status}
                                                              >
                                                                  {project.status_label}
                                                              </span>
                                                          )}
                                                  </div>
                                              ))}
                                    </div>
                                </section>
                                <ForecastCard forecast={data.forecast} />
                                <WinsCard wins={data.wins} />
                            </div>
                        </>
                    )}
                </div>
            </ScrollArea>
            {creating && projectCreate && (
                <ProjectCreateDialog
                    first={projectCreate.first}
                    onCancel={() => setCreating(false)}
                    onCreate={async (name, folder) => {
                        await projectCreate.onCreate(name, folder);
                        setCreating(false);
                    }}
                    {...(projectCreate.onFolderPick
                        ? { onFolderPick: projectCreate.onFolderPick }
                        : {})}
                />
            )}
        </section>
    );
}

const REAL_PICTURES = ["laptop", "document", "chart"];

/*
The page once the person's own projects have boards: today's focus gathered
from every board, the projects and how far along each is, the next milestone
each has not reached, and the figures the boards report. Nothing here is made
up, so nothing is marked as a demonstration.
*/
function DigestPage(props: {
    digest: KissopenHomeDigest;
    now: number;
    onProjectOpen?: ((id: string) => void) | undefined;
    onCardOpen?: ((projectId: string, card: KissopenAgentBoardCard) => void) | undefined;
    onProjectsOpen?: () => void;
}) {
    const { digest } = props;
    // A thing to do opens its card's own conversation, never the home's chat.
    const open = (projectId: string, card: KissopenAgentBoardCard) =>
        props.onCardOpen ? props.onCardOpen(projectId, card) : props.onProjectOpen?.(projectId);
    return (
        <>
            {digest.decisions.length > 0 && (
                <section
                    className="kissopen-home__card kissopen-home__decisions"
                    aria-labelledby="home-digest-decisions"
                >
                    <CardHeading
                        id="home-digest-decisions"
                        title={t("等你决定")}
                        subtitle={t("这些卡片在等你拍板或补资料")}
                    />
                    <div className="kissopen-home__decision-items">
                        {digest.decisions.map((item) => (
                            <button
                                className="kissopen-home__decision"
                                data-state={item.state}
                                key={`${item.projectId}-${item.card.id}`}
                                onClick={() => open(item.projectId, item.card)}
                                title={item.question}
                                type="button"
                            >
                                <span className="kissopen-home__decision-copy">
                                    <span className="kissopen-home__decision-detail">
                                        {item.projectName}
                                    </span>
                                    <span className="kissopen-home__decision-question">
                                        {item.card.title || item.question}
                                    </span>
                                    {item.card.title && item.card.title !== item.question && (
                                        <span className="kissopen-home__decision-description">
                                            {item.question}
                                        </span>
                                    )}
                                </span>
                                <span className="kissopen-home__decision-footer">
                                    <BoardCardStateBadge state={item.state} />
                                    <span className="kissopen-home__focus-go" aria-hidden="true">
                                        <ArrowIcon />
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </section>
            )}
            <div className="kissopen-home__row kissopen-home__row--top">
                <section
                    className="kissopen-home__card kissopen-home__focus"
                    aria-labelledby="home-digest-focus"
                >
                    <div className="kissopen-home__focus-copy">
                        <h2 className="kissopen-home__focus-title" id="home-digest-focus">
                            {t("今天，先关注这几件事")}
                        </h2>
                        <p className="kissopen-home__focus-summary">
                            {digest.focus.length > 0
                                ? t("从 {count} 个项目的看板里挑出来的。", {
                                      count: digest.boards,
                                  })
                                : t("各项目的看板里暂时没有待你决定的事。")}
                        </p>
                        <div className="kissopen-home__focus-items">
                            {digest.focus.map((item) => (
                                <button
                                    className="kissopen-home__focus-item"
                                    key={`${item.projectId}-${item.card.id}`}
                                    onClick={() => open(item.projectId, item.card)}
                                    type="button"
                                >
                                    <span className="kissopen-home__focus-icon">
                                        <FocusIcon kind={BOARD_TO_FOCUS[item.icon] ?? "doc"} />
                                    </span>
                                    <span className="kissopen-home__focus-label">
                                        {item.title}
                                        <span className="kissopen-home__focus-project">
                                            {item.projectName}
                                        </span>
                                    </span>
                                    <span className="kissopen-home__focus-go">
                                        <ArrowIcon />
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <Landscape />
                </section>
                <section className="kissopen-home__card" aria-labelledby="home-digest-milestones">
                    <CardHeading
                        id="home-digest-milestones"
                        title={t("接下来的节点")}
                        subtitle={t("每个项目下一个要到的里程碑")}
                    />
                    <div className="kissopen-home__milestones">
                        {digest.milestones.length === 0 ? (
                            <span className="kissopen-home__empty-line">
                                {t("看板里还没有里程碑。")}
                            </span>
                        ) : (
                            digest.milestones.map((milestone) => (
                                <button
                                    className="kissopen-home__milestone"
                                    data-state={milestone.state}
                                    key={`${milestone.projectId}-${milestone.title}`}
                                    onClick={() => props.onProjectOpen?.(milestone.projectId)}
                                    type="button"
                                >
                                    <span className="kissopen-home__milestone-dot" />
                                    <span className="kissopen-home__milestone-copy">
                                        <span className="kissopen-home__milestone-title">
                                            {milestone.title}
                                        </span>
                                        <span className="kissopen-home__milestone-detail">
                                            {milestone.projectName}
                                            {milestone.detail ? ` · ${milestone.detail}` : ""}
                                        </span>
                                    </span>
                                    <span className="kissopen-home__milestone-state">
                                        {milestone.state === "current" ? t("进行中") : t("待开始")}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </section>
            </div>
            <div className="kissopen-home__row kissopen-home__row--three">
                <section className="kissopen-home__card" aria-labelledby="home-digest-projects">
                    <CardHeading
                        id="home-digest-projects"
                        title={t("正在推进")}
                        badge={t("你的项目")}
                        {...(props.onProjectsOpen
                            ? { action: t("查看全部"), onAction: props.onProjectsOpen }
                            : {})}
                    />
                    <div className="kissopen-home__projects">
                        {digest.projects.slice(0, 4).map((project, index) => (
                            <button
                                className="kissopen-home__project kissopen-home__project--real"
                                key={project.id}
                                onClick={() => props.onProjectOpen?.(project.id)}
                                type="button"
                            >
                                <ProjectPicture
                                    kind={REAL_PICTURES[index % REAL_PICTURES.length]!}
                                />
                                <span className="kissopen-home__project-copy">
                                    <span className="kissopen-home__project-name">
                                        {project.name}
                                    </span>
                                    <span className="kissopen-home__project-tag">
                                        {project.place ? `${project.place} · ` : ""}
                                        {project.hasBoard
                                            ? project.summary
                                            : project.updatedAt > 0
                                              ? t("还没有看板 · {since}更新", {
                                                    since: sinceOf(project.updatedAt, props.now),
                                                })
                                              : t("还没有看板")}
                                    </span>
                                    {project.progress !== undefined && (
                                        <span className="kissopen-home__progress-line">
                                            <span className="kissopen-home__bar">
                                                <span
                                                    className="kissopen-home__bar-fill"
                                                    style={{
                                                        width: `${Math.max(4, project.progress)}%`,
                                                        background: PROJECT_COLORS[index % 3],
                                                    }}
                                                />
                                            </span>
                                            <span className="kissopen-home__percent">
                                                {project.progress}%
                                            </span>
                                        </span>
                                    )}
                                </span>
                            </button>
                        ))}
                    </div>
                </section>
                {digest.stats.length > 0 && (
                    <section className="kissopen-home__card" aria-labelledby="home-digest-stats">
                        <CardHeading
                            id="home-digest-stats"
                            title={t("关键数字")}
                            subtitle={t("各项目看板里报告的数字")}
                        />
                        <div className="kissopen-home__metrics kissopen-home__metrics--wrap">
                            {digest.stats.map((stat) => (
                                <div
                                    className="kissopen-home__metric"
                                    key={`${stat.projectName}-${stat.label}`}
                                >
                                    <span className="kissopen-home__metric-label">
                                        {stat.label} · {stat.projectName}
                                    </span>
                                    <span className="kissopen-home__metric-value">
                                        {stat.value}
                                    </span>
                                    {stat.delta && (
                                        <span
                                            className="kissopen-home__delta"
                                            data-direction={stat.trend === "down" ? "down" : "up"}
                                        >
                                            {stat.delta}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </>
    );
}

/** Board icon words mapped to the focus icons the home draws. */
const BOARD_TO_FOCUS: Record<string, string> = {
    box: "box",
    doc: "doc",
    chart: "chart",
    people: "people",
    calendar: "calendar",
    mail: "mail",
    money: "money",
    image: "image",
    cart: "box",
    flag: "calendar",
    rocket: "chart",
    check: "doc",
    globe: "doc",
    star: "doc",
};

function CardHeading(props: {
    id: string;
    title: string;
    subtitle?: string;
    action?: string;
    onAction?: () => void;
    badge?: string;
}) {
    return (
        <div className="kissopen-home__card-heading">
            <div className="kissopen-home__card-titles">
                <h2 className="kissopen-home__card-title" id={props.id}>
                    {props.title}
                    {props.badge && <span className="kissopen-home__real-chip">{props.badge}</span>}
                </h2>
                {props.subtitle && (
                    <span className="kissopen-home__card-subtitle">{props.subtitle}</span>
                )}
            </div>
            {props.action && props.onAction && (
                <button className="kissopen-home__link" onClick={props.onAction} type="button">
                    {props.action}
                    <ArrowIcon />
                </button>
            )}
        </div>
    );
}

function FocusCard(props: { focus: KissopenHomeData["focus"]; onAsk?: (text: string) => void }) {
    return (
        <section className="kissopen-home__card kissopen-home__focus" aria-labelledby="home-focus">
            <div className="kissopen-home__focus-copy">
                <h2 className="kissopen-home__focus-title" id="home-focus">
                    {props.focus.title}
                </h2>
                <p className="kissopen-home__focus-summary">{props.focus.summary}</p>
                <div className="kissopen-home__focus-items">
                    {props.focus.items.map((item) => (
                        <button
                            className="kissopen-home__focus-item"
                            key={item.title}
                            onClick={() => props.onAsk?.(item.title)}
                            type="button"
                        >
                            <span className="kissopen-home__focus-icon">
                                <FocusIcon kind={item.icon} />
                            </span>
                            <span className="kissopen-home__focus-label">{item.title}</span>
                            <span className="kissopen-home__focus-go">
                                <ArrowIcon />
                            </span>
                        </button>
                    ))}
                </div>
            </div>
            <Landscape />
        </section>
    );
}

function TeamCard(props: { team: KissopenHomeData["team"] }) {
    const { team } = props;
    const colors = ["var(--home-accent)", "var(--home-green)", "var(--home-peach)"];
    const largest = Math.max(1, ...team.groups.map((group) => group.count));
    return (
        <section className="kissopen-home__card kissopen-home__team" aria-labelledby="home-team">
            <CardHeading id="home-team" title={team.title} subtitle={team.subtitle} />
            <div className="kissopen-home__avatars">
                {team.members.map((member, index) => (
                    <span
                        className="kissopen-home__avatar"
                        key={`${member.name}-${index}`}
                        title={`${member.name} · ${member.group}`}
                    >
                        <PersonAvatar seed={index} />
                    </span>
                ))}
            </div>
            <div className="kissopen-home__groups">
                {team.groups.map((group, index) => (
                    <div className="kissopen-home__group" key={group.name}>
                        <span className="kissopen-home__group-name">
                            {group.name}
                            <span className="kissopen-home__group-count">
                                {t("{count}人", { count: group.count })}
                            </span>
                        </span>
                        <span className="kissopen-home__bar">
                            <span
                                className="kissopen-home__bar-fill"
                                style={{
                                    width: `${Math.max(8, group.progress || Math.round((group.count / largest) * 100))}%`,
                                    background: colors[index % 3],
                                }}
                            />
                        </span>
                    </div>
                ))}
            </div>
            {team.support && (
                <div className="kissopen-home__support">
                    <PeopleIcon />
                    <span className="kissopen-home__support-text">{team.support}</span>
                    <ChevronIcon />
                </div>
            )}
        </section>
    );
}

function ForecastCard(props: { forecast: KissopenHomeData["forecast"] }) {
    const f = props.forecast;
    const width = 360;
    const height = 150;
    const left = 36;
    const bottom = 22;
    const points = f.labels.length;
    const values = [...f.actual, ...f.predicted];
    const ticks = niceTicks(Math.min(...values), Math.max(...values));
    const floor = ticks[0]!;
    const top = ticks.at(-1)!;
    const x = (index: number) => left + (index * (width - left - 8)) / Math.max(1, points - 1);
    const y = (value: number) => 8 + (1 - (value - floor) / (top - floor)) * (height - bottom - 8);
    const actual = f.actual.map((value, index) => [x(index), y(value)] as const);
    const start = f.actual.length - 1;
    const predicted = f.predicted.map((value, index) => [x(start + index), y(value)] as const);
    const band = [
        ...predicted.map(([px, py], index) => `${px},${py - 6 - index * 4}`),
        ...[...predicted]
            .reverse()
            .map(([px, py], index) => `${px},${py + 6 + (predicted.length - 1 - index) * 4}`),
    ].join(" ");
    return (
        <section className="kissopen-home__card" aria-labelledby="home-forecast">
            <CardHeading id="home-forecast" title={f.title} subtitle={f.subtitle} />
            <div className="kissopen-home__range">{f.range}</div>
            <svg
                className="kissopen-home__chart"
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label={t("{title}：{range}", { title: f.subtitle || f.title, range: f.range })}
            >
                {ticks.map((tick) => (
                    <g key={tick}>
                        <line
                            x1={left}
                            x2={width - 4}
                            y1={y(tick)}
                            y2={y(tick)}
                            className="kissopen-home__grid"
                        />
                        <text
                            x={left - 6}
                            y={y(tick) + 4}
                            textAnchor="end"
                            className="kissopen-home__axis"
                        >
                            {shortNumber(tick, f.unit)}
                        </text>
                    </g>
                ))}
                <polygon points={band} className="kissopen-home__band" />
                <polyline
                    points={actual.map(([px, py]) => `${px},${py}`).join(" ")}
                    className="kissopen-home__line"
                />
                <polyline
                    points={predicted.map(([px, py]) => `${px},${py}`).join(" ")}
                    className="kissopen-home__line kissopen-home__line--predicted"
                />
                {actual.map(([px, py], index) => (
                    <circle
                        key={`a${index}`}
                        cx={px}
                        cy={py}
                        r={3.5}
                        className="kissopen-home__dot"
                    />
                ))}
                {predicted.slice(1).map(([px, py], index) => (
                    <circle
                        key={`p${index}`}
                        cx={px}
                        cy={py}
                        r={3}
                        className="kissopen-home__dot kissopen-home__dot--predicted"
                    />
                ))}
                {f.labels.map((label, index) => (
                    <text
                        key={label + index}
                        x={x(index)}
                        y={height - 4}
                        textAnchor="middle"
                        className="kissopen-home__axis"
                    >
                        {label}
                    </text>
                ))}
            </svg>
            <div className="kissopen-home__legend">
                <span className="kissopen-home__legend-item">
                    <span className="kissopen-home__legend-solid" />
                    {t("实际")}
                </span>
                <span className="kissopen-home__legend-item">
                    <span className="kissopen-home__legend-dotted" />
                    {t("AI 预测")}
                </span>
                {f.note && <span className="kissopen-home__legend-note">{f.note}</span>}
            </div>
        </section>
    );
}

function WinsCard(props: { wins: KissopenHomeData["wins"] }) {
    const w = props.wins;
    const tallest = Math.max(1, ...w.bars);
    const up = !w.delta.trim().startsWith("-") && !w.delta.trim().startsWith("−");
    return (
        <section className="kissopen-home__card" aria-labelledby="home-wins">
            <CardHeading id="home-wins" title={w.title} />
            <div className="kissopen-home__wins-head">
                <span className="kissopen-home__wins-value">{w.value}</span>
                {w.delta && (
                    <span className="kissopen-home__delta" data-direction={up ? "up" : "down"}>
                        <ArrowUpIcon />
                        {w.delta}
                    </span>
                )}
            </div>
            <div className="kissopen-home__wins-label">{w.label}</div>
            {w.metrics.length > 0 && (
                <div className="kissopen-home__metrics">
                    {w.metrics.map((metric) => (
                        <div className="kissopen-home__metric" key={metric.label}>
                            <span className="kissopen-home__metric-label">{metric.label}</span>
                            <span className="kissopen-home__metric-value">{metric.value}</span>
                        </div>
                    ))}
                </div>
            )}
            <div className="kissopen-home__bars" aria-hidden="true">
                {w.bars.map((bar, index) => (
                    <div className="kissopen-home__bar-column" key={index}>
                        <span
                            className="kissopen-home__bar-block"
                            data-last={index === w.bars.length - 1 ? "" : undefined}
                            style={{ height: `${Math.max(8, (bar / tallest) * 100)}%` }}
                        />
                        <span className="kissopen-home__bar-label">{w.bar_labels[index]}</span>
                    </div>
                ))}
            </div>
            {w.note && (
                <div className="kissopen-home__note">
                    <SparkleIcon />
                    <span>{w.note}</span>
                </div>
            )}
        </section>
    );
}

function HomeSkeleton() {
    return (
        <div className="kissopen-home__skeleton" aria-busy="true" aria-label={t("正在准备首页")}>
            <div className="kissopen-home__row kissopen-home__row--top">
                <div className="kissopen-home__card kissopen-home__ghost kissopen-home__ghost--tall" />
                <div className="kissopen-home__card kissopen-home__ghost kissopen-home__ghost--tall" />
            </div>
            <div className="kissopen-home__row kissopen-home__row--three">
                <div className="kissopen-home__card kissopen-home__ghost" />
                <div className="kissopen-home__card kissopen-home__ghost" />
                <div className="kissopen-home__card kissopen-home__ghost" />
            </div>
        </div>
    );
}

/*
Three or four round values spanning the data with a little room: the axis
starts near the lowest point rather than at zero, so a trend reads as a slope.
*/
function niceTicks(low: number, high: number): number[] {
    const spread = Math.max(high - low, Math.abs(high) * 0.1, 1);
    const rough = (spread * 1.3) / 3;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const step = ([1, 2, 2.5, 5, 10].find((f) => f * magnitude >= rough) ?? 10) * magnitude;
    const first = Math.max(0, Math.floor((low - spread * 0.15) / step) * step);
    const ticks = [first];
    while (ticks.at(-1)! < high || ticks.length < 3)
        ticks.push(Math.round((ticks.at(-1)! + step) * 1000) / 1000);
    return ticks;
}

function shortNumber(value: number, unit: string): string {
    const text =
        value >= 1_000_000
            ? `${Math.round(value / 100_000) / 10}M`
            : value >= 1000
              ? `${Math.round(value / 100) / 10}K`
              : `${Math.round(value)}`;
    if (!unit) return text;
    return /^[$¥€£]$/.test(unit) ? `${unit}${text}` : text;
}

/* Pictures ---------------------------------------------------------------- */

/*
The home page's pictures are drawn, not photographed: a demonstration of
somebody's work must not show real people or real products, and a drawing
reads as "an example" in a way a stock photo does not.
*/

const SKIN = ["#F2C9A8", "#E8B48E", "#C98E66", "#F6D5BC", "#D9A27A"];
const HAIR = ["#2B2522", "#4A3326", "#1F1B24", "#6B4632", "#3A2A20"];
const SHIRT = ["#7C6BE0", "#5FB38A", "#F2A07B", "#6FA3D9", "#C58BD8", "#E5C36A"];
const BACKDROP = ["#EEEAFE", "#E6F4EC", "#FDEEE6", "#E8F0FA", "#F6ECFA", "#FBF4DF"];

export function PersonAvatar(props: { seed: number }) {
    const seed = props.seed;
    const skin = SKIN[seed % SKIN.length]!;
    const hair = HAIR[(seed * 3) % HAIR.length]!;
    const shirt = SHIRT[(seed * 5) % SHIRT.length]!;
    const back = BACKDROP[seed % BACKDROP.length]!;
    const style = seed % 4;
    return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="32" fill={back} />
            {style === 1 && <path d="M14 34c0-14 8-22 18-22s18 8 18 22v14H14z" fill={hair} />}
            <path d="M12 64c1-12 9-19 20-19s19 7 20 19z" fill={shirt} />
            <rect x="27" y="36" width="10" height="10" rx="4" fill={skin} />
            <ellipse cx="32" cy="29" rx="11" ry="12.5" fill={skin} />
            {style === 0 && (
                <path
                    d="M20.5 27c0-9 5-13.5 11.5-13.5S43.5 18 43.5 27c-3-5-7-6.5-11.5-6.5S23.5 22 20.5 27z"
                    fill={hair}
                />
            )}
            {style === 1 && (
                <path
                    d="M20.5 28c0-9 5-14.5 11.5-14.5S43.5 19 43.5 28c-2-6-6-8.5-11.5-8.5S22.5 22 20.5 28z"
                    fill={hair}
                />
            )}
            {style === 2 && (
                <>
                    <circle cx="32" cy="12.5" r="5.5" fill={hair} />
                    <path
                        d="M20.5 27c0-9 5-13.5 11.5-13.5S43.5 18 43.5 27c-4-4-7-5.5-11.5-5.5S24.5 23 20.5 27z"
                        fill={hair}
                    />
                </>
            )}
            {style === 3 && (
                <path
                    d="M19 29c-1-11 5-17 13-17s14 6 13 17c-2-2-2-6-5-7-2 3-6 3-9 2-3 2-6 2-9 1-1 1-2 3-3 4z"
                    fill={hair}
                />
            )}
            <circle cx="27.5" cy="30" r="1.3" fill="#2B2522" />
            <circle cx="36.5" cy="30" r="1.3" fill="#2B2522" />
            <path
                d="M29 35.5c1.8 1.4 4.2 1.4 6 0"
                stroke="#A8664A"
                strokeWidth="1.4"
                fill="none"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function ProjectPicture(props: { kind: string }) {
    return (
        <span className="kissopen-home__picture" data-kind={props.kind} aria-hidden="true">
            <svg viewBox="0 0 96 72">{PICTURES[props.kind] ?? PICTURES["document"]}</svg>
        </span>
    );
}

const PICTURES: Record<string, ReactNode> = {
    sneakers: (
        <>
            <rect width="96" height="72" fill="#EFEDF3" />
            <ellipse cx="48" cy="56" rx="34" ry="4" fill="#DAD6E1" />
            <path
                d="M16 50c0-8 6-14 14-15l10-9c3-3 8-3 11 0l6 6c6 5 14 8 22 10 4 1 6 4 6 8H16z"
                fill="#FFFFFF"
                stroke="#CFCAD8"
            />
            <path d="M16 50h69v5H18c-1 0-2-1-2-2z" fill="#E3DFEA" />
            <path
                d="M38 30l6 6M42 27l6 6M46 25l5 5"
                stroke="#B9B2C6"
                strokeWidth="1.6"
                strokeLinecap="round"
            />
        </>
    ),
    cup: (
        <>
            <rect width="96" height="72" fill="#F4EEE7" />
            <ellipse cx="48" cy="56" rx="26" ry="5" fill="#E6DCCF" />
            <path
                d="M30 30h32v14c0 7-6 12-13 12h-6c-7 0-13-5-13-12z"
                fill="#FFFFFF"
                stroke="#DDD2C4"
            />
            <path
                d="M62 34h4c4 0 6 3 6 6s-2 6-6 6h-5"
                fill="none"
                stroke="#DDD2C4"
                strokeWidth="3"
            />
            <ellipse cx="46" cy="30" rx="16" ry="3.5" fill="#B98C63" />
            <path
                d="M42 14c-2 3 2 5 0 8M50 12c-2 3 2 5 0 8"
                stroke="#D7C6B3"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
            />
        </>
    ),
    boxes: (
        <>
            <rect width="96" height="72" fill="#EFE7DC" />
            <rect x="14" y="34" width="30" height="24" fill="#C8A175" />
            <rect x="46" y="34" width="30" height="24" fill="#BD9467" />
            <rect x="30" y="12" width="30" height="22" fill="#D2AE82" />
            <path d="M14 40h30M46 40h30M30 18h30" stroke="#A97F55" strokeWidth="1.4" />
            <rect x="26" y="34" width="6" height="6" fill="#E8D6BD" />
            <rect x="58" y="34" width="6" height="6" fill="#E8D6BD" />
        </>
    ),
    laptop: (
        <>
            <rect width="96" height="72" fill="#E9EDF6" />
            <rect x="22" y="16" width="52" height="32" rx="3" fill="#2F3447" />
            <rect x="26" y="20" width="44" height="24" rx="1.5" fill="#8FA7E8" />
            <path
                d="M30 38l8-7 6 5 8-9 10 11"
                stroke="#FFFFFF"
                strokeWidth="2"
                fill="none"
                strokeLinejoin="round"
            />
            <path d="M16 50h64l-4 6H20z" fill="#C7CDDC" />
        </>
    ),
    document: (
        <>
            <rect width="96" height="72" fill="#EEEAFB" />
            <rect x="30" y="10" width="36" height="48" rx="3" fill="#FFFFFF" stroke="#D5CEF2" />
            <rect x="36" y="18" width="18" height="3" rx="1.5" fill="#8C7BE0" />
            <rect x="36" y="26" width="24" height="2.5" rx="1.25" fill="#D9D3F3" />
            <rect x="36" y="32" width="24" height="2.5" rx="1.25" fill="#D9D3F3" />
            <rect x="36" y="38" width="16" height="2.5" rx="1.25" fill="#D9D3F3" />
            <circle cx="62" cy="54" r="8" fill="#8C7BE0" />
            <path
                d="M58.5 54l2.5 2.5 4.5-5"
                stroke="#FFFFFF"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
            />
        </>
    ),
    chart: (
        <>
            <rect width="96" height="72" fill="#E7F3EC" />
            <rect x="20" y="40" width="10" height="16" rx="2" fill="#9AD0B0" />
            <rect x="36" y="30" width="10" height="26" rx="2" fill="#6FBF92" />
            <rect x="52" y="22" width="10" height="34" rx="2" fill="#4BA876" />
            <rect x="68" y="14" width="10" height="42" rx="2" fill="#2F8F5E" />
            <path
                d="M18 34l16-10 16 4 22-14"
                stroke="#F2A07B"
                strokeWidth="2.2"
                fill="none"
                strokeLinecap="round"
            />
        </>
    ),
    megaphone: (
        <>
            <rect width="96" height="72" fill="#FDEEE6" />
            <path d="M28 30l30-12v36L28 42z" fill="#F2A07B" />
            <rect x="20" y="29" width="10" height="14" rx="3" fill="#E48460" />
            <path d="M32 42l4 12h6l-3-11" fill="#E48460" />
            <path
                d="M64 28c4 2 4 14 0 16M70 24c7 4 7 20 0 24"
                stroke="#E9B39A"
                strokeWidth="2.2"
                fill="none"
                strokeLinecap="round"
            />
        </>
    ),
    calendar: (
        <>
            <rect width="96" height="72" fill="#EAF0FA" />
            <rect x="24" y="14" width="48" height="44" rx="5" fill="#FFFFFF" stroke="#CBD7EC" />
            <rect x="24" y="14" width="48" height="11" rx="5" fill="#6FA3D9" />
            <path d="M36 10v8M60 10v8" stroke="#46709E" strokeWidth="3" strokeLinecap="round" />
            {[0, 1, 2, 3].map((column) =>
                [0, 1, 2].map((row) => (
                    <rect
                        key={`${column}-${row}`}
                        x={30 + column * 10}
                        y={30 + row * 8}
                        width="6"
                        height="5"
                        rx="1"
                        fill={column === 2 && row === 1 ? "#F2A07B" : "#D9E3F3"}
                    />
                )),
            )}
        </>
    ),
    bag: (
        <>
            <rect width="96" height="72" fill="#F6ECFA" />
            <path d="M28 26h40l-4 32H32z" fill="#C58BD8" />
            <path
                d="M38 26c0-8 4-12 10-12s10 4 10 12"
                stroke="#9E62B4"
                strokeWidth="3"
                fill="none"
            />
            <rect x="40" y="36" width="16" height="3" rx="1.5" fill="#F3DDF8" />
        </>
    ),
    plant: (
        <>
            <rect width="96" height="72" fill="#EAF6EE" />
            <path d="M36 44h24l-3 14H39z" fill="#E3B48F" />
            <path d="M48 44V26" stroke="#3B8C5E" strokeWidth="2.4" />
            <path
                d="M48 32c-10-2-14-10-12-16 8 1 13 7 12 16zM48 30c8-4 14-2 16 3-6 5-12 3-16-3z"
                fill="#5FB38A"
            />
        </>
    ),
};

function Landscape() {
    return (
        <div className="kissopen-home__landscape" aria-hidden="true">
            <svg viewBox="0 0 420 260" preserveAspectRatio="xMidYMax slice">
                <defs>
                    <linearGradient id="home-sky" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="var(--home-sky-top)" />
                        <stop offset="0.7" stopColor="var(--home-sky-bottom)" />
                    </linearGradient>
                    <radialGradient id="home-sun" cx="0.5" cy="0.5" r="0.5">
                        <stop offset="0" stopColor="#FFD9A8" />
                        <stop offset="1" stopColor="#FFC58F" stopOpacity="0" />
                    </radialGradient>
                </defs>
                <rect width="420" height="260" fill="url(#home-sky)" />
                <circle cx="250" cy="150" r="70" fill="url(#home-sun)" />
                <circle cx="250" cy="150" r="34" fill="#FFD7A3" opacity="0.85" />
                <path
                    d="M0 170c50-22 90-30 140-18s80 4 120-10 100-10 160 12v106H0z"
                    fill="var(--home-hill-far)"
                />
                <path
                    d="M0 196c60-18 110-16 160-4s110 8 150-6 80-6 110 4v70H0z"
                    fill="var(--home-hill-mid)"
                />
                <path
                    d="M0 222c70-12 130-10 200 2s150 6 220-8v44H0z"
                    fill="var(--home-hill-near)"
                />
                <path
                    d="M300 212l6-18 6 18zM314 214l5-14 5 14zM286 216l4-12 4 12z"
                    fill="var(--home-trees)"
                />
            </svg>
            <span className="kissopen-home__motto">
                {t("更远的路，")}
                <br />
                {t("从今天出发。")}
            </span>
        </div>
    );
}

/* Icons ------------------------------------------------------------------- */

const ArrowIcon = () => <Ionicon name="arrow-forward" size={16} />;
const ArrowUpIcon = () => <Ionicon name="arrow-up" size={16} />;
const ChevronIcon = () => <Ionicon name="chevron-forward" size={16} />;
const LinkIcon = () => <Ionicon name="link" size={16} />;
const PeopleIcon = () => <Ionicon name="people-outline" size={18} />;
const SparkleIcon = () => <Ionicon name="sparkles-outline" size={18} />;
/* The sun by day and the moon by night, beside the date. */
function DayIcon(props: { now: number }) {
    const hour = new Date(props.now).getHours();
    return <Ionicon name={hour >= 6 && hour < 18 ? "sunny" : "moon"} size={18} />;
}

/* The icons a focus item may name; the server settles every other name to doc. */
const FOCUS_ICONS = {
    box: "cube-outline",
    image: "image-outline",
    chart: "bar-chart-outline",
    people: "people-outline",
    calendar: "calendar-outline",
    mail: "mail-outline",
    money: "cash-outline",
    doc: "document-text-outline",
} as const;

function FocusIcon(props: { kind: string }) {
    const name = FOCUS_ICONS[props.kind as keyof typeof FOCUS_ICONS] ?? FOCUS_ICONS.doc;
    return <Ionicon name={name} size={20} />;
}
