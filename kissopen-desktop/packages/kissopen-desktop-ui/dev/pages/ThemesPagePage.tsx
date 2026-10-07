import type { Theme, ThemeDoc, ThemesPage } from "kissopen-desktop-state";
import { KissopenThemesPage } from "../../src/pages/settings/KissopenThemesPage";
import { ComponentPage, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-309";

const doc = (accent: string, canvas: string, surface: string, dark: boolean): ThemeDoc => ({
    version: 1,
    font: "sans",
    radius: "soft",
    light: {
        accent,
        on_accent: "#ffffff",
        canvas,
        surface,
        raised: canvas,
        text: "#111111",
        muted: "#5a5a66",
        line: "#e6e6ea",
        success: "#34c759",
        warning: "#ff9500",
        danger: "#ff3b30",
    },
    dark: {
        accent,
        on_accent: "#111111",
        canvas: dark ? "#1b1b1f" : "#1e1e1e",
        surface: "#242428",
        raised: "#17171a",
        text: "#ffffff",
        muted: "#c4c4cc",
        line: "#2c2c31",
        success: "#32d74b",
        warning: "#ff9f0a",
        danger: "#ff453a",
    },
});

const theme = (
    id: string,
    name: string,
    description: string,
    accent: string,
    more: Partial<Theme> = {},
): Theme => ({
    id,
    name,
    description,
    source: "system",
    owner: "",
    mine: false,
    public: true,
    featured: false,
    uses: 0,
    created: 0,
    updated: 0,
    doc: doc(accent, "#f5f5f5", "#ffffff", false),
    ...more,
});

const system = [
    theme("sys-yiqijuan", "一起卷", "产品本来的样子。", "#6b5bd2"),
    theme("sys-warm", "暖阳", "米色的纸、橙色的光。", "#c96a1f"),
    theme("sys-teal", "青川", "青绿的水色。", "#1a8a85"),
    theme("sys-ink", "墨", "黑白高对比，只留下必要的信息。", "#454545"),
    theme("sys-eye", "护眼", "微黄的纸色和柔和的绿，久看不累。", "#26834a"),
    theme("sys-sakura", "樱", "粉色的强调，配很淡的暖白。", "#db3e82"),
];
const mine = [
    theme("mine-1", "秋日", "AI 写的暖橙。", "#d0723a", {
        source: "ai",
        mine: true,
        public: true,
        uses: 3,
    }),
    theme("mine-2", "夜航", "自己调的深蓝。", "#3f6fd8", {
        source: "user",
        mine: true,
        public: false,
    }),
];
const page: ThemesPage = {
    selected: "sys-warm",
    system,
    mine,
    featured: [mine[0]!],
    can_generate: true,
};
const none = () => undefined;
const handlers = {
    onDelete: none,
    onDraftChange: none,
    onDraftClear: none,
    onDraftEdit: none,
    onDraftSave: none,
    onExport: none,
    onGalleryLoad: none,
    onGenerate: none,
    onImageUpload: none,
    onImport: none,
    onPublish: none,
    onSelect: none,
    onShareDismiss: none,
    shareLink: (id: string) => `https://example.test/app/?theme=${id}`,
};
const stage: Record<string, string> = { width: "1040px", height: "760px", display: "flex" };

export function ThemesPagePage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="主题: a sidebar destination that opens on the gallery, official themes first, with 制作我的主题, 导入 and 搜索 in the heading."
            title="ThemesPage"
        >
            <Specimen
                detail="equal gallery cards · incomplete final row · diagonal current-theme ribbon"
                label="Choosing"
                number="01"
                stage="app"
            >
                <div style={stage}>
                    <KissopenThemesPage
                        {...handlers}
                        busy=""
                        current={system[1]!}
                        draft={null}
                        gallery={{ q: "", themes: [], total: 0 }}
                        shared={null}
                        themes={page}
                    />
                </div>
            </Specimen>
            {[
                { number: "04", label: "Uploading", busy: "uploading" as const, error: "" },
                {
                    number: "05",
                    label: "Upload failed",
                    busy: "" as const,
                    error: "背景图片不能超过 3 MB，请压缩图片或换一张后重试。当前主题和背景未改变，可以重新选择图片再试。",
                },
                { number: "06", label: "Background preview", busy: "" as const, error: "" },
            ].map((sample) => (
                <Specimen
                    key={sample.number}
                    detail="background feedback · draft preserved · save after preview"
                    label={sample.label}
                    number={sample.number}
                    stage="app"
                >
                    <div style={stage}>
                        <KissopenThemesPage
                            {...handlers}
                            busy={sample.busy}
                            current={system[1]!}
                            draft={{
                                name: "秋日",
                                description: "暖橙",
                                source: "user",
                                doc: {
                                    ...mine[0]!.doc,
                                    background: {
                                        url: "https://example.test/api/themes/images/0123456789abcdef",
                                        opacity: 0.3,
                                        blur: 0,
                                    },
                                },
                                from: "edit",
                            }}
                            gallery={null}
                            shared={null}
                            themeError={sample.error}
                            themes={page}
                        />
                    </div>
                </Specimen>
            ))}
            <Specimen
                detail="draft editor · shared by link"
                label="Editing"
                number="02"
                stage="app"
            >
                <div style={stage}>
                    <KissopenThemesPage
                        {...handlers}
                        busy=""
                        current={null}
                        draft={{
                            name: "秋日",
                            description: "暖橙",
                            source: "ai",
                            doc: mine[0]!.doc,
                            from: "ai",
                        }}
                        gallery={{ q: "", themes: mine, total: 2 }}
                        shared={mine[0]!}
                        themes={page}
                    />
                </div>
            </Specimen>
            <Specimen detail="loading · unreadable" label="Reading" number="03" stage="app">
                <div style={{ ...stage, display: "flex", gap: "24px" }}>
                    <KissopenThemesPage
                        {...handlers}
                        busy=""
                        current={null}
                        draft={null}
                        gallery={null}
                        shared={null}
                        themes={null}
                    />
                    <KissopenThemesPage
                        {...handlers}
                        busy=""
                        current={null}
                        draft={null}
                        error="网络连接失败"
                        gallery={null}
                        shared={null}
                        themes={null}
                    />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
