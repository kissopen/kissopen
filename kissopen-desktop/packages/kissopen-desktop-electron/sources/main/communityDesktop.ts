import { join } from "node:path";

/** No account backend or update service is bundled with the local open-source preview. */
export const communityServiceUnavailable = "https://unconfigured.kissopen.invalid";

export function communityUserDataDirectory(appData: string, checkout?: string): string {
    return join(appData, checkout ? `kissopen-oss-dev-${checkout}` : "kissopen-oss");
}

/** Do not inherit a commercial daemon address, account token, or home from the login shell. */
export function communityAgentEnvironment(
    environment: NodeJS.ProcessEnv,
    home: string,
): NodeJS.ProcessEnv {
    const result = { ...environment };
    for (const key of Object.keys(result)) {
        if (key.startsWith("KISSOPEN_")) delete result[key];
    }
    result.KISSOPEN_HOME_DIR = home;
    // Independent encrypted transport only: no hosted model or commercial account.
    result.KISSOPEN_SERVER_URL = "https://kissopen.com";
    result.KISSOPEN_AGENT_KISSOPEN_SERVER_URL = "https://kissopen.com";
    result.KISSOPEN_WEBAPP_URL = "https://app.kissopen.com";
    return result;
}
