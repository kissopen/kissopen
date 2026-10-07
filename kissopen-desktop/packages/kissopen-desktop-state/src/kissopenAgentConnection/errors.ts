import { KissopenAgentApiError } from "@kissopen/kissopen-agent-client";

export type ProjectRegistrationErrorCode =
    | "invalid_request"
    | "path_missing"
    | "not_directory"
    | "path_inaccessible"
    | "not_git_repository"
    | "not_git_top_level"
    | "managed_workspace_unavailable"
    | "project_id_conflict"
    | (string & {});

export class ProjectRegistrationError extends Error {
    constructor(
        readonly code: ProjectRegistrationErrorCode,
        readonly status: number,
        message: string,
    ) {
        super(message);
        this.name = "ProjectRegistrationError";
    }
}

export class ProjectRegistrationProtocolError extends Error {
    constructor(
        readonly code: "invalid_response" | "request_failed",
        readonly status: number | undefined,
        message: string,
    ) {
        super(message);
        this.name = "ProjectRegistrationProtocolError";
    }
}

export function projectRegistrationError(error: unknown): Error {
    if (error instanceof KissopenAgentApiError) {
        return new ProjectRegistrationError(
            error.code ?? "invalid_request",
            error.status,
            error.message,
        );
    }
    if (error instanceof Error) {
        return new ProjectRegistrationProtocolError("request_failed", undefined, error.message);
    }
    return new ProjectRegistrationProtocolError(
        "invalid_response",
        undefined,
        "The KissOpen Agent server gave an answer the client could not read.",
    );
}
