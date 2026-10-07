import { t } from "kissopen-desktop-state";
import { useState } from "react";
import { PersonAvatar } from "./KissopenHome";
import { ScrollArea } from "./Scrollbar";

/*
The three questions asked once, right after signing in: what the person's work
is, whether they lead people, and what they want help with. Each answer changes
something they will see — the home page is written from it, and the assistant
reads it — so nothing is asked that changes nothing. Every question can be left,
and the whole thing can be skipped; the answers can be changed later.
*/

export type PersonaSetupAnswer = {
    industry: string;
    occupation: string;
    role: "" | "individual" | "manager" | "owner" | "student";
    team_size: number;
    goals: string[];
    skipped: boolean;
};

export type PersonaSetupProps = {
    busy?: boolean;
    error?: string;
    onSubmit: (answer: PersonaSetupAnswer) => void;
};

const INDUSTRIES = [
    "海外电商",
    "国内电商",
    "外贸",
    "制造业",
    "教育",
    "金融",
    "互联网",
    "医疗健康",
    "餐饮零售",
    "专业服务",
];
const OCCUPATIONS = [
    "运营",
    "市场营销",
    "销售",
    "客服",
    "财务",
    "人事",
    "行政文员",
    "产品设计",
    "采购供应链",
    "老师",
    "程序员",
];
const ROLES: readonly { value: PersonaSetupAnswer["role"]; title: string; detail: string }[] = [
    { value: "individual", title: "我自己完成工作", detail: "主要是个人的事情" },
    { value: "manager", title: "我带一个团队", detail: "要看进度、分配任务" },
    { value: "owner", title: "我是老板或创业者", detail: "关心整体业务和数字" },
    { value: "student", title: "我是学生", detail: "学习、作业和研究" },
];
const TEAM_SIZES: readonly { label: string; value: number }[] = [
    { label: "2–5 人", value: 5 },
    { label: "6–10 人", value: 10 },
    { label: "11–30 人", value: 30 },
    { label: "30 人以上", value: 50 },
];
const GOALS = [
    "写文档和报告",
    "整理表格数据",
    "做 PPT",
    "回复邮件消息",
    "读长文件并总结",
    "分析业务数据",
    "翻译",
    "提醒和定时做事",
    "查资料",
    "做图片",
];

export function PersonaSetup(props: PersonaSetupProps) {
    const [step, setStep] = useState(0);
    const [industry, setIndustry] = useState("");
    const [occupation, setOccupation] = useState("");
    const [role, setRole] = useState<PersonaSetupAnswer["role"]>("");
    const [teamSize, setTeamSize] = useState(0);
    const [goals, setGoals] = useState<string[]>([]);
    const leads = role === "manager" || role === "owner";
    const submit = (skipped: boolean) =>
        props.onSubmit({
            industry,
            occupation,
            role,
            team_size: leads ? teamSize : 0,
            goals,
            skipped,
        });
    const toggleGoal = (goal: string) =>
        setGoals((current) =>
            current.includes(goal)
                ? current.filter((entry) => entry !== goal)
                : current.length >= 3
                  ? current
                  : [...current, goal],
        );
    const steps = [t("你的工作"), t("你的身份"), t("想让 AI 帮你")];

    return (
        <section className="kissopen-persona" data-kissopen-desktop-ui="persona-setup">
            {/* The title bar is hidden in the desktop window; this lane drags it. */}
            <div className="kissopen-persona__drag" aria-hidden="true" />
            <ScrollArea
                className="kissopen-persona__scroll"
                viewportClassName="kissopen-persona__viewport"
            >
                <div className="kissopen-persona__center">
                    <div className="kissopen-persona__panel">
                        <div className="kissopen-persona__top">
                            <ol className="kissopen-persona__steps" aria-label={t("进度")}>
                                {steps.map((label, index) => (
                                    <li
                                        aria-current={index === step ? "step" : undefined}
                                        className="kissopen-persona__step"
                                        data-done={index < step ? "" : undefined}
                                        key={label}
                                    >
                                        <span className="kissopen-persona__step-dot">
                                            {index + 1}
                                        </span>
                                        {label}
                                    </li>
                                ))}
                            </ol>
                            <button
                                className="kissopen-persona__skip"
                                disabled={props.busy}
                                onClick={() => submit(true)}
                                type="button"
                            >
                                {t("跳过")}
                            </button>
                        </div>

                        {step === 0 && (
                            <div className="kissopen-persona__body">
                                <h1 className="kissopen-persona__title">
                                    {t("先认识一下，你做什么工作？")}
                                </h1>
                                <p className="kissopen-persona__lead">
                                    {t("KissOpen会按你的工作准备首页，助手也会按你的习惯说话。")}
                                </p>
                                <ChoiceGroup
                                    label={t("行业")}
                                    options={INDUSTRIES}
                                    value={industry}
                                    onChange={setIndustry}
                                />
                                <ChoiceGroup
                                    label={t("职业")}
                                    options={OCCUPATIONS}
                                    value={occupation}
                                    onChange={setOccupation}
                                />
                            </div>
                        )}

                        {step === 1 && (
                            <div className="kissopen-persona__body">
                                <h1 className="kissopen-persona__title">
                                    {t("你在工作里是什么角色？")}
                                </h1>
                                <p className="kissopen-persona__lead">
                                    {t("带团队的话，首页会多一块团队的进度。")}
                                </p>
                                <div
                                    className="kissopen-persona__roles"
                                    role="radiogroup"
                                    aria-label={t("身份")}
                                >
                                    {ROLES.map((option, index) => (
                                        <button
                                            aria-checked={role === option.value}
                                            className="kissopen-persona__role"
                                            key={option.value}
                                            onClick={() => {
                                                setRole(option.value);
                                                if (
                                                    (option.value === "manager" ||
                                                        option.value === "owner") &&
                                                    !teamSize
                                                )
                                                    setTeamSize(10);
                                            }}
                                            role="radio"
                                            type="button"
                                        >
                                            <span className="kissopen-persona__role-art">
                                                <PersonAvatar seed={index * 2 + 1} />
                                            </span>
                                            <span className="kissopen-persona__role-title">
                                                {t(option.title)}
                                            </span>
                                            <span className="kissopen-persona__role-detail">
                                                {t(option.detail)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                {leads && (
                                    <div className="kissopen-persona__group">
                                        <span className="kissopen-persona__group-label">
                                            {t("团队有多少人？")}
                                        </span>
                                        <div
                                            className="kissopen-persona__chips"
                                            role="radiogroup"
                                            aria-label={t("团队人数")}
                                        >
                                            {TEAM_SIZES.map((size) => (
                                                <button
                                                    aria-checked={teamSize === size.value}
                                                    className="kissopen-persona__chip"
                                                    key={size.value}
                                                    onClick={() => setTeamSize(size.value)}
                                                    role="radio"
                                                    type="button"
                                                >
                                                    {t(size.label)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 2 && (
                            <div className="kissopen-persona__body">
                                <h1 className="kissopen-persona__title">
                                    {t("最想让 AI 帮你做什么？")}
                                </h1>
                                <p className="kissopen-persona__lead">
                                    {t("最多选 3 项，首页会先推荐这些。")}
                                </p>
                                <div className="kissopen-persona__chips kissopen-persona__chips--wide">
                                    {GOALS.map((goal) => (
                                        <button
                                            aria-pressed={goals.includes(goal)}
                                            className="kissopen-persona__chip"
                                            disabled={!goals.includes(goal) && goals.length >= 3}
                                            key={goal}
                                            onClick={() => toggleGoal(goal)}
                                            type="button"
                                        >
                                            {t(goal)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {props.error && (
                            <p className="kissopen-persona__error" role="alert">
                                {props.error}
                            </p>
                        )}

                        <div className="kissopen-persona__actions">
                            {step > 0 ? (
                                <button
                                    className="kissopen-persona__back"
                                    onClick={() => setStep(step - 1)}
                                    type="button"
                                >
                                    {t("上一步")}
                                </button>
                            ) : (
                                <span />
                            )}
                            {step < 2 ? (
                                <button
                                    className="kissopen-persona__next"
                                    onClick={() => setStep(step + 1)}
                                    type="button"
                                >
                                    {t("下一步")}
                                </button>
                            ) : (
                                <button
                                    className="kissopen-persona__next"
                                    disabled={props.busy}
                                    onClick={() => submit(false)}
                                    type="button"
                                >
                                    {props.busy ? t("正在准备你的首页…") : t("完成，进入首页")}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </section>
    );
}

/*
One question's choices, plus a way to say it in the person's own words when
none of them fits. Choosing again clears it: every question may be left.
*/
function ChoiceGroup(props: {
    label: string;
    options: readonly string[];
    value: string;
    onChange: (value: string) => void;
}) {
    const custom = props.value !== "" && !props.options.includes(props.value);
    const [typing, setTyping] = useState(custom);
    return (
        <div className="kissopen-persona__group">
            <span className="kissopen-persona__group-label">{props.label}</span>
            <div className="kissopen-persona__chips" role="radiogroup" aria-label={props.label}>
                {props.options.map((option) => (
                    <button
                        aria-checked={props.value === option}
                        className="kissopen-persona__chip"
                        key={option}
                        onClick={() => {
                            setTyping(false);
                            props.onChange(props.value === option ? "" : option);
                        }}
                        role="radio"
                        type="button"
                    >
                        {t(option)}
                    </button>
                ))}
                <button
                    aria-checked={typing}
                    className="kissopen-persona__chip"
                    onClick={() => {
                        setTyping(true);
                        if (props.options.includes(props.value)) props.onChange("");
                    }}
                    role="radio"
                    type="button"
                >
                    {t("其他")}
                </button>
            </div>
            {typing && (
                <input
                    aria-label={t("用你自己的话说")}
                    autoFocus
                    className="kissopen-persona__input"
                    maxLength={30}
                    onChange={(event) => props.onChange(event.target.value)}
                    placeholder={t("用你自己的话说")}
                    value={custom ? props.value : ""}
                />
            )}
        </div>
    );
}
