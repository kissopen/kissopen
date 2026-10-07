const LAYOUT_EFFECT_RULE = "kissopen-react/no-layout-effect";
const LOCAL_STATE_RULE = "kissopen-react/no-local-state";
const MINIMUM_REASON_LENGTH = 12;

/**
 * `useLayoutEffect` is a synchronous, imperative browser boundary: it cannot run
 * without a live DOM, so a surface that leans on it is neither fully drivable from
 * a `kissopen-desktop-state` snapshot nor mockable the way the web app is. The default is to
 * express the behavior declaratively (render-time derivation, an event handler, a
 * ref callback, or a `kissopen-desktop-state` action). A genuine imperative measurement in a
 * reusable `kissopen-desktop-ui` primitive may keep it behind one documented, local
 * `eslint-disable-next-line kissopen-react/no-layout-effect -- <concrete reason>`.
 */
const noLayoutEffect = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Ban useLayoutEffect; it is an imperative DOM boundary that makes a surface un-mockable.",
        },
        messages: {
            banned: "useLayoutEffect is an imperative DOM boundary and is banned. Drive the surface from kissopen-desktop-state (render derivation, event handler, or ref callback). A true imperative measurement in a kissopen-desktop-ui primitive may keep one `eslint-disable-next-line kissopen-react/no-layout-effect -- <concrete reason>`.",
        },
        schema: [],
    },
    create(context) {
        function reportIdentifier(node) {
            if (node?.type === "Identifier" && node.name === "useLayoutEffect") {
                context.report({ node, messageId: "banned" });
            }
        }
        return {
            // Bare `useLayoutEffect(...)` calls — the actual imperative boundary,
            // so an escape hatch is a single documented disable on the call.
            "CallExpression > Identifier.callee"(node) {
                reportIdentifier(node);
            },
            // Namespaced `React.useLayoutEffect(...)` calls.
            "CallExpression > MemberExpression.callee > Identifier.property"(node) {
                reportIdentifier(node);
            },
        };
    },
};

/**
 * `useState`, `useReducer`, and `useEffect` keep authoritative product state and
 * side effects inside a React tree, which the desktop application is forbidden
 * from doing: all of its state and effects live in `kissopen-desktop-state` so the shell can
 * be mocked and driven exactly like the web app. This rule is applied only to
 * application packages; reusable `kissopen-desktop-ui` primitives may still own narrowly
 * scoped local UI state (but never `useEffect`, banned for them elsewhere).
 */
const noLocalState = {
    meta: {
        type: "problem",
        docs: {
            description: "Ban React-local product state and effects in the application layer.",
        },
        messages: {
            banned: "{{hook}} keeps product state or side effects inside React. The desktop/app layer must be fully drivable from a kissopen-desktop-state snapshot; move this into kissopen-desktop-state.",
        },
        schema: [],
    },
    create(context) {
        const banned = new Set(["useState", "useReducer", "useEffect"]);
        function reportIdentifier(node) {
            if (node?.type === "Identifier" && banned.has(node.name)) {
                context.report({ node, messageId: "banned", data: { hook: node.name } });
            }
        }
        return {
            "CallExpression > Identifier.callee"(node) {
                reportIdentifier(node);
            },
            "CallExpression > MemberExpression.callee > Identifier.property"(node) {
                reportIdentifier(node);
            },
        };
    },
};

function ruleDisable(comment, ruleName) {
    if (!comment.value.includes(ruleName)) return undefined;
    const directive = /\beslint-disable(?<scope>-next-line|-line)?\b/u.exec(comment.value);
    if (!directive) return undefined;
    const separator = comment.value.indexOf("--");
    return {
        local: Boolean(directive.groups?.scope),
        reason: separator === -1 ? "" : comment.value.slice(separator + 2).trim(),
    };
}

/**
 * Any suppression of the `useLayoutEffect` ban must be one local
 * `eslint-disable-next-line`/`eslint-disable-line` carrying a concrete reason
 * after `--`. Block and file-wide disables are forbidden so an escape hatch stays
 * a deliberate, reviewed, single-site exception. The `useState`/`useReducer` ban
 * cannot be disabled at all in the application layer.
 */
const requireReactExceptionReason = {
    meta: {
        type: "problem",
        docs: {
            description: "Require every useLayoutEffect suppression to justify itself locally.",
        },
        messages: {
            forbiddenLocalStateException:
                "The local-state ban cannot be disabled in the application layer. Move the state into kissopen-desktop-state.",
            missingReason:
                "A useLayoutEffect exception must include a concrete reason after `--` (at least {{minimum}} characters).",
            nonLocalException:
                "A useLayoutEffect exception must target one call with `eslint-disable-next-line` or `eslint-disable-line`; block and file disables are forbidden.",
        },
        schema: [],
    },
    create(context) {
        const { sourceCode } = context;
        let checked = false;
        function check() {
            if (checked) return;
            checked = true;
            const comments = sourceCode.comments ?? sourceCode.getAllComments?.() ?? [];
            for (const comment of comments) {
                if (ruleDisable(comment, LOCAL_STATE_RULE)) {
                    context.report({ loc: comment.loc, messageId: "forbiddenLocalStateException" });
                }
                const disable = ruleDisable(comment, LAYOUT_EFFECT_RULE);
                if (!disable) continue;
                if (!disable.local) {
                    context.report({ loc: comment.loc, messageId: "nonLocalException" });
                } else if (disable.reason.length < MINIMUM_REASON_LENGTH) {
                    context.report({
                        loc: comment.loc,
                        messageId: "missingReason",
                        data: { minimum: MINIMUM_REASON_LENGTH },
                    });
                }
            }
        }
        return { Program: check };
    },
};

export default {
    meta: { name: "eslint-plugin-kissopen-react", version: "0.1.0" },
    rules: {
        "no-layout-effect": noLayoutEffect,
        "no-local-state": noLocalState,
        "require-react-exception-reason": requireReactExceptionReason,
    },
};
