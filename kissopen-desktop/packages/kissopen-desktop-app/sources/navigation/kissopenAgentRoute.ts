import type { KissopenAgentFileTabKind } from "kissopen-desktop-state";

/**
 * Every place this window can be, as a value. Paths and stored records are only
 * how a place is rendered for the router and written down; both parse back into
 * this union, which is where a place is defined.
 *
 * That is what lets a place be reasoned about instead of pattern-matched: asking
 * whether an address is inside a group compares two fields, rather than re-running
 * a path through the router's matcher and hoping it decodes the same way.
 *
 * A place is its identifiers and nothing else — no query, no fragment. Anything a
 * route must carry becomes a field here.
 */
export type KissopenAgentRoute =
    | { readonly kind: "blueprint" }
    | {
          readonly kind: "chat";
          readonly kissopenAgentId: string;
          readonly groupId: string;
          readonly chatId: string;
      }
    | { readonly kind: "chats" }
    /**
     * Where a session is started. The machine is in the address because the
     * projects it can run in are that machine's, so the window's back and
     * forward move between machines' Create surfaces rather than between two
     * views of one ambiguous form.
     */
    | { readonly kind: "create"; readonly kissopenAgentId: string }
    | {
          readonly kind: "file";
          readonly kissopenAgentId: string;
          readonly groupId: string;
          /** The session visible behind the file, absent in an empty workspace. */
          readonly chatId?: string;
          readonly fileKind: KissopenAgentFileTabKind;
          readonly path: string;
      }
    | { readonly kind: "group"; readonly kissopenAgentId: string; readonly groupId: string }
    | { readonly kind: "home" }
    | { readonly kind: "inbox"; readonly kissopenAgentId: string }
    | { readonly kind: "kissopenAgent"; readonly kissopenAgentId: string }
    | { readonly kind: "settings" }
    | { readonly kind: "settingsSection"; readonly section: string };

/** The place a window opens on before it has been anywhere. */
export const KISSOPEN_AGENT_ROUTE_HOME: KissopenAgentRoute = { kind: "home" };

/**
 * The path the router addresses this place by. Identifiers are encoded because
 * they are values, not path syntax: one containing a slash names one thing, and
 * must not read as two segments.
 */
export function kissopenAgentRoutePath(route: KissopenAgentRoute): string {
    const part = encodeURIComponent;
    switch (route.kind) {
        case "blueprint":
            return "/blueprint";
        case "chat":
            return `/chats/${part(route.kissopenAgentId)}/${part(route.groupId)}/${part(route.chatId)}`;
        case "chats":
            return "/chats";
        case "create":
            return `/create/${part(route.kissopenAgentId)}`;
        case "file": {
            const parent = route.chatId ? `/${part(route.chatId)}` : "";
            return `/chats/${part(route.kissopenAgentId)}/${part(route.groupId)}${parent}/file/${part(route.fileKind)}/${part(route.path)}`;
        }
        case "group":
            return `/chats/${part(route.kissopenAgentId)}/${part(route.groupId)}`;
        case "home":
            return "/";
        case "inbox":
            return `/inbox/${part(route.kissopenAgentId)}`;
        case "kissopenAgent":
            return `/chats/${part(route.kissopenAgentId)}`;
        case "settings":
            return "/settings";
        case "settingsSection":
            return `/settings/${part(route.section)}`;
    }
}

/** The segments of a path, decoded, with any query or fragment dropped. */
function segmentsOf(pathname: string): string[] | undefined {
    const cut = pathname.search(/[?#]/);
    const path = cut === -1 ? pathname : pathname.slice(0, cut);
    if (!path.startsWith("/")) return undefined;
    const parts = path.slice(1).split("/").filter(Boolean);
    try {
        return parts.map(decodeURIComponent);
    } catch {
        // A path holding a broken escape names nothing this router can address.
        return undefined;
    }
}

/** A file presentation written into an address, or nothing for an unknown value. */
function fileKindOf(value: string | undefined): KissopenAgentFileTabKind | undefined {
    return value === "file" || value === "diff" || value === "media" || value === "document"
        ? value
        : undefined;
}

/**
 * The place a path addresses, or nothing. This is where an address stops being
 * text and becomes one of the places above; a path matching no route is refused
 * here rather than carried around as a string that might be one.
 */
export function kissopenAgentRoutePathParse(pathname: string): KissopenAgentRoute | undefined {
    const segments = segmentsOf(pathname);
    if (segments === undefined) return undefined;
    const [head, first, second, third, fourth, fifth, sixth] = segments;
    if (head === undefined) return KISSOPEN_AGENT_ROUTE_HOME;
    switch (head) {
        case "blueprint":
            return segments.length === 1 ? { kind: "blueprint" } : undefined;
        case "chats":
            if (first === undefined) return { kind: "chats" };
            if (second === undefined) return { kind: "kissopenAgent", kissopenAgentId: first };
            if (third === undefined)
                return { kind: "group", groupId: second, kissopenAgentId: first };
            if (third === "file" && segments.length === 6) {
                const fileKind = fileKindOf(fourth);
                return fileKind && fifth
                    ? {
                          fileKind,
                          groupId: second,
                          kind: "file",
                          kissopenAgentId: first,
                          path: fifth,
                      }
                    : undefined;
            }
            if (fourth === undefined)
                return { chatId: third, groupId: second, kind: "chat", kissopenAgentId: first };
            if (fourth === "file" && segments.length === 7) {
                const fileKind = fileKindOf(fifth);
                return fileKind && sixth
                    ? {
                          chatId: third,
                          fileKind,
                          groupId: second,
                          kind: "file",
                          kissopenAgentId: first,
                          path: sixth,
                      }
                    : undefined;
            }
            return undefined;
        case "create":
            return first !== undefined && segments.length === 2
                ? { kind: "create", kissopenAgentId: first }
                : undefined;
        case "inbox":
            return first !== undefined && segments.length === 2
                ? { kind: "inbox", kissopenAgentId: first }
                : undefined;
        case "settings":
            if (first === undefined) return { kind: "settings" };
            return segments.length === 2 ? { kind: "settingsSection", section: first } : undefined;
        default:
            return undefined;
    }
}

/** A required string field of a stored record, absent when it is not one. */
function fieldOf(record: Record<string, unknown>, name: string): string | undefined {
    const value = record[name];
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * The place a stored record describes, or nothing. Storage holds what an older
 * build wrote, or what somebody edited by hand, so it is parsed rather than
 * asserted: a record naming a place this build lacks is no longer a place.
 */
export function kissopenAgentRouteParse(value: unknown): KissopenAgentRoute | undefined {
    if (typeof value !== "object" || value === null) return undefined;
    const record = value as Record<string, unknown>;
    switch (record["kind"]) {
        case "blueprint":
            return { kind: "blueprint" };
        case "chat": {
            const kissopenAgentId = fieldOf(record, "kissopenAgentId");
            const groupId = fieldOf(record, "groupId");
            const chatId = fieldOf(record, "chatId");
            return kissopenAgentId && groupId && chatId
                ? { chatId, groupId, kind: "chat", kissopenAgentId }
                : undefined;
        }
        case "chats":
            return { kind: "chats" };
        case "create": {
            const kissopenAgentId = fieldOf(record, "kissopenAgentId");
            return kissopenAgentId ? { kind: "create", kissopenAgentId } : undefined;
        }
        case "file": {
            const kissopenAgentId = fieldOf(record, "kissopenAgentId");
            const groupId = fieldOf(record, "groupId");
            const chatId = fieldOf(record, "chatId");
            const fileKind = fileKindOf(fieldOf(record, "fileKind"));
            const path = fieldOf(record, "path");
            return kissopenAgentId && groupId && fileKind && path
                ? {
                      ...(chatId ? { chatId } : {}),
                      fileKind,
                      groupId,
                      kind: "file",
                      kissopenAgentId,
                      path,
                  }
                : undefined;
        }
        case "group": {
            const kissopenAgentId = fieldOf(record, "kissopenAgentId");
            const groupId = fieldOf(record, "groupId");
            return kissopenAgentId && groupId
                ? { groupId, kind: "group", kissopenAgentId }
                : undefined;
        }
        case "home":
            return KISSOPEN_AGENT_ROUTE_HOME;
        case "inbox": {
            const kissopenAgentId = fieldOf(record, "kissopenAgentId");
            return kissopenAgentId ? { kind: "inbox", kissopenAgentId } : undefined;
        }
        case "kissopenAgent": {
            const kissopenAgentId = fieldOf(record, "kissopenAgentId");
            return kissopenAgentId ? { kind: "kissopenAgent", kissopenAgentId } : undefined;
        }
        case "settings":
            return { kind: "settings" };
        case "settingsSection": {
            const section = fieldOf(record, "section");
            return section ? { kind: "settingsSection", section } : undefined;
        }
        default:
            return undefined;
    }
}

/** Whether two places are the same place. */
export function kissopenAgentRouteSame(
    one: KissopenAgentRoute,
    other: KissopenAgentRoute,
): boolean {
    // A file tab is one destination per checkout and path. Its presentation and
    // the session visible behind it may change on a revisit; keeping either in
    // identity would leave duplicate Back entries for the same tab.
    if (one.kind === "file" && other.kind === "file")
        return (
            one.kissopenAgentId === other.kissopenAgentId &&
            one.groupId === other.groupId &&
            one.path === other.path
        );
    return kissopenAgentRoutePath(one) === kissopenAgentRoutePath(other);
}

/**
 * Whether a place sits inside one machine's group — the group itself, a
 * conversation, or a file in it. Everything else exists in its own right and
 * outlives the group going away.
 */
export function kissopenAgentRouteInGroup(
    route: KissopenAgentRoute,
    kissopenAgentId: string,
    groupId: string,
): boolean {
    return (
        (route.kind === "group" || route.kind === "chat" || route.kind === "file") &&
        route.kissopenAgentId === kissopenAgentId &&
        route.groupId === groupId
    );
}
