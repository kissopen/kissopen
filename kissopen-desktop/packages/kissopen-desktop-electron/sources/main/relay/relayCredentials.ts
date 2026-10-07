/*
The account's own identity on the sync relay.

This is what lets a desktop see the rest of the account: the machines the
person has, and the cloud workspace, which registers itself as one of them.
The business server hands it out per account — the same identity the phone
gets, and the same one this desktop already configures for its local Agent.

It stays in the main process. The renderer never receives `token` or `secret`:
this bridge does not hand bearer credentials to JS, and the relay's credential
is no different from the others in that respect. What the renderer gets is
already-decrypted conversations.

Nothing here touches Electron, so it can be tested without one.
*/

import { t } from "kissopen-desktop-state/i18n";

/** What `POST /api/workspace/session` answers with. */
export interface RelayCredentials {
    /** The account these belong to. Checked against the signed-in account. */
    readonly userId: string;
    /** Bearer token for the relay's socket and REST API. */
    readonly token: string;
    /** Base64url. The key everything on the relay is encrypted under. */
    readonly secret: string;
    /** Where the relay lives. Not a fixed host: deployments differ. */
    readonly serverUrl: string;
}

/** How this module reaches the business server. Supplied by the caller. */
export interface RelayCredentialsSource {
    /**
     * Performs an authenticated POST against the consumer API.
     *
     * Given as a function rather than taken from a module so that the token
     * handling, the keyring and the host allow-list all stay where they
     * already are.
     */
    post(path: string): Promise<{ status: number; text: string }>;
}

function fail(message: string): never {
    throw new Error(message);
}

/**
 * Fetches this account's relay identity.
 *
 * Refuses an answer for a different account. The person can sign out and back
 * in as somebody else while a request is in flight, and connecting to the
 * relay under the previous account's identity would show them a stranger's
 * machines — so the account is checked here rather than assumed.
 */
export async function relayCredentialsFetch(
    source: RelayCredentialsSource,
    expectedUserId: string,
): Promise<RelayCredentials> {
    const response = await source.post("/workspace/session");
    if (response.status !== 200) fail(t("工作空间身份获取失败（{status}）", { status: response.status }));

    let body: unknown;
    try {
        body = JSON.parse(response.text);
    } catch {
        fail(t("工作空间身份响应无法解析"));
    }

    const record = body as Record<string, unknown>;
    const userId = typeof record.user_id === "string" ? record.user_id : "";
    const token = typeof record.token === "string" ? record.token : "";
    const secret = typeof record.secret === "string" ? record.secret : "";
    const serverUrl = typeof record.server_url === "string" ? record.server_url : "";
    if (!userId || !token || !secret || !serverUrl) fail(t("工作空间身份响应不完整"));
    if (userId !== expectedUserId) fail(t("账号已切换，请重新登录后再试"));

    // The relay is reached over the network with this credential attached, so
    // where it points is a security question, not a formatting one.
    let parsed: URL;
    try {
        parsed = new URL(serverUrl);
    } catch {
        fail(t("工作空间地址无效"));
    }
    if (
        parsed.protocol !== "https:" &&
        parsed.hostname !== "localhost" &&
        parsed.hostname !== "127.0.0.1"
    )
        fail(t("工作空间地址必须是 https"));

    return { userId, token, secret, serverUrl: parsed.origin };
}
