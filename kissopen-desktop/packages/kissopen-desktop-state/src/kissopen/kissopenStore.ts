import { t } from "../i18n/locale.js";
import { billingHistoryStoreCreate } from "./billingHistoryStore.js";
import type { BillingHistory, Checkout, PlanChangeAction } from "./api.gen.js";
import type {
    AvatarUpload,
    Billing,
    Theme,
    ThemeDoc,
    ThemeGallery,
    ThemeGenerated,
    ThemeSelected,
    ThemesPage,
    ThemeWrite,
    CodeRequest,
    CodeSent,
    Config,
    FileItem,
    FileKind,
    DocumentUpload,
    FileUpload,
    HomeDemo,
    HomeDemoStatus,
    Schedule,
    ScheduleRunStarted,
    ScheduleRecurrence,
    ImageUpload,
    Persona,
    PersonaUpdate,
    Transcription,
    TranscriptionRequest,
    UploadedImage,
    LoginRequest,
    Model,
    Profile,
    ProfileUpdate,
    ProfileUser,
    SignupSource,
    User,
} from "./types";
import { isActive } from "./types";
import { readThemeImport } from "./themeImport";
/** Where a project is, for the schedule that builds its board. */
export type KissopenBoardPlace = {
    /** This computer, by the id the daemon and the relay know it under. */
    readonly machineId: string;
    /** The project's folder on it. */
    readonly projectPath: string;
    readonly projectName: string;
};

/** When a project's board is built on its own. */
export type KissopenBoardTiming = {
    readonly recurrence: Exclude<ScheduleRecurrence, "once">;
    /** Minutes past local midnight. */
    readonly atMinute: number;
    /** 0-6, Sunday first; weekly only. */
    readonly weekday: number;
};

/** Local submission feedback; accepted runs live in the server's schedule. */
export type KissopenBoardSubmission =
    | { readonly status: "submitting" }
    | { readonly status: "failed"; readonly error: string };
const BOARD_RUN_ACTIVE = new Set(["queued", "waiting_device", "accepted", "running", "needs_user"]);

/** The board schedule of one project, by `kissopenBoardKey`. */
export const kissopenBoardKey = (
    place: Pick<KissopenBoardPlace, "machineId" | "projectPath">,
): string => `machine:${place.machineId}|${place.projectPath.replace(/\/+$/u, "")}`;

/**
 * Whether new material in a project is read by the AI, and when the next
 * reading is due (0 when none is). Every project starts with it on.
 */
export type KissopenProjectAnalysis = {
    readonly enabled: boolean;
    readonly dueAt: number;
    /** Set when the day's analyses of the project have all been used. */
    readonly limited: boolean;
};

/** A project's analysis as the server says it. */
type ProjectAnalysisWire = { enabled: boolean; due_at?: number; limited?: boolean };

export type KissopenTab =
    | "home"
    | "workspace"
    | "chat"
    | "files"
    | "plugins"
    | "schedules"
    | "billing"
    | "invoices"
    | "themes"
    | "account";
export interface KissopenTransport {
    signedOut?(): Promise<void>;
    request(
        path: string,
        method?: "GET" | "POST",
        body?: Readonly<Record<string, unknown>>,
    ): Promise<{ status: number; text: string }>;
    openUrl(url: string): Promise<void>;
    downloadText(name: string, text: string): Promise<void>;
    /**
     * Where a person signing up here came from, said with the sign-in so a new
     * account keeps it: the web page knows the link it was opened by, the
     * desktop only that it is the desktop.
     */
    signupSource?(): SignupSource | undefined;
}

/** What became of one invite: see the server's invite.go for each state. */
/** A theme being made or changed, not yet saved. */
export type ThemeDraft = {
    /** Set while one of the account's own themes is being changed. */
    readonly id?: string;
    readonly name: string;
    readonly description: string;
    readonly source: string;
    readonly doc: ThemeDoc;
    /** Where it came from: a model, a pasted file, or one of the account's own. */
    readonly from: "ai" | "import" | "edit";
};

/** The theme to draw: one being looked at, else the account's own, else none. */
export function themeEffective(state: {
    readonly themePreview: ThemeDoc | null;
    readonly user: { readonly theme: Theme | null } | null;
}): ThemeDoc | null {
    return state.themePreview ?? state.user?.theme?.doc ?? null;
}

export type KissopenInviteStatus =
    | "bound"
    | "review"
    | "rewarded"
    | "capped"
    | "rejected"
    | "revoked";

/** The account's invite page, as GET /invite answers it. */
export type KissopenInvite = {
    readonly enabled: boolean;
    readonly code: string;
    readonly link: string;
    readonly inviter_points: number;
    readonly invitee_points: number;
    /** 0 means no limit. */
    readonly max_rewarded: number;
    readonly daily_max: number;
    readonly bind_days: number;
    readonly invited: number;
    readonly rewarded: number;
    readonly earned_points: number;
    /** -1 when there is no limit. */
    readonly remaining_points: number;
    readonly invitees: readonly {
        readonly name: string;
        readonly status: KissopenInviteStatus;
        readonly at: number;
    }[];
    /** Whether this account may still type someone's code. */
    readonly can_bind: boolean;
    readonly bound_code: string;
    readonly bind_before: number;
};
export interface KissopenSnapshot {
    readonly scheduleDraft: string | null;
    readonly scheduleFocus: string | null;
    readonly scheduleNavigation: number;
    readonly tab: KissopenTab;
    /**
     * The home page as it would look for this person's work, written from the
     * persona they gave. Null until the first one arrives.
     */
    readonly homeDemo: HomeDemo | null;
    /** When the account was last read; the home page greets and dates by it. */
    readonly refreshedAt: number;
    /** The schedules that build projects' boards, by `kissopenBoardKey`. */
    readonly boardSchedules: ReadonlyMap<string, Schedule>;
    readonly boardSubmissions: ReadonlyMap<string, KissopenBoardSubmission>;
    /** Whether the account's schedules have been read at least once. */
    readonly boardSchedulesLoaded: boolean;
    /** The last board schedule change or build that did not go through. */
    readonly boardScheduleError: string;
    /** Each project's analysis of new material, by `kissopenBoardKey`, once read. */
    readonly projectAnalyses: ReadonlyMap<string, KissopenProjectAnalysis>;
    /** Why the home page could not be prepared; empty when it could. */
    readonly homeError: string;
    readonly busy: boolean;
    readonly error: string;
    readonly notice: string;
    readonly workspaceStatus: string;
    readonly ready: boolean;
    readonly config: Config | null;
    readonly user: User | null;
    readonly files: readonly FileItem[];
    /** When `files` was last loaded; the library dates its groups from here. */
    readonly filesLoaded: number;
    readonly selectedFiles: readonly string[];
    /** The library's type filter; "all" shows every kind. */
    readonly libraryFilter: FileKind | "all";
    /** The library as a dated list or as tiles; remembered on this computer. */
    readonly libraryView: "list" | "grid";
    /** The sidebar's 分享赢好礼 card was closed on this computer; it stays closed. */
    readonly inviteCardDismissed: boolean;
    readonly librarySearch: string;
    /** Whether the usage surface is showing the plan catalogue instead. */
    readonly plansOpen: boolean;
    /**
     * A plan being bought, shown as a payment dialog over the plan page: the
     * method chosen, the order placed for it, and what to scan (or, failing
     * that, the page to open). Null when nothing is being bought.
     */
    readonly checkout: KissopenCheckout | null;
    /** Read with the rest of the account; null until the first read succeeds. */
    readonly profile: Profile | null;
    /** Why the last profile read failed, so the page can say so instead of loading forever. */
    readonly profileError: string;
    /** The invite page, read when it opens; null until then. */
    /** 主题: the theme page; null until read. */
    readonly themes: ThemesPage | null;
    readonly themesError: string;
    readonly themeGenerationAvailable: boolean;
    readonly themeGenerationHint: string;
    /** The gallery page last searched, with what it was searched for. */
    readonly themeGallery: {
        readonly q: string;
        readonly themes: readonly Theme[];
        readonly total: number;
    } | null;
    /** A theme being made — written by a model, imported, or one of the account's own being changed — not yet saved. */
    readonly themeDraft: ThemeDraft | null;
    /** A theme drawn over the account's for a look, until saved or put away. */
    readonly themePreview: ThemeDoc | null;
    readonly themeBusy: "" | "generating" | "saving" | "uploading";
    readonly themeError: string;
    /** A theme someone shared by link, waiting to be applied or ignored. */
    readonly themeShared: Theme | null;
    readonly invite: KissopenInvite | null;
    /** Why the invite page could not be read, or why a typed code was refused. */
    readonly inviteError: string;
    readonly billing: Billing | null;
    /** What the operator wants everyone to know now; empty on an older server. */
    readonly announcements: readonly KissopenAnnouncement[];
    /** Digits only, at most 11: the number without its +86. */
    readonly phone: string;
    /** Digits only, at most 6. */
    readonly code: string;
    /** Which half of signing in is on screen: the number, or the code sent to it. */
    readonly loginStep: LoginStep;
    /** Seconds before another code may be asked for; 0 when one may. */
    readonly resendIn: number;
    /** A development server hands the code back instead of sending it. */
    readonly developmentCode: string;
}
export type LoginStep = "phone" | "code";
export type KissopenCheckout = {
    /** A plan id, or a point pack's id when `pack` is set. */
    readonly plan: string;
    readonly planName: string;
    /** Buying a pack of points rather than a plan. */
    readonly pack: boolean;
    /** The pack's points, for its title. */
    readonly points: number;
    readonly amountFen: number;
    /** How long one purchase lasts. */
    readonly days: number;
    readonly planAction: PlanChangeAction | "";
    readonly expiresAt: number;
    /** The methods the server takes, e.g. "alipay", "wxpay"; empty until read. */
    readonly methods: readonly string[];
    readonly method: string;
    /**
     * "loading" while the order is placed, "scan" with a code to scan, "open"
     * with only a page to open, "paid" once the payment has landed, "failed"
     * when no order could be placed, "expired" when the client display window
     * requires an explicit refresh (not a platform cancellation).
     */
    readonly status: "loading" | "scan" | "open" | "paid" | "failed" | "review" | "expired";
    readonly order: string;
    readonly qrcode: string;
    readonly url: string;
    readonly message: string;
};
export type KissopenAnnouncement = {
    readonly id: string;
    readonly title: string;
    readonly body: string;
    readonly level: "info" | "warning";
};
export class KissopenStore {
    private state: KissopenSnapshot = {
        scheduleDraft: null,
        scheduleFocus: null,
        scheduleNavigation: 0,
        tab: "workspace",
        homeDemo: null,
        refreshedAt: Date.now(),
        boardSchedules: new Map(),
        boardSubmissions: new Map(),
        boardSchedulesLoaded: false,
        boardScheduleError: "",
        projectAnalyses: new Map(),
        homeError: "",
        busy: false,
        error: "",
        notice: "",
        workspaceStatus: "",
        ready: false,
        config: null,
        user: null,
        files: [],
        filesLoaded: 0,
        selectedFiles: [],
        libraryFilter: "all",
        libraryView: libraryViewRead(),
        inviteCardDismissed: false,
        librarySearch: "",
        plansOpen: false,
        checkout: null,
        profile: null,
        profileError: "",
        themes: null,
        themesError: "",
        themeGenerationAvailable: false,
        themeGenerationHint: "",
        themeGallery: null,
        themeDraft: null,
        themePreview: null,
        themeBusy: "",
        themeError: "",
        themeShared: null,
        invite: null,
        inviteError: "",
        billing: null,
        announcements: [],
        phone: "",
        code: "",
        loginStep: "phone",
        resendIn: 0,
        developmentCode: "",
    };
    private readonly listeners = new Set<() => void>();
    private timer: ReturnType<typeof setTimeout> | undefined;
    private refreshAt = 0;
    private generation = 0;
    private themeRevision = 0;
    private actionRevision = 0;
    private ticking = false;
    readonly billingHistory = billingHistoryStoreCreate((request) =>
        this.api<BillingHistory>("/billing/history", "POST", request),
    );
    constructor(private readonly transport: KissopenTransport) {}
    get = (): KissopenSnapshot => this.state;
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        if (this.listeners.size === 1) void this.tick();
        return () => {
            this.listeners.delete(listener);
            if (!this.listeners.size) {
                clearTimeout(this.timer);
                this.accountReset();
            }
        };
    };
    private set(patch: Partial<KissopenSnapshot>): void {
        this.state = { ...this.state, ...patch };
        for (const listener of this.listeners) listener();
    }
    /** An account boundary also invalidates every outstanding account read. */
    accountSessionEnd = (): void => this.accountReset();
    private accountReset(): void {
        this.generation++;
        this.checkoutReset();
        this.billingHistory.reset();
        this.themeRevision++;
        this.actionRevision++;
        this.refreshAt = 0;
        this.profileAt = 0;
        this.homeLoading = false;
        this.boardSchedulesReading = false;
        this.boardSchedulesVersion++;
        clearInterval(this.resendTimer);
        this.resendTimer = undefined;
        this.set({
            user: null,
            scheduleDraft: null,
            scheduleFocus: null,
            ready: false,
            busy: false,
            workspaceStatus: "",
            files: [],
            filesLoaded: 0,
            selectedFiles: [],
            librarySearch: "",
            libraryFilter: "all",
            billing: null,
            checkout: null,
            plansOpen: false,
            profile: null,
            profileError: "",
            themes: null,
            themesError: "",
            themeGenerationAvailable: false,
            themeGenerationHint: "",
            themeGallery: null,
            themeDraft: null,
            themePreview: null,
            themeBusy: "",
            themeError: "",
            themeShared: null,
            invite: null,
            inviteError: "",
            homeDemo: null,
            homeError: "",
            announcements: [],
            projectAnalyses: new Map(),
            boardSchedules: new Map(),
            boardSubmissions: new Map(),
            boardSchedulesLoaded: false,
            boardScheduleError: "",
            phone: "",
            code: "",
            loginStep: "phone",
            resendIn: 0,
            developmentCode: "",
            error: "",
            notice: "",
            tab: "workspace",
        });
    }
    private themeInvalidate(): number {
        this.themeRevision++;
        this.set({ themeBusy: "" });
        return this.themeRevision;
    }
    private themeCurrent(generation: number, revision: number): boolean {
        return generation === this.generation && revision === this.themeRevision;
    }
    private async api<T>(
        path: string,
        method: "GET" | "POST" = "GET",
        body?: Readonly<Record<string, unknown>>,
    ): Promise<T> {
        const generation = this.generation;
        const response = await this.transport.request(path, method, body);
        if (generation !== this.generation) throw new Error(t("账号已切换。"));
        if (response.status === 401) {
            this.accountReset();
            throw new Error(t("请重新登录KissOpen"));
        }
        const data = JSON.parse(response.text) as T & { error?: string };
        if (response.status < 200 || response.status >= 300) {
            throw new Error(data.error || t("KissOpen请求未完成"));
        }
        return data;
    }
    private async refresh(): Promise<void> {
        const generation = this.generation;
        const config = await this.api<Config>("/config");
        if (generation !== this.generation) return;
        const response = await this.transport.request("/me");
        if (generation !== this.generation) return;
        if (response.status === 401) {
            if (this.state.user) this.accountReset();
            this.set({ config, ready: true, user: null });
            this.refreshAt = Date.now();
            return;
        }
        if (response.status !== 200) throw new Error(t("账号服务暂不可用"));
        const user = JSON.parse(response.text) as User;
        if (this.state.user && this.state.user.id !== user.id) {
            this.accountReset();
            await this.refresh();
            return;
        }
        // Reading the account never provisions a cloud Agent or replaces the
        // independently configured local work-engine credential.
        if (generation !== this.generation) return;
        this.set({
            config,
            ready: true,
            user,
            error: "",
        });
        this.refreshAt = Date.now();
        // Account identity is independent of local files. The independent
        // account service has no cloud library or commercial announcements.
        this.set({ refreshedAt: Date.now() });
        // Project settings show whether a project builds its board on a
        // schedule, and may be opened before any board has been.
        // The profile page can be opened from settings as well as from the
        // account menu, so its figures are kept with the rest of the account
        // rather than fetched only by one of the two ways in. They are sums
        // over the whole history, so once a minute is plenty.
        if (!this.state.profile || Date.now() - this.profileAt > 60_000) {
            try {
                const profile = await this.api<Profile>("/profile");
                if (generation !== this.generation) return;
                this.set({ profile, profileError: "" });
                this.profileAt = Date.now();
            } catch (error) {
                // The page says why; the next refresh tries again on its own.
                if (generation !== this.generation) return;
                this.set({
                    profileError: error instanceof Error ? error.message : t("资料读取失败"),
                });
            }
        }
    }
    /**
     * The library alone, after something was put in it. The full refresh
     * also renews the workspace and the work-engine credential, and a hiccup
     * in either would leave the list stale behind an error about something
     * else; the list is what the reader is looking at.
     */
    private async filesRefresh(): Promise<void> {
        const generation = this.generation;
        const files = await this.api<FileItem[]>("/files");
        if (generation !== this.generation) return;
        this.set({ files, filesLoaded: Date.now() });
    }
    /**
     * Opens a library file with whatever this machine opens that kind of file
     * with. The host does the opening — it is the one with a file system — and
     * says why when it could not, which is shown where the file is.
     */
    fileOpen = (open: () => Promise<{ ok: boolean; error?: string }>): Promise<void> =>
        this.run(async () => {
            const result = await open();
            if (!result.ok) throw new Error(result.error || t("打不开这个文件"));
        });
    private profileAt = 0;
    private async tick(): Promise<void> {
        if (this.ticking) return;
        this.ticking = true;
        const generation = this.generation;
        try {
            if (
                this.state.tab === "themes" &&
                (typeof document === "undefined" || document.visibilityState === "visible")
            )
                void this.themeGenerationLoad();
            if (Date.now() - this.refreshAt > 10000) await this.refresh();
        } catch (error) {
            if (generation !== this.generation) return;
            this.set({
                error: error instanceof Error ? error.message : t("正在重新连接KissOpen"),
            });
        } finally {
            this.ticking = false;
            if (this.listeners.size) this.timer = setTimeout(() => void this.tick(), 3000);
        }
    }
    private async run(action: () => Promise<void>): Promise<void> {
        if (this.state.busy) return;
        const generation = this.generation;
        const revision = ++this.actionRevision;
        this.set({ busy: true, error: "", notice: "" });
        try {
            await action();
        } catch (error) {
            if (generation !== this.generation) return;
            this.set({ error: error instanceof Error ? error.message : t("请求未完成") });
        } finally {
            if (revision === this.actionRevision) this.set({ busy: false });
        }
    }
    tabSelect = (tab: KissopenTab): void => {
        // Removed commercial destinations cannot be reopened by old navigation.
        if (tab === "home" || tab === "chat" || tab === "billing" || tab === "invoices")
            tab = "workspace";
        this.set({ tab });
        if (tab !== "workspace") void this.tick();
        // 主题 opens on the gallery, so it is read along with the page.
        if (tab === "themes") {
            void this.themesLoad();
            void this.themeGalleryLoad(this.state.themeGallery?.q ?? "");
        }
    };
    scheduleProposalOpen = (instruction: string): void => {
        if (!instruction.trim()) return;
        this.set({
            tab: "schedules",
            scheduleDraft: instruction.trim(),
            scheduleFocus: null,
            scheduleNavigation: this.state.scheduleNavigation + 1,
        });
    };
    scheduleResultOpen = (id: string): void => {
        if (!id) return;
        this.set({
            tab: "schedules",
            scheduleDraft: null,
            scheduleFocus: id,
            scheduleNavigation: this.state.scheduleNavigation + 1,
        });
    };
    scheduleProposalSettle = (): void => this.set({ scheduleDraft: null });
    phoneUpdate = (phone: string): void =>
        this.set({ phone: phone.replace(/\D/g, "").slice(0, 11), error: "" });
    /** The sixth digit signs in: there is nothing else to decide by then. */
    codeUpdate = (code: string): void => {
        const digits = code.replace(/\D/g, "").slice(0, 6);
        this.set({ code: digits, error: "" });
        if (digits.length === 6 && this.state.loginStep === "code") void this.accountLogin();
    };
    /** Back to the number, to correct it; a code sent to the old one is moot. */
    phoneEdit = (): void =>
        this.set({ loginStep: "phone", code: "", developmentCode: "", error: "" });
    private resendTimer: ReturnType<typeof setInterval> | undefined;
    private resendCount(seconds: number): void {
        if (this.resendTimer) clearInterval(this.resendTimer);
        this.set({ resendIn: seconds });
        this.resendTimer = setInterval(() => {
            const left = this.state.resendIn - 1;
            this.set({ resendIn: Math.max(0, left) });
            if (left <= 0 && this.resendTimer) {
                clearInterval(this.resendTimer);
                this.resendTimer = undefined;
            }
        }, 1000);
    }
    libraryFilterSelect = (libraryFilter: FileKind | "all"): void => this.set({ libraryFilter });
    /** Hide the invite card for this app session; a new store shows it again. */
    inviteCardDismiss = (): void => {
        this.set({ inviteCardDismissed: true });
    };
    libraryViewSelect = (libraryView: "list" | "grid"): void => {
        this.set({ libraryView });
        libraryViewWrite(libraryView);
    };
    plansOpen = (): void => this.set({ plansOpen: true });
    /** Fetches the profile figures; the page asks for them when it opens. */
    profileLoad = (): Promise<void> =>
        this.run(async () => {
            const generation = this.generation;
            const profile = await this.api<Profile>("/profile");
            if (generation === this.generation) {
                this.set({ profile, profileError: "" });
                this.profileAt = Date.now();
            }
        });
    // ---- 主题 ----------------------------------------------------------------

    private themeGenerationReading = false;
    /** The visible secondary surface re-reads local capability, never cloud model availability. */
    private themeGenerationLoad = async (): Promise<void> => {
        if (this.themeGenerationReading) return;
        this.themeGenerationReading = true;
        const generation = this.generation;
        try {
            const capability = await this.api<{
                available: boolean;
                model: { providerId: string; modelId: string } | null;
            }>("/themes/generation");
            if (generation !== this.generation) return;
            this.set({
                themeGenerationAvailable: capability.available,
                themeGenerationHint: capability.available
                    ? ""
                    : t("请先在设置 → 服务商中启用并配置一个模型，再来制作主题。"),
                ...(this.state.themes
                    ? { themes: { ...this.state.themes, can_generate: capability.available } }
                    : {}),
            });
        } catch (error) {
            if (generation !== this.generation) return;
            this.set({
                themeGenerationAvailable: false,
                themeGenerationHint:
                    error instanceof Error
                        ? error.message
                        : t("本地 Agent 尚未连接，连接成功后即可制作主题。"),
                ...(this.state.themes
                    ? { themes: { ...this.state.themes, can_generate: false } }
                    : {}),
            });
        } finally {
            this.themeGenerationReading = false;
        }
    };

    /** Reads the theme page; the page asks for it when it opens. */
    themesLoad = async (): Promise<void> => {
        const generation = this.generation;
        try {
            const [themes] = await Promise.all([
                this.api<ThemesPage>("/themes"),
                this.themeGenerationLoad(),
            ]);
            if (generation === this.generation)
                this.set({
                    themes: { ...themes, can_generate: this.state.themeGenerationAvailable },
                    themesError: "",
                });
        } catch (error) {
            if (generation !== this.generation) return;
            this.set({ themesError: error instanceof Error ? error.message : t("主题读取失败") });
        }
    };
    /** Searches the gallery; an empty search is the whole gallery, most used first. */
    themeGalleryLoad = async (q = ""): Promise<void> => {
        const generation = this.generation;
        try {
            const page = await this.api<ThemeGallery>("/themes/gallery", "POST", {
                q,
                sort: "uses",
                limit: 48,
            });
            if (generation !== this.generation) return;
            this.set({ themeGallery: { q, themes: page.themes, total: page.total } });
        } catch (error) {
            if (generation !== this.generation) return;
            this.set({
                themeError: error instanceof Error ? error.message : t("主题广场读取失败"),
            });
        }
    };
    /** Chooses a theme for the account; an empty id is the product's own look. */
    themeSelect = async (id: string): Promise<void> => {
        const generation = this.generation;
        const revision = this.themeInvalidate();
        try {
            const chosen = await this.api<ThemeSelected>("/themes/select", "POST", { id });
            if (!this.themeCurrent(generation, revision)) return;
            this.themeApplied(chosen.theme);
            this.set({ themePreview: null, themeShared: null, themeError: "" });
        } catch (error) {
            if (!this.themeCurrent(generation, revision)) return;
            this.set({ themeError: error instanceof Error ? error.message : t("主题没有套用上") });
        }
    };
    /** Records the account's theme as the server settled it. */
    private themeApplied(theme: Theme | null): void {
        const user = this.get().user;
        const themes = this.get().themes;
        this.set({
            ...(user ? { user: { ...user, theme } } : {}),
            ...(themes ? { themes: { ...themes, selected: theme?.id ?? "" } } : {}),
        });
    }
    /** Asks a model for a theme from a sentence, or for a change to the draft; the answer becomes the draft, shown at once. */
    themeGenerate = async (prompt: string): Promise<void> => {
        if (this.state.themeBusy) return;
        if (!prompt.trim() || prompt.trim().length > 300) {
            this.set({ themeError: t("请用 1–300 个字描述想要的主题。") });
            return;
        }
        const draft = this.get().themeDraft;
        const base = draft?.doc;
        const generation = this.generation;
        const revision = this.themeInvalidate();
        this.set({ themeBusy: "generating", themeError: "" });
        try {
            const written = await this.api<ThemeGenerated>("/themes/generate", "POST", {
                prompt: prompt.trim(),
                ...(base ? { base } : {}),
            });
            if (!this.themeCurrent(generation, revision)) return;
            this.set({
                themeDraft: {
                    ...(draft?.id ? { id: draft.id } : {}),
                    name: written.name,
                    description: written.description,
                    source: draft?.id ? draft.source : "ai",
                    doc: written.doc,
                    from: "ai",
                },
                themePreview: written.doc,
                themeBusy: "",
            });
        } catch (error) {
            if (!this.themeCurrent(generation, revision)) return;
            this.set({
                themeBusy: "",
                themeError: error instanceof Error ? error.message : t("主题没有生成"),
            });
        }
    };
    /** Starts changing one of the account's own themes. */
    themeDraftEdit = (theme: Theme): void => {
        this.themeInvalidate();
        this.set({
            themeDraft: {
                id: theme.id,
                name: theme.name,
                description: theme.description,
                source: theme.source,
                doc: theme.doc,
                from: "edit",
            },
            themePreview: theme.doc,
            themeError: "",
        });
    };
    /** Changes part of the draft; the look follows. */
    themeDraftChange = (
        change: Partial<Pick<ThemeDraft, "name" | "description" | "doc">>,
    ): void => {
        const draft = this.get().themeDraft;
        if (!draft) return;
        this.themeInvalidate();
        const next = { ...draft, ...change };
        this.set({ themeDraft: next, themePreview: next.doc });
    };
    /** Puts the draft away without saving; the account's own theme shows again. */
    themeDraftClear = (): void => {
        this.themeInvalidate();
        this.set({ themeDraft: null, themePreview: null, themeError: "" });
    };
    /** Saves the draft as a theme of the account's own — a new one, or the one being changed — and uses it. */
    themeDraftSave = async (): Promise<boolean> => {
        const draft = this.get().themeDraft;
        if (!draft) return false;
        const generation = this.generation;
        const revision = this.themeInvalidate();
        this.set({ themeBusy: "saving", themeError: "" });
        try {
            const write: ThemeWrite = {
                name: draft.name,
                description: draft.description,
                source: draft.source,
                doc: draft.doc,
            };
            const saved = draft.id
                ? await this.api<Theme>(`/themes/${draft.id}`, "POST", write)
                : await this.api<Theme>("/themes", "POST", write);
            if (!this.themeCurrent(generation, revision)) return false;
            const chosen = await this.api<ThemeSelected>("/themes/select", "POST", {
                id: saved.id,
            });
            if (!this.themeCurrent(generation, revision)) return false;
            this.themeApplied(chosen.theme);
            this.set({ themeDraft: null, themePreview: null, themeBusy: "" });
            await this.themesLoad();
            return this.themeCurrent(generation, revision);
        } catch (error) {
            if (!this.themeCurrent(generation, revision)) return false;
            this.set({
                themeBusy: "",
                themeError: error instanceof Error ? error.message : t("主题没有保存"),
            });
            return false;
        }
    };
    themeDelete = async (id: string): Promise<void> => {
        const generation = this.generation;
        try {
            await this.api(`/themes/${id}/delete`, "POST", {});
            const user = this.get().user;
            if (user?.theme?.id === id) this.themeApplied(null);
            await this.themesLoad();
        } catch (error) {
            if (generation !== this.generation) return;
            this.set({ themeError: error instanceof Error ? error.message : t("主题没有删除") });
        }
    };
    /** Puts one of the account's themes in the gallery, or takes it out. */
    themePublish = async (id: string, published: boolean): Promise<void> => {
        const generation = this.generation;
        try {
            await this.api<Theme>(
                `/themes/${id}/${published ? "publish" : "unpublish"}`,
                "POST",
                {},
            );
            await this.themesLoad();
        } catch (error) {
            if (generation !== this.generation) return;
            this.set({ themeError: error instanceof Error ? error.message : t("主题没有发布") });
        }
    };
    /** Reads a theme from what someone pasted: a theme file, or a share link or id; the result becomes the draft, or the shared theme. */
    themeImport = async (text: string): Promise<void> => {
        const trimmed = text.trim();
        if (!trimmed) return;
        this.set({ themeError: "" });
        if (trimmed.startsWith("{")) {
            try {
                const parsed = readThemeImport(trimmed);
                const doc = parsed.doc;
                this.themeInvalidate();
                this.set({
                    themeDraft: {
                        name: parsed.name,
                        description: parsed.description,
                        source: "user",
                        doc,
                        from: "import",
                    },
                    themePreview: doc,
                });
            } catch (error) {
                this.set({
                    themeError: error instanceof Error ? error.message : t("这不是一个主题文件"),
                });
            }
            return;
        }
        const id =
            /(?:[?&]theme=|\/themes\/(?:public\/)?)([A-Za-z0-9_-]+)/u.exec(trimmed)?.[1] ?? trimmed;
        await this.themeShareOpen(id);
    };
    /** A theme reached by a share link: read, and offered. */
    themeShareOpen = async (id: string): Promise<void> => {
        const generation = this.generation;
        const revision = this.themeInvalidate();
        try {
            const theme = await this.api<Theme>(`/themes/${encodeURIComponent(id)}`);
            if (!this.themeCurrent(generation, revision)) return;
            this.set({ themeShared: theme, themePreview: theme.doc, themeError: "" });
        } catch (error) {
            if (!this.themeCurrent(generation, revision)) return;
            this.set({ themeError: error instanceof Error ? error.message : t("找不到这个主题") });
        }
    };
    themeShareDismiss = (): void => {
        this.themeInvalidate();
        this.set({ themeShared: null, themePreview: null });
    };
    /** Saves a theme as a file the person can pass on or import. */
    themeExport = async (theme: Theme): Promise<void> => {
        const write: ThemeWrite = {
            name: theme.name,
            description: theme.description,
            source: "user",
            doc: theme.doc,
        };
        await this.transport.downloadText(
            `${theme.name}.kissopen-theme.json`,
            JSON.stringify(write, null, 2),
        );
    };
    /** Uploads a picture for the draft's background; the draft carries it from then on. */
    themeImageUpload = async (file: {
        readonly size: number;
        readonly type: string;
        arrayBuffer(): Promise<ArrayBuffer>;
    }): Promise<void> => {
        const draft = this.get().themeDraft;
        if (!draft || this.get().themeBusy) return;
        const generation = this.generation;
        const revision = this.themeInvalidate();
        this.set({ themeBusy: "uploading", themeError: "" });
        try {
            const maxBytes = 3 * 1024 * 1024;
            if (file.size > maxBytes)
                throw new Error(t("背景图片不能超过 3 MB，请压缩图片或换一张后重试"));
            if (file.type && !["image/jpeg", "image/png", "image/webp"].includes(file.type))
                throw new Error(t("背景只支持 JPEG、PNG 和 WebP，请转换图片格式后重试"));
            let bytes: Uint8Array;
            try {
                bytes = new Uint8Array(await file.arrayBuffer());
            } catch {
                throw new Error(t("这张背景图片无法读取，请重新选择 JPEG、PNG 或 WebP 图片"));
            }
            if (!this.themeCurrent(generation, revision)) return;
            if (!bytes.length)
                throw new Error(t("这张背景图片无法读取，请重新选择 JPEG、PNG 或 WebP 图片"));
            if (bytes.length > maxBytes)
                throw new Error(t("背景图片不能超过 3 MB，请压缩图片或换一张后重试"));
            const image = await this.api<{ url: string }>("/themes/images", "POST", {
                mime: file.type,
                data: base64Of(bytes),
            });
            if (!this.themeCurrent(generation, revision)) return;
            const background = {
                url: image.url,
                opacity: draft.doc.background?.opacity ?? 0.3,
                blur: draft.doc.background?.blur ?? 0,
            };
            this.set({ themeBusy: "" });
            this.themeDraftChange({ doc: { ...draft.doc, background } });
        } catch (error) {
            if (!this.themeCurrent(generation, revision)) return;
            this.set({
                themeBusy: "",
                themeError: `${error instanceof Error ? error.message : t("图片没有上传")} ${t("当前主题和背景未改变，可以重新选择图片再试。")}`,
            });
        }
    };

    /** Reads the invite page; the page asks for it when it opens. */
    inviteLoad = async (): Promise<void> => {
        const generation = this.generation;
        try {
            const invite = await this.api<KissopenInvite>("/invite");
            if (generation === this.generation) this.set({ invite, inviteError: "" });
        } catch (error) {
            if (generation !== this.generation) return;
            this.set({
                inviteError: error instanceof Error ? error.message : t("邀请信息读取失败"),
            });
        }
    };
    /**
     * Opens 邀请有礼 on the product site in the browser. Inviting lives on the
     * site, not in the app; the page is on the same site as the invite link.
     */
    inviteOpen = async (): Promise<void> => {
        if (!this.get().invite) await this.inviteLoad();
        const invite = this.get().invite;
        if (invite) await this.transport.openUrl(new URL("/invite.html", invite.link).href);
    };
    plansClose = (): void => {
        this.checkoutReset();
        this.set({ plansOpen: false, checkout: null });
    };
    private checkoutTimer: ReturnType<typeof setInterval> | undefined;
    private checkoutRevision = 0;
    private checkoutReading: Promise<void> | undefined;
    private checkoutRefreshing = false;
    private readonly checkoutMethods = new Map<
        string,
        { checkout: KissopenCheckout; refreshAt: number }
    >();
    // Keep superseded orders too: refreshing a displayed code does not cancel
    // the platform order, and its delayed payment must still be recognised.
    private readonly checkoutOrders = new Map<string, KissopenCheckout>();
    private checkoutStop(): void {
        if (this.checkoutTimer) clearInterval(this.checkoutTimer);
        this.checkoutTimer = undefined;
    }
    private checkoutReset(): void {
        this.checkoutRevision++;
        this.checkoutStop();
        this.checkoutMethods.clear();
        this.checkoutOrders.clear();
        this.checkoutReading = undefined;
        this.checkoutRefreshing = false;
    }
    private checkoutExpire(): void {
        if (this.state.checkout?.status === "paid" || this.state.checkout?.status === "review")
            return;
        for (const entry of this.checkoutMethods.values()) {
            if (
                entry.refreshAt > 0 &&
                Date.now() >= entry.refreshAt &&
                (entry.checkout.status === "scan" || entry.checkout.status === "open")
            ) {
                entry.checkout = { ...entry.checkout, status: "expired" };
                if (this.state.checkout?.order === entry.checkout.order)
                    this.set({ checkout: entry.checkout });
            }
        }
    }
    /** Poll every generated order, not just the currently selected method. */
    private checkoutRead(): Promise<void> {
        if (this.checkoutReading) return this.checkoutReading;
        const revision = this.checkoutRevision;
        const reading = Promise.all(
            [...this.checkoutOrders.values()].map(async (checkout) => {
                const order = await this.api<{ status: string; needs_review: boolean }>(
                    `/billing/orders/${encodeURIComponent(checkout.order)}`,
                );
                if (
                    revision !== this.checkoutRevision ||
                    !this.state.checkout ||
                    this.state.checkout.status === "paid" ||
                    this.state.checkout.status === "review" ||
                    order.status !== "paid"
                )
                    return;
                this.checkoutStop();
                this.set({
                    checkout: { ...checkout, status: order.needs_review ? "review" : "paid" },
                });
                const billing = await this.api<Billing>("/billing");
                if (revision === this.checkoutRevision) this.set({ billing });
            }),
        ).then(() => undefined);
        this.checkoutReading = reading;
        void reading
            .finally(() => {
                if (this.checkoutReading === reading) this.checkoutReading = undefined;
            })
            .catch(() => undefined);
        return reading;
    }
    /**
     * Starts buying a plan: reads which methods the server takes, then places
     * the order with the first of them. The dialog lets the reader switch.
     */
    checkoutOpen = async (plan: string, pack = false): Promise<void> => {
        this.checkoutReset();
        const revision = this.checkoutRevision;
        const entry = this.state.billing?.plans.find((candidate) => candidate.id === plan);
        const bundle = this.state.billing?.points?.packs.find((candidate) => candidate.id === plan);
        const offer = pack
            ? undefined
            : this.state.billing?.plan_offers.find((candidate) => candidate.id === plan);
        if (offer?.action === "blocked") {
            this.set({ error: t(offer.message) });
            return;
        }
        const base: KissopenCheckout = {
            plan,
            planName: (pack ? bundle?.name : entry?.name) ?? plan,
            pack,
            points: bundle?.points ?? 0,
            amountFen: (pack ? bundle?.price_fen : (offer?.amount_fen ?? entry?.price_fen)) ?? 0,
            days: 30,
            planAction: offer?.action ?? "",
            expiresAt: offer?.expires_at ?? 0,
            methods: [],
            method: "",
            status: "loading",
            order: "",
            qrcode: "",
            url: "",
            message: "",
        };
        this.set({ checkout: base });
        const methodsOffer = await this.api<{ methods: string[] | null; period_days?: number }>(
            "/billing/pay-methods",
        ).catch(() => ({ methods: [] as string[], period_days: 0 }));
        const methods = methodsOffer.methods ?? [];
        const days =
            methodsOffer.period_days && methodsOffer.period_days > 0
                ? methodsOffer.period_days
                : 30;
        if (revision !== this.checkoutRevision) return;
        if (methods.length === 0) {
            this.set({
                checkout: {
                    ...base,
                    status: "failed",
                    message: t("在线支付暂未开通，请稍后再试。"),
                },
            });
            return;
        }
        this.set({ checkout: { ...base, days, methods } });
        await this.checkoutMethod(methods.includes("alipay") ? "alipay" : methods[0]!);
    };
    /**
     * Places the order for the plan being bought with one method and asks
     * about it every few seconds, so the dialog turns to "paid" by itself.
     * Each method keeps its order and code. Switching never places another
     * order for a method already visited, including loading or expired ones.
     */
    checkoutMethod = async (method: string): Promise<void> => {
        const current = this.state.checkout;
        if (
            !current ||
            !current.methods.includes(method) ||
            this.checkoutRefreshing ||
            current.status === "paid" ||
            current.status === "review"
        )
            return;
        this.checkoutExpire();
        const cached = this.checkoutMethods.get(method);
        if (cached) {
            this.set({ checkout: cached.checkout });
            return;
        }
        await this.checkoutCreate(method);
    };
    private async checkoutCreate(method: string): Promise<void> {
        const current = this.state.checkout;
        if (!current || current.status === "paid" || current.status === "review") return;
        const revision = this.checkoutRevision;
        const attempt = {
            ...current,
            method,
            status: "loading" as const,
            order: "",
            qrcode: "",
            url: "",
            message: "",
        };
        const entry = { checkout: attempt as KissopenCheckout, refreshAt: 0 };
        this.checkoutMethods.set(method, entry);
        this.set({ checkout: attempt });
        let out: Checkout;
        try {
            out = await this.api("/billing/checkout", "POST", {
                ...(current.pack ? { pack: current.plan } : { plan: current.plan }),
                type: method,
                mode: "qrcode",
            });
        } catch (error) {
            if (revision !== this.checkoutRevision) return;
            entry.checkout = {
                ...attempt,
                status: "failed",
                message: error instanceof Error ? error.message : String(error),
            };
            if (this.state.checkout?.method === method && this.state.checkout.status === "loading")
                this.set({ checkout: entry.checkout });
            return;
        }
        if (revision !== this.checkoutRevision) return;
        entry.checkout = {
            ...attempt,
            amountFen: out.amount_fen,
            days: out.days,
            planAction: out.plan_action,
            expiresAt: out.expires_at,
            status: out.qrcode ? "scan" : "open",
            order: out.order,
            qrcode: out.qrcode,
            url: out.url,
        };
        // 码上付's documented response has no expiry field. This is the
        // existing 15-minute client display window, not an assertion that
        // the platform has cancelled the order. Only an explicit refresh
        // creates another order; old orders continue being checked.
        entry.refreshAt = Date.now() + 15 * 60_000;
        this.checkoutOrders.set(out.order, entry.checkout);
        if (this.state.checkout?.status === "paid" || this.state.checkout?.status === "review")
            return;
        if (this.state.checkout?.method === method) this.set({ checkout: entry.checkout });
        if (!this.checkoutTimer)
            this.checkoutTimer = setInterval(() => {
                this.checkoutExpire();
                void this.checkoutRead().catch(() => undefined);
            }, 2500);
    }
    /** Check for payment first; never regenerate on a method-tab click. */
    checkoutRefresh = async (): Promise<void> => {
        const current = this.state.checkout;
        if (
            !current ||
            this.checkoutRefreshing ||
            (current.status !== "expired" && current.status !== "failed")
        )
            return;
        const revision = this.checkoutRevision;
        this.checkoutRefreshing = true;
        this.set({ checkout: { ...current, status: "loading", message: "" } });
        try {
            await this.checkoutRead();
            if (revision !== this.checkoutRevision || this.state.checkout?.status !== "loading")
                return;
            this.checkoutMethods.delete(current.method);
            await this.checkoutCreate(current.method);
        } catch {
            if (revision === this.checkoutRevision && this.state.checkout?.status === "loading")
                this.set({
                    checkout: {
                        ...current,
                        message: t("暂时无法确认付款状态，请稍后重试，避免重复付款。"),
                    },
                });
        } finally {
            if (revision === this.checkoutRevision) this.checkoutRefreshing = false;
        }
    };
    /** Closes the payment dialog; an order left unpaid simply lapses. */
    checkoutClose = (): void => {
        this.checkoutReset();
        this.set({ checkout: null });
    };
    /**
     * Saves the name and username. Rejects with the server's own sentence — "this
     * username is taken" — so the dialog that asked can show it and stay open.
     */
    profileSave = async (values: { displayName: string; username: string }): Promise<void> => {
        const user = await this.api<ProfileUser>("/profile", "POST", {
            display_name: values.displayName,
            username: values.username,
        } satisfies ProfileUpdate);
        this.profileUserSet(user);
    };
    /** Saves a framed avatar (base64 JPEG); rejects with a displayable message. */
    avatarSave = async (data: string, mime: string): Promise<void> => {
        const user = await this.api<ProfileUser>("/profile/avatar", "POST", {
            mime,
            data,
        } satisfies AvatarUpload);
        this.profileUserSet(user);
    };
    /** Carries a saved identity into both places it is shown. */
    private profileUserSet(user: ProfileUser): void {
        const profile = this.state.profile;
        this.set({
            ...(profile ? { profile: { ...profile, user } } : {}),
            ...(this.state.user
                ? {
                      user: {
                          ...this.state.user,
                          display_name: user.display_name,
                          avatar_url: user.avatar_url,
                      },
                  }
                : {}),
        });
    }
    librarySearchUpdate = (librarySearch: string): void => this.set({ librarySearch });
    fileToggle = (id: string): void =>
        this.set({
            selectedFiles: this.state.selectedFiles.includes(id)
                ? this.state.selectedFiles.filter((value) => value !== id)
                : [...this.state.selectedFiles, id],
        });
    codeSend = (): Promise<void> =>
        this.run(async () => {
            if (this.state.resendIn > 0) return;
            const result = await this.api<CodeSent>("/auth/code", "POST", {
                phone: this.state.phone,
            } satisfies CodeRequest);
            this.set({
                loginStep: "code",
                code: "",
                developmentCode: result.development_code ?? "",
            });
            this.resendCount(result.retry_after || 60);
        });
    accountLogin = (): Promise<void> =>
        this.run(async () => {
            try {
                const source = this.transport.signupSource?.();
                await this.api("/auth/login", "POST", {
                    phone: this.state.phone,
                    code: this.state.code,
                    ...(source === undefined ? {} : { source }),
                } satisfies LoginRequest);
            } catch (error) {
                // A wrong code is typed again from scratch, not edited.
                this.set({ code: "" });
                throw error;
            }
            this.accountReset();
            this.set({ code: "", loginStep: "phone", developmentCode: "", tab: "chat" });
            const generation = this.generation;
            try {
                await this.refresh();
            } catch (error) {
                if (generation === this.generation)
                    this.set({ error: error instanceof Error ? error.message : t("请求未完成") });
                return;
            }
            if (generation !== this.generation) return;
            // Signing in is the whole setup: the account already carries the model
            // access, so the work engine is provisioned here rather than behind a
            // button nobody knows to press. A failure is not a failed login — the
            // cloud chat still works — so it only leaves a notice behind.
            await this.runnerConnectQuiet();
        });
    /**
     * Provisions the work engine without turning its failure into a login error.
     * Desktop only: the browser build answers /agent/connect with a 400.
     */
    runnerConnectQuiet = async (): Promise<void> => {
        try {
            // Provisioned silently: a notice about request budgets on every
            // sign-in describes plumbing, not anything the reader asked for.
            await this.api("/agent/connect", "POST", {});
        } catch {
            // Already configured, or a browser build, or offline. None of these
            // should look like the sign-in itself went wrong.
        }
    };
    private homeLoading = false;
    /**
     * Reads the home page's demonstration, or asks for a new one. The first
     * one for a persona is written by a model and can take a little while;
     * the page waits on it with its own placeholder rather than the busy flag,
     * which belongs to actions.
     */
    /** Reads which projects build their boards on a schedule, and how each last went. */
    boardSchedulesLoad = async (): Promise<void> => {
        if (this.boardSchedulesReading) return;
        this.boardSchedulesReading = true;
        const generation = this.generation;
        const version = this.boardSchedulesVersion;
        try {
            const listed = await this.api<{ schedules: Schedule[] }>("/schedules");
            if (generation !== this.generation || version !== this.boardSchedulesVersion) return;
            const boards = new Map<string, Schedule>();
            for (const schedule of listed.schedules) {
                if (schedule.kind !== "board" || !schedule.target.startsWith("machine:")) continue;
                boards.set(
                    kissopenBoardKey({
                        machineId: schedule.target.slice("machine:".length),
                        projectPath: schedule.project_path,
                    }),
                    schedule,
                );
            }
            this.set({ boardSchedules: boards, boardSchedulesLoaded: true });
        } catch (error) {
            if (generation !== this.generation || version !== this.boardSchedulesVersion) return;
            this.set({
                boardScheduleError: error instanceof Error ? error.message : t("请求未完成"),
            });
        } finally {
            if (generation === this.generation) this.boardSchedulesReading = false;
        }
    };
    /**
     * Keeps the board schedules current while a board is on screen, so a
     * build that is running is followed until it ends. Returns the way to stop.
     */
    boardSchedulesWatch = (): (() => void) => {
        this.boardWatchers += 1;
        if (this.boardWatchers === 1 && !this.boardTimer) {
            void this.boardSchedulesLoad();
            this.boardTimer = setInterval(() => void this.boardSchedulesLoad(), 10_000);
        }
        let stopped = false;
        return () => {
            if (stopped) return;
            stopped = true;
            this.boardWatchers -= 1;
            // A surface that re-renders lets go and takes hold again in one
            // commit; the watch outlives that instead of reading again.
            setTimeout(() => {
                if (this.boardWatchers > 0 || !this.boardTimer) return;
                clearInterval(this.boardTimer);
                this.boardTimer = undefined;
            }, 0);
        };
    };
    private boardWatchers = 0;
    private boardTimer: ReturnType<typeof setInterval> | undefined;
    private boardSchedulesVersion = 0;
    private boardSchedulesReading = false;

    private boardSubmissionSet(key: string, value: KissopenBoardSubmission | undefined): void {
        const submissions = new Map(this.state.boardSubmissions);
        if (value) submissions.set(key, value);
        else submissions.delete(key);
        this.set({ boardSubmissions: submissions });
    }

    private boardScheduleKeep(key: string, schedule: Schedule): void {
        // A poll started before a mutation must not overwrite its newer answer.
        this.boardSchedulesVersion++;
        const schedules = new Map(this.state.boardSchedules);
        schedules.set(key, schedule);
        this.set({ boardSchedules: schedules });
    }
    /**
     * Turns a project's scheduled board build on, changes when it runs, or
     * turns it off (`timing` absent). Off pauses the schedule rather than
     * deleting it, so building now keeps working.
     */
    boardScheduleSave = (
        place: KissopenBoardPlace,
        timing: KissopenBoardTiming | undefined,
    ): Promise<void> =>
        this.run(async () => {
            const existing = this.state.boardSchedules.get(kissopenBoardKey(place));
            if (!existing) {
                if (!timing) return;
                await this.boardScheduleCreate(place, timing);
            } else {
                await this.api(`/schedules/${existing.id}`, "POST", {
                    status: timing ? "active" : "paused",
                    ...(timing
                        ? {
                              recurrence: timing.recurrence,
                              at_minute: timing.atMinute,
                              weekday: timing.weekday,
                              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                          }
                        : {}),
                });
            }
            this.set({ boardScheduleError: "" });
            await this.boardSchedulesLoad();
        });
    /** Builds a project's board now, making its schedule (paused) first when it has none. */
    boardBuildNow = async (place: KissopenBoardPlace): Promise<void> => {
        const key = kissopenBoardKey(place);
        let schedule = this.state.boardSchedules.get(key);
        if (
            this.state.boardSubmissions.get(key)?.status === "submitting" ||
            (schedule?.last_run && BOARD_RUN_ACTIVE.has(schedule.last_run.status))
        )
            return;
        const generation = this.generation;
        const submission: KissopenBoardSubmission = { status: "submitting" };
        // Per project, not the account-wide busy flag: other projects can start
        // independently, while a double click on this one submits only once.
        this.boardSubmissionSet(key, submission);
        try {
            if (!schedule) {
                schedule = await this.boardScheduleCreate(place, {
                    recurrence: "daily",
                    atMinute: 9 * 60,
                    weekday: 1,
                });
                if (generation !== this.generation) return;
                this.boardScheduleKeep(key, schedule);
                const paused = await this.api<{ schedule: Schedule }>(
                    `/schedules/${schedule.id}`,
                    "POST",
                    { status: "paused" },
                );
                if (generation !== this.generation) return;
                schedule = paused.schedule;
                this.boardScheduleKeep(key, schedule);
            }
            const { run } = await this.api<ScheduleRunStarted>(
                `/schedules/${schedule.id}/run`,
                "POST",
                {},
            );
            if (generation !== this.generation) return;
            // The POST returns the accepted run. Show that receipt immediately
            // instead of leaving the button idle until the next status poll.
            this.boardScheduleKeep(key, { ...schedule, last_run: run });
            this.boardSubmissionSet(key, undefined);
            this.set({ boardScheduleError: "" });
            void this.boardSchedulesLoad();
        } catch (error) {
            if (generation !== this.generation) return;
            this.boardSubmissionSet(key, {
                status: "failed",
                error: error instanceof Error ? error.message : t("请求未完成"),
            });
        } finally {
            if (this.state.boardSubmissions.get(key) === submission)
                this.boardSubmissionSet(key, undefined);
        }
    };
    private boardScheduleCreate = async (
        place: KissopenBoardPlace,
        timing: KissopenBoardTiming,
    ): Promise<Schedule> =>
        (
            await this.api<{ schedule: Schedule }>("/schedules", "POST", {
                kind: "board",
                target: `machine:${place.machineId}`,
                project_path: place.projectPath,
                project_name: place.projectName,
                name: t("构建项目看板"),
                instruction: t("构建项目看板"),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                recurrence: timing.recurrence,
                at_minute: timing.atMinute,
                weekday: timing.weekday,
                created_by: "desktop",
            })
        ).schedule;
    /** Reads whether a project's new material is analysed; kept by `kissopenBoardKey`. */
    projectAnalysisLoad = async (place: KissopenBoardPlace): Promise<void> => {
        try {
            const read = await this.api<{ analysis: ProjectAnalysisWire }>(
                "/project-analysis/read",
                "POST",
                {
                    target: `machine:${place.machineId}`,
                    project_path: place.projectPath,
                },
            );
            this.projectAnalysisKeep(place, read.analysis);
        } catch {
            // Offline or signed out: the switch shows its default until it can be read.
        }
    };
    /** Switches the AI's reading of a project's new material on or off. */
    projectAnalysisSet = (place: KissopenBoardPlace, enabled: boolean): Promise<void> =>
        this.run(async () => {
            const set = await this.api<{ analysis: ProjectAnalysisWire }>(
                "/project-analysis",
                "POST",
                {
                    target: `machine:${place.machineId}`,
                    project_path: place.projectPath,
                    project_name: place.projectName,
                    enabled,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
            );
            this.projectAnalysisKeep(place, set.analysis);
        });
    /**
     * Says files were just uploaded into a project, which sets its analysis of
     * new material for a couple of minutes from now. Best effort: the files are
     * in the project whatever the answer, and the next board build reads them.
     */
    projectFilesUploaded = async (place: KissopenBoardPlace): Promise<void> => {
        try {
            const set = await this.api<{ analysis: ProjectAnalysisWire }>(
                "/project-uploads",
                "POST",
                {
                    target: `machine:${place.machineId}`,
                    project_path: place.projectPath,
                    project_name: place.projectName,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
            );
            this.projectAnalysisKeep(place, set.analysis);
        } catch {
            // Not analysed this time; nothing is lost.
        }
    };
    private projectAnalysisKeep(place: KissopenBoardPlace, wire: ProjectAnalysisWire): void {
        const next = new Map(this.state.projectAnalyses);
        next.set(kissopenBoardKey(place), {
            enabled: wire.enabled,
            dueAt: wire.due_at ?? 0,
            limited: wire.limited === true,
        });
        this.set({ projectAnalyses: next });
    }
    homeDemoLoad = async (refresh = false): Promise<void> => {
        if (this.homeLoading) return;
        this.homeLoading = true;
        if (refresh) this.set({ homeDemo: null });
        this.set({ homeError: "" });
        const generation = this.generation;
        try {
            // A model takes longer to write the page than one request may
            // wait; the server keeps writing and says so, and asking again
            // collects it. Each ask itself waits up to 20 seconds.
            for (let attempt = 0; ; attempt++) {
                if (generation !== this.generation) return;
                const status = await this.api<HomeDemoStatus>("/home/demo", "POST", {
                    refresh: refresh && attempt === 0,
                });
                if (generation !== this.generation) return;
                if (status.demo) {
                    this.set({ homeDemo: status.demo });
                    return;
                }
                if (attempt >= 8) throw new Error(t("首页暂时没准备好"));
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        } catch (error) {
            if (generation !== this.generation) return;
            this.set({
                homeError: error instanceof Error ? error.message : t("首页暂时没准备好"),
            });
        } finally {
            if (generation === this.generation) this.homeLoading = false;
        }
    };
    /**
     * Keeps what the person said about their work, and writes the home page
     * from it. Skipping is an answer too: it is kept, so the questions are
     * not asked again, and the page is written for ordinary office work.
     */
    personaSave = (update: PersonaUpdate): Promise<void> =>
        this.run(async () => {
            const persona = await this.api<Persona>("/persona", "POST", {
                ...update,
                goals: [...update.goals],
            });
            const user = this.state.user;
            this.set({
                homeDemo: null,
                tab: "workspace",
                ...(user ? { user: { ...user, persona } } : {}),
            });
        });
    accountLogout = (): Promise<void> =>
        this.run(async () => {
            await this.api("/auth/logout", "POST", {});
            this.accountReset();
            await this.transport.signedOut?.();
        });
    fileRead = (file: { size: number; name: string; text(): Promise<string> }): Promise<void> =>
        this.run(async () => {
            if (file.size > 180000) throw new Error(t("请选择小于 180 KB 的文本文件"));
            const content = await file.text();
            const result = await this.api<FileItem>("/files", "POST", {
                name: file.name,
                content,
            } satisfies FileUpload);
            this.set({ selectedFiles: [...this.state.selectedFiles, result.id] });
            await this.filesRefresh();
        });
    /**
     * An office document — PDF, Word, Excel, PowerPoint — into the library, as
     * its bytes. The server keeps the file and reads its text, which is what a
     * chat is then handed; so it is selected for the next message like a text
     * file is.
     */
    documentRead = (file: {
        size: number;
        name: string;
        arrayBuffer(): Promise<ArrayBuffer>;
    }): Promise<void> =>
        this.run(async () => {
            if (file.size > 16 << 20) throw new Error(t("请选择小于 16 MB 的文档"));
            const result = await this.api<FileItem>("/files/document", "POST", {
                name: file.name,
                data: base64Of(new Uint8Array(await file.arrayBuffer())),
            } satisfies DocumentUpload);
            this.set({ selectedFiles: [...this.state.selectedFiles, result.id] });
            await this.filesRefresh();
        });
    /**
     * A picture into the library. A photo straight off a camera is several
     * times what the server takes, so one over the bound is drawn smaller and
     * saved as JPEG, the way the phone does it; a small picture goes as it is,
     * so a GIF keeps moving. Its size is read from the picture itself, since
     * the server wants it and a file name says nothing about it.
     */
    imageRead = (file: {
        size: number;
        name: string;
        type: string;
        arrayBuffer(): Promise<ArrayBuffer>;
    }): Promise<void> =>
        this.run(async () => {
            if (file.size > 50 << 20) throw new Error(t("请选择小于 50 MB 的图片"));
            let bytes = new Uint8Array(await file.arrayBuffer());
            let bitmap: ImageBitmap;
            try {
                bitmap = await createImageBitmap(new Blob([bytes], { type: file.type }));
            } catch {
                throw new Error(t("这张图片读不出来，支持 JPEG、PNG、WebP、GIF"));
            }
            let { width, height } = bitmap;
            let mime = file.type || "image/png";
            let name = file.name;
            if (bytes.length > IMAGE_MAX_BYTES || Math.max(width, height) > IMAGE_MAX_SIDE) {
                const shrunk = await imageShrink(bitmap);
                bytes = shrunk.bytes;
                width = shrunk.width;
                height = shrunk.height;
                mime = "image/jpeg";
                name = `${name.replace(/\.[^.]+$/, "")}.jpg`;
            }
            bitmap.close();
            await this.api<UploadedImage>("/images", "POST", {
                name,
                mime,
                data: base64Of(bytes),
                width,
                height,
            } satisfies ImageUpload);
            await this.filesRefresh();
        });
    /**
     * A recording as words, from the account's transcription service. Not
     * run through `run`: it is a step inside a composer, not one of the
     * page's own actions, and its failure is shown beside the mic that made it.
     */
    transcribe = async (mime: string, data: string, durationMs: number): Promise<string> => {
        const result = await this.api<Transcription>("/transcriptions", "POST", {
            mime,
            data,
            duration_ms: durationMs,
        } satisfies TranscriptionRequest);
        return result.text;
    };
    fileUpload = (name: string, content: string): Promise<void> =>
        this.run(async () => {
            if (content.length > 180000) throw new Error(t("请选择小于 180 KB 的文本文件"));
            const file = await this.api<FileItem>("/files", "POST", {
                name,
                content,
            } satisfies FileUpload);
            this.set({ selectedFiles: [...this.state.selectedFiles, file.id] });
            await this.filesRefresh();
        });
}

/** Bytes as base64, in pieces small enough for btoa's argument. */
function base64Of(bytes: Uint8Array): string {
    let binary = "";
    for (let at = 0; at < bytes.length; at += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
    }
    return btoa(binary);
}

/** What the server takes for a picture, and the longest side worth sending. */
const IMAGE_MAX_BYTES = 700 * 1024;
const IMAGE_MAX_SIDE = 2048;

/**
 * A picture redrawn small enough to send: first at the longest side the
 * server is worth, then at lower JPEG quality, then smaller again, until it
 * fits. A picture that will not fit at the last step is one the server would
 * refuse, so that is said here instead.
 */
async function imageShrink(
    bitmap: ImageBitmap,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; width: number; height: number }> {
    for (const side of [IMAGE_MAX_SIDE, 1600, 1200, 800]) {
        const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext("2d");
        if (!context) break;
        context.drawImage(bitmap, 0, 0, width, height);
        for (const quality of [0.85, 0.7, 0.55]) {
            const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
            if (blob.size <= IMAGE_MAX_BYTES) {
                return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
            }
        }
    }
    throw new Error(t("这张图片太大，缩小后仍超过 700 KB"));
}

/*
 * The library's layout is how this reader likes to look at their files on this
 * computer, not something the account should carry. Storage that is missing or
 * refuses leaves the list, which is where the library starts.
 */
const LIBRARY_VIEW_KEY = "kissopen.library.view";
function libraryViewRead(): "list" | "grid" {
    try {
        return globalThis.localStorage?.getItem(LIBRARY_VIEW_KEY) === "grid" ? "grid" : "list";
    } catch {
        return "list";
    }
}

function libraryViewWrite(view: "list" | "grid"): void {
    try {
        globalThis.localStorage?.setItem(LIBRARY_VIEW_KEY, view);
    } catch {
        // A layout that cannot be remembered is still the layout for now.
    }
}
