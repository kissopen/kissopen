import { CommunityAuthClient } from "@kissopen/kissopen-sync/communityAuth";
import type { KissopenCloudRequest, KissopenCloudResponse } from "../shared/kissopenCloud";

/** Browser development owns its own tab session; it never shares a credential
 * through the Vite server or writes plaintext into the desktop's keychain file. */
export function communityBrowserRequestCreate() {
    const auth = new CommunityAuthClient(
        import.meta.env.VITE_KISSOPEN_COMMUNITY_AUTH_URL || "https://kissopen.com",
    );
    const api = new CommunityAuthClient(
        import.meta.env.VITE_KISSOPEN_COMMUNITY_API_URL || "https://kissopen.com",
    );
    const key = `kissopen.oss.community.session.v1:${auth.origin}`;
    let generation = 0;
    const answer = (status: number, value: unknown): KissopenCloudResponse => ({
        status,
        text: JSON.stringify(value),
    });
    return async (input: KissopenCloudRequest): Promise<KissopenCloudResponse> => {
        try {
            if (
                !input.path.startsWith("/") ||
                input.path.includes("..") ||
                input.path.includes("?") ||
                input.path.includes("#") ||
                input.path.startsWith("//")
            )
                return answer(403, { error: "Invalid account action." });
            if (input.path === "/auth/community" && input.method === "POST") {
                const token = input.body?.token;
                if (typeof token !== "string")
                    return answer(400, { error: "Invalid sign-in session." });
                const profile = await auth.account(token);
                window.sessionStorage.setItem(key, token);
                ++generation;
                return answer(200, profile);
            }
            const token = window.sessionStorage.getItem(key);
            if (input.path === "/auth/logout" && input.method === "POST") {
                ++generation;
                window.sessionStorage.removeItem(key);
                if (token) await auth.signOut(token).catch(() => undefined);
                return answer(200, { ok: true });
            }
            const version = generation;
            if (input.path === "/auth/community/session" && input.method === "GET") {
                if (!token) return answer(200, null);
                try {
                    const profile = await auth.account(token);
                    return version === generation
                        ? answer(200, profile)
                        : answer(409, { error: "The account changed." });
                } catch (error) {
                    if ((error as { status?: number }).status !== 401) throw error;
                    if (version === generation) {
                        window.sessionStorage.removeItem(key);
                        ++generation;
                    }
                    return answer(200, null);
                }
            }
            const response = await fetch(api.origin + "/api" + input.path, {
                method: input.method,
                redirect: "error",
                signal: AbortSignal.timeout(input.path === "/documents/pdf" ? 120000 : 30000),
                headers: {
                    "Content-Type": "application/json",
                    "X-KISSOPEN-Request": "1",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                ...(input.body ? { body: JSON.stringify(input.body) } : {}),
            });
            const text = await response.text();
            return version === generation
                ? { status: response.status, text }
                : answer(409, { error: "The account changed." });
        } catch (error) {
            return answer((error as { status?: number }).status || 503, {
                error:
                    error instanceof Error
                        ? error.message
                        : "Account service is temporarily unavailable.",
            });
        }
    };
}
