/*
Which business-API routes this window may reach at all.

The bridge can call only the consumer API. It cannot choose a host, redirect to
a third party, read arbitrary files, or return a bearer credential to JS — and
this list is the part of that promise a reader can check: a path the window
asks for that is not named here is refused before the credential is loaded.

Kept apart from the bridge so it can be tested without Electron. A boundary
nothing exercises is a boundary that quietly widens.

The consumer chat is gone from the window, so its routes are gone from here.
Leaving them reachable would leave a second chat in the product: the account's
conversations still listable, still sendable to, by a renderer that no longer
draws any of it. What remains is the account itself, its plan and usage, its
profile, its files, its scheduled tasks, and its cloud workspace's plugins.
*/

/*
An identifier this bridge will interpolate into a path, and nothing else.

Deliberately narrower than what the server accepts. The character that must
never get through is a separator: a `/`, a `.` or an escape would let a caller
reach a route this list does not name, and naming the routes is the whole job.
*/
const id = "[A-Za-z0-9_-]{1,64}";

const GET = [
    "/auth/community/session",
    "/config",
    "/me",
    "/models",
    "/billing",
    // Buying a plan: how it can be paid, and whether an order has been.
    "/billing/pay-methods",
    `/billing/orders/${id}`,
    // What the operator wants everyone to know now.
    "/announcements",
    "/profile",
    "/security",
    // 分享赚点数: the account's invite link, rule, earnings and invitees.
    "/invite",
    // 主题: the theme page, and one theme.
    "/themes",
    "/themes/generation",
    `/themes/${id}`,
    "/files",
    // Scheduled tasks: every plan, one plan, and what it has done.
    "/schedules",
    `/schedules/${id}`,
    `/schedules/${id}/runs`,
    // What this account asked to be told about a finished task.
    "/notifications",
    // The cloud workspace's plugins, and what it could install.
    "/cloud/plugins",
    "/cloud/catalog",
    `/cloud/catalog/${id}`,
];

const POST = [
    "/security/(?:verify|username|password|totp/(?:begin|confirm|disable)|recovery|oauth/(?:start|complete|unlink))",
    "/auth/(?:community|logout)",
    // Placing the order for a plan; the answer is what to scan or open.
    "/billing/checkout",
    // Reading this account's billing history; filters and pagination are in the body.
    "/billing/history",
    // Typing the invite code of the friend who invited this account.
    "/invite/bind",
    // 主题: making, changing, publishing and deleting one of the account's
    // own, choosing one, asking a model for one, a background picture, and
    // the gallery (a POST, because its search is not a path).
    "/themes",
    "/themes/gallery",
    `/themes/${id}`,
    `/themes/${id}/(?:publish|unpublish|delete)`,
    "/themes/select",
    "/themes/generate",
    "/themes/images",
    "/files",
    // An office document and a picture into the library, each by its own road.
    "/files/document",
    "/images",
    // A recording, for its words.
    "/transcriptions",
    // A document no viewer in the window reads, for the PDF the server makes of it.
    "/documents/pdf",
    "/profile",
    "/profile/avatar",
    // What the person said about their work; no generated home dashboard.
    "/persona",
    // Creating a plan, reading a sentence as one, changing or deleting one,
    // and asking a run to stop.
    "/schedules",
    "/schedules/draft",
    `/schedules/${id}`,
    `/schedules/${id}/run`,
    `/schedules/${id}/runs/${id}/cancel`,
    // Marking one result as looked at, and choosing what to be told about.
    `/schedules/${id}/runs/${id}/read`,
    "/notifications",
    // Enabling, removing and applying plugins, and installing one from the
    // catalog. `apply` is an id like any other here; the workspace on the
    // other end is what knows it means something.
    "/cloud/plugins",
    `/cloud/plugins/${id}`,
    // Connecting an account to one of a plugin's servers, and forgetting it.
    `/cloud/plugins/${id}/connections/${id}`,
    `/cloud/plugins/${id}/connections/${id}/disconnect`,
    `/cloud/catalog/${id}`,
];

const routes: Record<"GET" | "POST", RegExp> = {
    GET: new RegExp(`^(?:${GET.join("|")})$`, "u"),
    POST: new RegExp(`^(?:${POST.join("|")})$`, "u"),
};

/** Whether the window may ask for this path at all. */
export function kissopenRouteAllowed(method: string, path: string): boolean {
    if (method !== "GET" && method !== "POST") return false;
    return routes[method].test(path);
}
