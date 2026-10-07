import type { UserError } from "../types.js";

/**
 * The one loading vocabulary for every product surface. Promoted out of the
 * chat module so the local (Kissopen Agent) stack speaks it too instead of carrying its
 * own `"loading" | "ready" | "error"` string plus loose `error` fields.
 */
export type Loadable<Value> =
    | { readonly type: "unloaded" }
    | { readonly type: "loading" }
    | { readonly type: "ready"; readonly value: Value }
    | { readonly type: "error"; readonly error: UserError };
