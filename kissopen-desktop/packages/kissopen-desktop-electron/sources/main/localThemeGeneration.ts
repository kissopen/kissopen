import { KissopenAgentApiError, type LocalThemeGenerate } from "@kissopen/kissopen-agent-client";
import type { KissopenCloudRequest, KissopenCloudResponse } from "../shared/kissopenCloud";
import {
    KissopenAgentDaemonClient,
    kissopenAgentDaemonPathsResolve,
    kissopenAgentDaemonTokenRead,
} from "./kissopenAgentDaemonClient";

const answer = (status: number, value: unknown): KissopenCloudResponse => ({
    status,
    text: JSON.stringify(value),
});
/** Only authenticated Unix-socket transport lives here; generation is owned by Agent. */
export async function localThemeGenerationRequest(
    request: KissopenCloudRequest,
): Promise<KissopenCloudResponse> {
    try {
        const paths = kissopenAgentDaemonPathsResolve();
        const token = await kissopenAgentDaemonTokenRead(paths.tokenPath);
        if (!token)
            return answer(503, {
                error: "The local Agent is still connecting. Theme generation will be available when it is ready.",
            });
        const client = new KissopenAgentDaemonClient({ socketPath: paths.socketPath, token })
            .themes;
        if (request.path === "/themes/generation" && request.method === "GET")
            return answer(200, await client.capability({ signal: AbortSignal.timeout(10000) }));
        if (request.path === "/themes/generate" && request.method === "POST")
            return answer(
                200,
                await client.generate(request.body as unknown as LocalThemeGenerate, {
                    signal: AbortSignal.timeout(130000),
                }),
            );
        return answer(400, { error: "This theme action is not available." });
    } catch (error) {
        if (error instanceof KissopenAgentApiError) {
            if (error.status === 404 || error.status === 501)
                return answer(503, {
                    error: "Update the local Agent to make themes with your own model.",
                });
            if (error.status !== 401) return answer(error.status, { error: error.message });
        }
        return answer(503, {
            error: "The local Agent could not be reached. Wait for it to reconnect and try again; your theme draft is unchanged.",
        });
    }
}
