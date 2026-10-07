import { KissopenAgentProfilePage } from "../../src/pages/settings/KissopenAgentProfilePage";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-286";

const today = "2026-09-19";

/* A year of days with a believable rhythm: busier on weekdays, quiet stretches,
   and one standout peak so every level of the scale appears. */
const activity = Array.from({ length: 300 }, (_, index) => {
    const date = new Date("2026-09-19T00:00:00");
    date.setDate(date.getDate() - index);
    const weekday = date.getDay();
    const base = weekday === 0 || weekday === 6 ? 0 : (index * 7919) % 90_000;
    const tokens = index % 11 === 0 ? 0 : base + (index === 3 ? 240_000 : 0);
    return {
        day: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
        tokens,
    };
}).filter((entry) => entry.tokens > 0);

const stage: Record<string, string> = { display: "flex", width: "1180px", padding: "24px" };

export function ProfilePagePage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="Who this account is and what it has done — every figure read from work that actually happened."
            title="ProfilePage"
        >
            <Specimen
                detail="identity · five headline figures · a year of days · the detail behind them"
                label="Active account"
                number="01"
                stage="app"
            >
                <div style={stage}>
                    <KissopenAgentProfilePage
                        activity={activity}
                        displayName="小明"
                        handle="@xiaoming"
                        onInvite={() => {}}
                        onAvatarSave={async () => {}}
                        onProfileSave={async () => {}}
                        username="xiaoming"
                        password={{
                            enabled: true,
                            factorRequired: false,
                            usernameReady: true,
                            busy: false,
                            onSave: async () => {},
                            onCancel: () => {},
                        }}
                        insights={[
                            { label: "对话总数", value: "38" },
                            { label: "最长的一段对话", value: "42 条消息" },
                            { label: "生成的图片", value: "7" },
                            { label: "资料库文件", value: "12" },
                            { label: "模型调用次数", value: "1,284" },
                        ]}
                        name="管理员"
                        planName="Plus"
                        stats={[
                            { label: "累计 token", value: "12.4M" },
                            { label: "单日最高", value: "240K" },
                            { label: "对话", value: "38" },
                            { label: "当前连续", value: "4 天" },
                            { label: "最长连续", value: "21 天" },
                        ]}
                        today={today}
                    />
                </div>
                <DimensionRule label="calendar 53 weeks × 7 days · levels relative to this account's own peak" />
            </Specimen>

            <Specimen
                detail="a brand-new account: small numbers, not a broken-looking page"
                label="Quiet account"
                number="02"
                stage="app"
            >
                <div style={stage}>
                    <KissopenAgentProfilePage
                        activity={[{ day: today, tokens: 900 }]}
                        insights={[
                            { label: "对话总数", value: "1" },
                            { label: "最长的一段对话", value: "2 条消息" },
                        ]}
                        name="新用户"
                        password={{
                            enabled: false,
                            factorRequired: false,
                            usernameReady: false,
                            busy: false,
                            onSave: async () => {},
                            onCancel: () => {},
                        }}
                        planName="Free"
                        stats={[
                            { label: "累计 token", value: "900" },
                            { label: "单日最高", value: "900" },
                            { label: "对话", value: "1" },
                            { label: "当前连续", value: "1 天" },
                            { label: "最长连续", value: "1 天" },
                        ]}
                        today={today}
                    />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
