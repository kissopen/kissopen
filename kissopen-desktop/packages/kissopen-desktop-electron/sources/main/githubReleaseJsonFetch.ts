import { t } from "kissopen-desktop-state/i18n";

/** Shared bounds for optional native/Agent release metadata, not binary downloads. */
export async function githubReleaseJsonFetch(
    url: string,
    fetch_: typeof globalThis.fetch = globalThis.fetch,
    signal: AbortSignal = AbortSignal.timeout(30_000),
): Promise<unknown> {
    const response = await fetch_(url, {
        headers: {
            accept: "application/vnd.github+json",
            "user-agent": "KISSOPEN Desktop updater",
            "x-github-api-version": "2022-11-28",
        },
        signal,
    });
    const reader = response.body?.getReader();
    try {
        if (new URL(response.url).protocol !== "https:")
            throw new Error(t("更新服务的地址不安全，已停止检查更新。"));
        if (!response.ok || !reader)
            throw new Error(
                response.status === 404
                    ? t("更新服务上还没有适合这台电脑的新版本，请安装最新的一起卷安装包。")
                    : t("暂时连不上更新服务（{status}），请稍后再试。", {
                          status: String(response.status),
                      }),
            );
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes > 4 * 1024 * 1024) throw new Error(t("更新服务返回的信息异常，请稍后再试。"));
            chunks.push(chunk.value);
        }
        return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } finally {
        await reader?.cancel().catch(() => undefined);
        reader?.releaseLock();
    }
}
