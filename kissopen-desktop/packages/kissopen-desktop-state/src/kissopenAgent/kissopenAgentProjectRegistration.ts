import { t } from "../i18n/locale.js";
import {
    ProjectRegistrationError,
    ProjectRegistrationProtocolError,
    type ProjectRegistrationErrorCode,
} from "../kissopenAgentConnection/index.js";
import { UserError } from "../types.js";

/**
 * Turns Kissopen Agent's refusal to register a folder into something the reader can act on.
 *
 * KISSOPEN Agent decides what may become a project and says why in a closed set of codes;
 * its own messages describe the rule it applied ("Choose the Git repository's
 * top-level folder."), which is already the right thing to say. What they do not
 * say is which folder was refused, and a picker dialog closes before the error
 * appears — so the chosen path is named here, in the one place that still knows
 * it.
 *
 * A code this build does not know is not swallowed: KISSOPEN Agent's own message is shown,
 * because a newer daemon explaining itself is better than "something went
 * wrong". A transport failure is reported as a transport failure, since retrying
 * it is a different act from choosing a different folder.
 */
export function kissopenAgentProjectAddError(error: unknown, path: string): UserError {
    const folder = folderNameOf(path);
    if (error instanceof ProjectRegistrationError) {
        return new UserError(
            registrationMessage(error.code, folder) ?? error.message,
            undefined,
            error,
        );
    }
    if (error instanceof ProjectRegistrationProtocolError) {
        return new UserError(
            error.code === "request_failed"
                ? t(
                      "“{folder}” could not be added: this machine’s KissOpen Agent did not answer. Try again.",
                      { folder },
                  )
                : t(
                      "“{folder}” could not be added: this machine’s KissOpen Agent gave an answer KissOpen could not read.",
                      { folder },
                  ),
            undefined,
            error,
        );
    }
    if (error instanceof UserError) return error;
    if (error instanceof Error) return new UserError(error.message, undefined, error);
    return new UserError(String(error), undefined, error);
}

/**
 * What each refusal means for the person who just chose a folder, said as the
 * thing to do about it. `undefined` for a code this build does not recognize,
 * which leaves KISSOPEN Agent's own wording in place.
 */
function registrationMessage(
    code: ProjectRegistrationErrorCode,
    folder: string,
): string | undefined {
    switch (code) {
        case "path_missing":
            return t("“{folder}” no longer exists.", { folder });
        case "not_directory":
            return t("“{folder}” is a file, not a folder.", { folder });
        case "path_inaccessible":
            return t("“{folder}” cannot be read. Check its permissions and try again.", { folder });
        case "not_git_repository":
            return t("“{folder}” is not a Git repository. Add a folder with a repository in it.", {
                folder,
            });
        case "not_git_top_level":
            return t(
                "“{folder}” is inside a Git repository. Choose the repository’s top-level folder instead.",
                { folder },
            );
        case "managed_workspace_unavailable":
            return t("“{folder}” is a managed workspace that is not ready yet.", { folder });
        // `invalid_request` and `project_id_conflict` are KISSOPEN asking wrongly
        // rather than the reader choosing wrongly, and KISSOPEN Agent names the exact rule
        // it applied. There is nothing more useful to say about them here.
        default:
            return undefined;
    }
}

/** The last segment of a path, which is what the reader picked in the dialog. */
function folderNameOf(path: string): string {
    const trimmed = path.replace(/[/\\]+$/u, "");
    const separator = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
    const name = separator < 0 ? trimmed : trimmed.slice(separator + 1);
    return name.length > 0 ? name : path;
}
