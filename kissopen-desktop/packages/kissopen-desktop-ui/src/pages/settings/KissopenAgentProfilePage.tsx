import { t } from "kissopen-desktop-state";
import { useRef, useState, type CSSProperties } from "react";
import { Avatar } from "../../Avatar";
import { AvatarCropDialog } from "../../AvatarCropDialog";
import { Badge } from "../../Badge";
import { Button } from "../../Button";
import { Icon } from "../../Icon";
import { ModalOverlay } from "../../ModalOverlay";
import { ProfileEditDialog, type ProfileEditValues } from "../../ProfileEditDialog";
import { ProfilePasswordDialog, type ProfilePasswordValues } from "../../ProfilePasswordDialog";
import { Banner } from "../../Banner";
import { Tooltip } from "../../Tooltip";

export type ProfileStat = { label: string; value: string };
export type ProfileActivityDay = {
    /** Local calendar day, `YYYY-MM-DD`. */
    day: string;
    tokens: number;
};
export type ProfileInsight = { label: string; value: string };
export type KissopenAgentProfilePageProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    name: string;
    handle?: string;
    planName?: string;
    initials?: string;
    imageUrl?: string;
    /** The headline figures, read left to right. */
    stats: readonly ProfileStat[];
    /** One entry per day that had activity; gaps are days with none. */
    activity: readonly ProfileActivityDay[];
    /** Reference day the calendar ends on, so fixtures photograph identically. */
    today: string;
    insights: readonly ProfileInsight[];
    /** What the edit dialog starts from. */
    displayName?: string;
    username?: string;
    usernameEditable?: boolean;
    /** Saving the name and username; rejects with a message the dialog shows. */
    onProfileSave?: (values: ProfileEditValues) => Promise<void>;
    /** Saving a framed avatar (base64 JPEG); rejects with a message to show. */
    onAvatarSave?: (data: string, mime: "image/jpeg") => Promise<void>;
    /** Opens the invitation page. Omitted, the button is not offered. */
    onInvite?: () => void;
    password?: {
        readonly enabled: boolean | null;
        readonly factorRequired: boolean;
        readonly usernameReady: boolean;
        readonly busy: boolean;
        readonly error?: string;
        onSave(values: ProfilePasswordValues): Promise<void>;
        onCancel(): void;
    };
};

const WEEKS = 53;
const MONTH_NAMES = [
    t("1月"),
    t("2月"),
    t("3月"),
    t("4月"),
    t("5月"),
    t("6月"),
    t("7月"),
    t("8月"),
    t("9月"),
    t("10月"),
    t("11月"),
    t("12月"),
];

/** The calendar grid, as 53 weeks of 7 days ending on `today`. */
function calendar(today: string, byDay: ReadonlyMap<string, number>) {
    const end = new Date(`${today}T00:00:00`);
    // Fill to the end of the week so the last column is a whole one.
    end.setDate(end.getDate() + (6 - end.getDay()));
    const weeks: { day: string; tokens: number; month: number }[][] = [];
    for (let week = WEEKS - 1; week >= 0; week -= 1) {
        const column: { day: string; tokens: number; month: number }[] = [];
        for (let weekday = 0; weekday < 7; weekday += 1) {
            const date = new Date(end);
            date.setDate(end.getDate() - (week * 7 + (6 - weekday)));
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            column.push({ day: key, month: date.getMonth(), tokens: byDay.get(key) ?? 0 });
        }
        weeks.push(column);
    }
    return weeks;
}

/**
 * C-286 KissopenAgentProfilePage — who this account is and what it has done.
 *
 * Every figure here is read from work that actually happened; a quiet account
 * shows small numbers rather than a page that looks broken. The calendar is
 * the year in one glance: its levels are relative to this account's own busiest
 * day, because a comparison against someone else's is not one worth drawing.
 */
export function KissopenAgentProfilePage(props: KissopenAgentProfilePageProps) {
    const [editing, setEditing] = useState(false);
    const [passwordEditing, setPasswordEditing] = useState(false);
    const passwordClose = () => {
        props.password?.onCancel();
        setPasswordEditing(false);
    };
    const [cropUrl, setCropUrl] = useState<string>();
    const picker = useRef<HTMLInputElement | null>(null);
    const initials = props.initials ?? props.name.slice(0, 2).toLocaleUpperCase();
    const pick = () => picker.current?.click();
    const cropClose = () => {
        if (cropUrl) URL.revokeObjectURL(cropUrl);
        setCropUrl(undefined);
    };
    const byDay = new Map(props.activity.map((entry) => [entry.day, entry.tokens]));
    const peak = props.activity.reduce((most, entry) => Math.max(most, entry.tokens), 0);
    const weeks = calendar(props.today, byDay);
    const level = (tokens: number): number => {
        if (tokens <= 0 || peak <= 0) return 0;
        return Math.min(4, Math.max(1, Math.ceil((tokens / peak) * 4)));
    };
    // Computed rather than accumulated while rendering: a label that depends on
    // the column before it is a fold over the columns, not a mutable counter.
    const monthLabels = weeks.map((column, index) => {
        const month = column[0]?.month ?? 0;
        const previous = index === 0 ? -1 : (weeks[index - 1]?.[0]?.month ?? -1);
        return month === previous ? "" : (MONTH_NAMES[month] ?? "");
    });
    return (
        <section
            className={["kissopen-profile", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="profile-page"
            data-testid={props["data-testid"]}
            style={props.style}
        >
            <div className="kissopen-profile__actions">
                {props.password ? (
                    <Button
                        icon="lock"
                        size="small"
                        variant="ghost"
                        disabled={props.password.enabled === null || props.password.busy}
                        onClick={() => setPasswordEditing(true)}
                    >
                        {props.password.enabled === null
                            ? t("Loading password settings…")
                            : props.password.enabled
                              ? t("Change password")
                              : t("Set password")}
                    </Button>
                ) : null}
                {props.onInvite && (
                    <Button icon="send" onClick={props.onInvite} size="small" variant="ghost">
                        {t("邀请好友")}
                    </Button>
                )}
                <Tooltip label={t("你的资料只有你自己可见")}>
                    <span className="kissopen-profile__private">
                        <Icon name="lock" size={14} />
                        {t("私密")}
                    </span>
                </Tooltip>
                {props.onProfileSave && (
                    <Button
                        icon="edit"
                        onClick={() => setEditing(true)}
                        size="small"
                        variant="ghost"
                    >
                        {t("编辑")}
                    </Button>
                )}
            </div>
            {props.password?.error && !passwordEditing ? (
                <Banner tone="warning">{t(props.password.error)}</Banner>
            ) : null}
            <header className="kissopen-profile__identity">
                {props.onAvatarSave ? (
                    <button
                        aria-label={t("更换头像")}
                        className="kissopen-profile-avatar"
                        onClick={pick}
                        type="button"
                    >
                        <Avatar
                            {...(props.imageUrl ? { imageUrl: props.imageUrl } : {})}
                            initials={initials}
                            size="lg"
                            tone="ocean"
                        />
                        <span className="kissopen-profile-avatar__pencil" aria-hidden="true">
                            <Icon name="edit" size={16} />
                        </span>
                    </button>
                ) : (
                    <Avatar
                        {...(props.imageUrl ? { imageUrl: props.imageUrl } : {})}
                        initials={initials}
                        size="lg"
                        tone="ocean"
                    />
                )}
                <input
                    accept="image/png,image/jpeg,image/webp"
                    className="kissopen-profile__picker"
                    onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = "";
                        if (file) setCropUrl(URL.createObjectURL(file));
                    }}
                    ref={picker}
                    tabIndex={-1}
                    type="file"
                />
                <h1 className="kissopen-profile__name">{props.name}</h1>
                <p className="kissopen-profile__handle">
                    {props.handle && <span>{props.handle}</span>}
                    {props.planName && <Badge label={props.planName} variant="neutral" />}
                </p>
            </header>

            <div className="kissopen-profile__stats">
                {props.stats.map((stat) => (
                    <div className="kissopen-profile__stat" key={stat.label}>
                        <span className="kissopen-profile__stat-value">{stat.value}</span>
                        <span className="kissopen-profile__stat-label">{stat.label}</span>
                    </div>
                ))}
            </div>

            <section className="kissopen-profile__activity">
                <h2 className="kissopen-profile__heading">{t("Token 活动")}</h2>
                <div
                    className="kissopen-profile__calendar"
                    role="img"
                    aria-label={t("过去一年的用量日历")}
                >
                    {weeks.map((column) => (
                        <div className="kissopen-profile__week" key={column[0]?.day ?? ""}>
                            {column.map((cell) => (
                                <span
                                    className="kissopen-profile__day"
                                    data-level={level(cell.tokens)}
                                    key={cell.day}
                                    title={t("{day} · {tokens} tokens", {
                                        day: cell.day,
                                        tokens: cell.tokens.toLocaleString(),
                                    })}
                                />
                            ))}
                        </div>
                    ))}
                </div>
                <div className="kissopen-profile__months">
                    {weeks.map((column, index) => (
                        <span className="kissopen-profile__month" key={column[0]?.day ?? ""}>
                            {monthLabels[index]}
                        </span>
                    ))}
                </div>
            </section>

            <section className="kissopen-profile__activity">
                <h2 className="kissopen-profile__heading">{t("活动概览")}</h2>
                {props.insights.map((insight) => (
                    <div className="kissopen-profile__row" key={insight.label}>
                        <span>{insight.label}</span>
                        <span className="kissopen-profile__row-value">{insight.value}</span>
                    </div>
                ))}
            </section>
            {passwordEditing && props.password && props.password.enabled !== null ? (
                <ModalOverlay onDismiss={passwordClose}>
                    <ProfilePasswordDialog
                        hasPassword={props.password.enabled}
                        factorRequired={props.password.factorRequired}
                        usernameReady={props.password.usernameReady}
                        onCancel={passwordClose}
                        onSave={async (values) => {
                            await props.password?.onSave(values);
                            setPasswordEditing(false);
                        }}
                    />
                </ModalOverlay>
            ) : null}
            {editing && props.onProfileSave && (
                <ModalOverlay>
                    <ProfileEditDialog
                        displayName={props.displayName ?? ""}
                        {...(props.imageUrl ? { imageUrl: props.imageUrl } : {})}
                        initials={initials}
                        onAvatarChange={pick}
                        onCancel={() => setEditing(false)}
                        onSave={async (values) => {
                            await props.onProfileSave?.(values);
                            setEditing(false);
                        }}
                        username={props.username ?? ""}
                        usernameEditable={props.usernameEditable}
                    />
                </ModalOverlay>
            )}
            {cropUrl && props.onAvatarSave && (
                <ModalOverlay>
                    <AvatarCropDialog
                        imageUrl={cropUrl}
                        onCancel={cropClose}
                        onSave={async (data, mime) => {
                            await props.onAvatarSave?.(data, mime);
                            cropClose();
                        }}
                    />
                </ModalOverlay>
            )}
        </section>
    );
}
