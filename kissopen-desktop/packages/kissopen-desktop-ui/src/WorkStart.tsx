import { t } from "kissopen-desktop-state";
import { useRef, useState, type FormEvent } from "react";
import { ProjectPicture } from "./KissopenHome";
import { ScrollArea } from "./Scrollbar";
import { Ionicon } from "./vectorIcons/VectorIcon";

/*
The 工作 page while no project is open: where a person who has never made a
project is told what one is and starts one from what they want to get done.

The goal is the only thing asked. Where it goes from there — choosing a folder
for the project's files, the AI taking the goal as its first message — belongs
to the caller, which is told the goal and nothing else. The examples are the
caller's too, so they can be written for the person's own work. Props only,
besides the goal being typed and which examples are showing.
*/

export type WorkStartExample = {
    readonly title: string;
    readonly detail: string;
    /** A picture name the home page's project pictures know, e.g. "boxes". */
    readonly picture: string;
};

/** A project the person already has, wherever it lives. */
export type WorkStartProject = {
    readonly id: string;
    readonly name: string;
    /** The cloud or the computer it is on, when that is not this one. */
    readonly place: string;
    /** The board's title or most important step; unused without a board. */
    readonly summary: string;
    readonly hasBoard: boolean;
    /** 0–100, when the board says. */
    readonly progress?: number;
};

export type WorkStartProps = {
    readonly examples: readonly WorkStartExample[];
    /**
     * The person's projects, newest first. The page lists them above the
     * start of a new one, so 工作 is where every project can be opened from.
     */
    readonly projects?: readonly WorkStartProject[];
    readonly onProjectOpen?: (id: string) => void;
    /** While the goal is being turned into a project; the button waits. */
    readonly busy?: boolean;
    readonly error?: string;
    /** The machine cannot take a project right now; nothing can be started. */
    readonly unavailable?: boolean;
    readonly onStart: (goal: string) => void;
    /** Adding an existing folder as it is, for someone who already has one. */
    readonly onFolderAdd?: () => void;
};

const SHOWN = 3;
/** Projects listed before the rest are asked for. */
const PROJECTS_SHOWN = 9;
const PROJECT_PICTURES = ["laptop", "document", "chart"];

export function WorkStart(props: WorkStartProps) {
    const [goal, setGoal] = useState("");
    const [page, setPage] = useState(0);
    const [allProjects, setAllProjects] = useState(false);
    const projects = props.projects ?? [];
    const projectsShown = allProjects ? projects : projects.slice(0, PROJECTS_SHOWN);
    const input = useRef<HTMLInputElement>(null);
    const pages = Math.max(1, Math.ceil(props.examples.length / SHOWN));
    const shown = props.examples.slice((page % pages) * SHOWN, (page % pages) * SHOWN + SHOWN);
    const blocked = props.busy === true || props.unavailable === true;
    const submit = (event: FormEvent) => {
        event.preventDefault();
        const text = goal.trim();
        if (!text || blocked) return;
        props.onStart(text);
    };
    const pick = (example: WorkStartExample) => {
        setGoal(example.title);
        input.current?.focus();
    };
    return (
        <section className="kissopen-work-start" data-kissopen-desktop-ui="work-start">
            <ScrollArea
                className="kissopen-work-start__scroll"
                viewportClassName="kissopen-work-start__viewport"
            >
                <div className="kissopen-work-start__page">
                    <header className="kissopen-work-start__header">
                        <nav className="kissopen-work-start__crumbs" aria-label={t("位置")}>
                            <span>{t("工作")}</span>
                            <span aria-hidden="true">/</span>
                            <span className="kissopen-work-start__crumb-here">{t("项目")}</span>
                        </nav>
                        <h1 className="kissopen-work-start__title">{t("让一件事，持续向前")}</h1>
                        <p className="kissopen-work-start__lead">
                            {t(
                                "把目标、资料和对话放在一个地方。KissOpen会记住背景，帮你规划、执行和复盘。",
                            )}
                        </p>
                    </header>

                    {projects.length > 0 && (
                        <section
                            className="kissopen-work-start__projects"
                            aria-labelledby="work-start-projects"
                        >
                            <div className="kissopen-work-start__examples-head">
                                <h2
                                    className="kissopen-work-start__section-title"
                                    id="work-start-projects"
                                >
                                    {t("我的项目")}
                                    <span className="kissopen-work-start__count">
                                        {projects.length}
                                    </span>
                                </h2>
                                {projects.length > PROJECTS_SHOWN && (
                                    <button
                                        className="kissopen-work-start__more"
                                        onClick={() => setAllProjects(!allProjects)}
                                        type="button"
                                    >
                                        {allProjects
                                            ? t("收起")
                                            : t("显示全部 {count} 个", { count: projects.length })}
                                    </button>
                                )}
                            </div>
                            <div className="kissopen-work-start__project-grid">
                                {projectsShown.map((project, index) => (
                                    <button
                                        className="kissopen-work-start__example kissopen-work-start__project"
                                        key={project.id}
                                        onClick={() => props.onProjectOpen?.(project.id)}
                                        type="button"
                                    >
                                        <ProjectPicture
                                            kind={
                                                PROJECT_PICTURES[index % PROJECT_PICTURES.length]!
                                            }
                                        />
                                        <span className="kissopen-work-start__example-copy">
                                            <span className="kissopen-work-start__example-title">
                                                {project.name}
                                            </span>
                                            <span className="kissopen-work-start__example-detail">
                                                {[
                                                    project.place,
                                                    project.hasBoard
                                                        ? project.summary
                                                        : t("还没有看板"),
                                                ]
                                                    .filter(Boolean)
                                                    .join(" · ")}
                                            </span>
                                            {project.progress !== undefined && (
                                                <span className="kissopen-work-start__progress">
                                                    <span className="kissopen-work-start__progress-bar">
                                                        <span
                                                            className="kissopen-work-start__progress-fill"
                                                            style={{
                                                                width: `${Math.max(4, project.progress)}%`,
                                                            }}
                                                        />
                                                    </span>
                                                    {project.progress}%
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    <div className="kissopen-work-start__row">
                        <form className="kissopen-work-start__hero" onSubmit={submit}>
                            <Journey />
                            <div className="kissopen-work-start__hero-copy">
                                <h2 className="kissopen-work-start__question">
                                    {t("你现在最想推进什么？")}
                                </h2>
                                <div className="kissopen-work-start__ask">
                                    <input
                                        aria-label={t("想推进的事")}
                                        className="kissopen-work-start__input"
                                        disabled={props.unavailable}
                                        maxLength={200}
                                        onChange={(event) => setGoal(event.target.value)}
                                        placeholder={t("例如：在 10 月前完成欧洲站新品上线")}
                                        ref={input}
                                        value={goal}
                                    />
                                    <button
                                        className="kissopen-work-start__start"
                                        disabled={blocked || goal.trim() === ""}
                                        type="submit"
                                    >
                                        {props.busy ? t("正在创建…") : t("开始创建")}
                                        <Ionicon name="arrow-forward" size={16} />
                                    </button>
                                </div>
                                <p className="kissopen-work-start__hint">
                                    {t(
                                        "先说目标即可，细节可以和 AI 一起补充。下一步选一个放资料的文件夹。",
                                    )}
                                </p>
                                {props.error && (
                                    <p className="kissopen-work-start__error" role="alert">
                                        {props.error}
                                    </p>
                                )}
                                {props.onFolderAdd && (
                                    <button
                                        className="kissopen-work-start__folder"
                                        disabled={blocked}
                                        onClick={props.onFolderAdd}
                                        type="button"
                                    >
                                        {t("已经有资料文件夹？直接添加")}
                                    </button>
                                )}
                            </div>
                        </form>

                        <section
                            className="kissopen-work-start__after"
                            aria-labelledby="work-start-after"
                        >
                            <h2 className="kissopen-work-start__after-title" id="work-start-after">
                                {t("创建后，你可以…")}
                            </h2>
                            <ul className="kissopen-work-start__benefits">
                                <Benefit
                                    icon="folder-outline"
                                    title={t("集中资料与对话")}
                                    detail={t("文档、链接、灵感都在一个项目里")}
                                />
                                <Benefit
                                    icon="sparkles-outline"
                                    title={t("让 AI 持续跟进")}
                                    detail={t("基于项目背景，帮你规划、执行和提醒")}
                                />
                                <Benefit
                                    icon="bar-chart-outline"
                                    title={t("随时查看进展")}
                                    detail={t("关键节点一目了然，快速掌握最新状态")}
                                />
                            </ul>
                            <Hills />
                        </section>
                    </div>

                    {shown.length > 0 && (
                        <section
                            className="kissopen-work-start__examples"
                            aria-labelledby="work-start-examples"
                        >
                            <div className="kissopen-work-start__examples-head">
                                <div>
                                    <h2
                                        className="kissopen-work-start__section-title"
                                        id="work-start-examples"
                                    >
                                        {t("从一件具体的事开始")}
                                    </h2>
                                    <p className="kissopen-work-start__section-lead">
                                        {t("项目最好有明确结果；日常随手一问，直接去聊天。")}
                                    </p>
                                </div>
                                {pages > 1 && (
                                    <button
                                        className="kissopen-work-start__more"
                                        onClick={() => setPage(page + 1)}
                                        type="button"
                                    >
                                        {t("换一批示例")}
                                        <Ionicon name="arrow-forward" size={16} />
                                    </button>
                                )}
                            </div>
                            <div className="kissopen-work-start__example-row">
                                {shown.map((example) => (
                                    <button
                                        className="kissopen-work-start__example"
                                        disabled={props.unavailable}
                                        key={example.title}
                                        onClick={() => pick(example)}
                                        type="button"
                                    >
                                        <ProjectPicture kind={example.picture} />
                                        <span className="kissopen-work-start__example-copy">
                                            <span className="kissopen-work-start__example-title">
                                                {example.title}
                                            </span>
                                            <span className="kissopen-work-start__example-detail">
                                                {example.detail}
                                            </span>
                                        </span>
                                        <span className="kissopen-work-start__example-go">
                                            <Ionicon name="arrow-forward" size={16} />
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    <section
                        className="kissopen-work-start__formula"
                        aria-label={t("怎样算一个好项目")}
                    >
                        <span className="kissopen-work-start__formula-idea">
                            <Ionicon name="bulb-outline" size={24} />
                        </span>
                        <span className="kissopen-work-start__formula-text">
                            {t("一个好项目 = 想达成的结果 + 大致时间 + 相关资料")}
                        </span>
                        <span className="kissopen-work-start__formula-parts">
                            <FormulaPart
                                icon="locate-outline"
                                tone="green"
                                title={t("结果")}
                                detail={t("例如：提升 30% 销量")}
                            />
                            <span className="kissopen-work-start__formula-plus" aria-hidden="true">
                                +
                            </span>
                            <FormulaPart
                                icon="calendar-outline"
                                tone="violet"
                                title={t("时间")}
                                detail={t("例如：本季度内")}
                            />
                            <span className="kissopen-work-start__formula-plus" aria-hidden="true">
                                +
                            </span>
                            <FormulaPart
                                icon="document-text-outline"
                                tone="violet"
                                title={t("资料")}
                                detail={t("例如：市场报告、竞品链接")}
                            />
                        </span>
                    </section>
                    <p className="kissopen-work-start__footnote">
                        {t("之后也可以随时修改项目名称和范围。")}
                    </p>
                </div>
            </ScrollArea>
        </section>
    );
}

function Benefit(props: {
    icon: "folder-outline" | "sparkles-outline" | "bar-chart-outline";
    title: string;
    detail: string;
}) {
    return (
        <li className="kissopen-work-start__benefit">
            <span className="kissopen-work-start__benefit-icon">
                <Ionicon name={props.icon} size={22} />
            </span>
            <span className="kissopen-work-start__benefit-copy">
                <span className="kissopen-work-start__benefit-title">{props.title}</span>
                <span className="kissopen-work-start__benefit-detail">{props.detail}</span>
            </span>
        </li>
    );
}

function FormulaPart(props: {
    icon: "locate-outline" | "calendar-outline" | "document-text-outline";
    tone: "green" | "violet";
    title: string;
    detail: string;
}) {
    return (
        <span className="kissopen-work-start__part">
            <span className="kissopen-work-start__part-icon" data-tone={props.tone}>
                <Ionicon name={props.icon} size={20} />
            </span>
            <span className="kissopen-work-start__part-copy">
                <span className="kissopen-work-start__part-title">{props.title}</span>
                <span className="kissopen-work-start__part-detail">{props.detail}</span>
            </span>
        </span>
    );
}

/* The hero's picture: a road over the hills through three stops. */
function Journey() {
    return (
        <div className="kissopen-work-start__journey" aria-hidden="true">
            <svg viewBox="0 0 520 300" preserveAspectRatio="xMaxYMax slice">
                <defs>
                    <linearGradient id="work-start-sky" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="var(--home-sky-top)" stopOpacity="0" />
                        <stop offset="0.75" stopColor="var(--home-sky-bottom)" />
                    </linearGradient>
                </defs>
                <rect width="520" height="300" fill="url(#work-start-sky)" />
                <circle cx="390" cy="150" r="34" fill="#FFD7A3" opacity="0.8" />
                <path
                    d="M120 230c60-40 120-60 190-56s120-30 210-60v186H120z"
                    fill="var(--home-hill-far)"
                />
                <path
                    d="M60 262c80-24 150-30 230-20s140-6 230-30v88H60z"
                    fill="var(--home-hill-mid)"
                />
                <path
                    d="M250 300c20-30 60-50 110-58s80-24 100-40c-24 26-54 36-94 48s-70 24-86 50z"
                    fill="var(--home-card)"
                    opacity="0.75"
                />
                <path
                    d="M40 300c90-18 170-18 250-8s150 0 230-14v22H40z"
                    fill="var(--home-hill-near)"
                />
                <path d="M470 176l7-22 7 22zM486 178l6-17 6 17z" fill="var(--home-trees)" />
            </svg>
            <svg
                className="kissopen-work-start__road"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
            >
                <path d="M27 27C36 20 44 22 53 17S70 10 79 9" />
            </svg>
            <span className="kissopen-work-start__stop" data-stop="1">
                <span className="kissopen-work-start__stop-icon">
                    <Ionicon name="document-text" size={18} />
                </span>
                {t("整理资料")}
            </span>
            <span className="kissopen-work-start__stop" data-stop="2">
                <span className="kissopen-work-start__stop-icon">
                    <Ionicon name="sparkles" size={18} />
                </span>
                {t("AI 执行")}
            </span>
            <span className="kissopen-work-start__stop" data-stop="3">
                <span className="kissopen-work-start__stop-icon" data-tone="peach">
                    <Ionicon name="bar-chart" size={18} />
                </span>
                {t("持续复盘")}
            </span>
            <span className="kissopen-work-start__motto">
                {t("把想做的事")}
                <br />
                {t("一步步变成成果。")}
            </span>
        </div>
    );
}

/* The low hills along the foot of the right-hand card, with the project's folder. */
function Hills() {
    return (
        <div className="kissopen-work-start__hills" aria-hidden="true">
            <svg viewBox="0 0 400 120" preserveAspectRatio="xMaxYMax slice">
                <path
                    d="M0 90c60-20 120-24 190-10s140 0 210-30v70H0z"
                    fill="var(--home-hill-far)"
                />
                <path
                    d="M0 108c80-14 160-14 240-4s110-4 160-14v24H0z"
                    fill="var(--home-hill-mid)"
                />
            </svg>
            <span className="kissopen-work-start__hills-folder">
                <Ionicon name="folder-open" size={44} />
            </span>
        </div>
    );
}
