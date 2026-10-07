import { apiSocket } from "@/sync/apiSocket";
import {
    DesktopRequestSchema,
    DesktopReplySchema,
    DESKTOP_MANAGEMENT_METHOD,
    type DesktopData,
    type DesktopRequest,
} from "@kissopen/kissopen-sync/desktopManagement";
import { onboardingText as copy } from "@/components/onboarding/BrandScreen";

export async function desktopRead(
    machineId: string,
    request: DesktopRequest,
): Promise<DesktopData> {
    const result = DesktopReplySchema.safeParse(
        await apiSocket.machineRPC<unknown, DesktopRequest>(
            machineId,
            DESKTOP_MANAGEMENT_METHOD,
            DesktopRequestSchema.parse(request),
            { timeoutMs: 20000 },
        ),
    );
    if (!result.success)
        throw new Error(
            copy(
                "Update KissOpen on this computer to view its data.",
                "请更新这台电脑的 KissOpen 后查看数据。",
            ),
        );
    if (!result.data.ok) {
        const code = result.data.code;
        throw new Error(
            code === "too_large"
                ? copy(
                      "This item is too large for a mobile preview. Open it on your computer.",
                      "内容超过手机预览大小，请在电脑上打开。",
                  )
                : code === "missing"
                  ? copy(
                        "This item is no longer available on the computer.",
                        "这项内容在电脑上已不存在。",
                    )
                  : copy(
                        "The computer could not complete this operation. Check its Agent connection and try again.",
                        "电脑暂时无法完成操作，请检查本地 Agent 的连接。",
                    ),
        );
    }
    const expected =
        request.action === "status"
            ? "status"
            : request.action === "plugins.list"
              ? "plugins"
              : request.action === "schedules.list"
                ? "schedules"
                : request.action === "schedule.runs"
                  ? "runs"
                  : request.action === "library.projects"
                    ? "projects"
                    : request.action === "library.directory"
                      ? "directory"
                      : request.action === "library.read"
                        ? "file"
                        : "ack";
    if (result.data.data.kind !== expected)
        throw new Error(
            copy(
                "Update KissOpen on this computer to view its data.",
                "请更新这台电脑的 KissOpen 后查看数据。",
            ),
        );
    return result.data.data;
}
export const desktopUnavailable = () =>
    copy(
        "Cannot reach this computer. Keep KissOpen open there and make sure both devices are signed in to the same account.",
        "暂时连不上这台电脑。请保持电脑上的 KissOpen 在线，并确认两端登录同一账号。",
    );
