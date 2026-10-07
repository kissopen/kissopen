import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import css from "@eslint/css";
import { Linter } from "eslint";
import themePolicy from "../../../eslint/theme-policy.mjs";

const policyRules = {
    "kissopen-theme/no-direct-color": "error",
    "kissopen-theme/theme-color-variables-only": "error",
    "kissopen-theme/theme-color-variable-references-only": "error",
};

function lintCss(code, filename = "fixture.css") {
    const linter = new Linter({ configType: "flat" });
    return linter.verify(
        code,
        [
            {
                files: ["**/*.css"],
                language: "css/css",
                plugins: { css, "kissopen-theme": themePolicy },
                rules: policyRules,
            },
        ],
        { filename },
    );
}

test("accepts theme token references outside the theme", () => {
    assert.deepEqual(
        lintCss(".card { color: var(--text); box-shadow: 0 8px 16px var(--shadow-floating); }"),
        [],
    );
});

test("rejects direct colors outside the theme", () => {
    assert.deepEqual(
        lintCss(".card { color: #fff; background: rgb(1 2 3); }").map(({ ruleId }) => ruleId),
        ["kissopen-theme/no-direct-color", "kissopen-theme/no-direct-color"],
    );
});

test("rejects color custom properties outside the theme", () => {
    assert.deepEqual(
        lintCss(":root { --card-color: #fff; }").map(({ ruleId }) => ruleId),
        ["kissopen-theme/theme-color-variables-only"],
    );
});

test("rejects color references to custom properties missing from the theme", () => {
    assert.deepEqual(
        lintCss(".card { color: var(--not-a-theme-token); }").map(({ ruleId, messageId }) => [
            ruleId,
            messageId,
        ]),
        [["kissopen-theme/theme-color-variable-references-only", "missingThemeVariable"]],
    );
});

test("allows non-color component variables outside the theme", () => {
    assert.deepEqual(lintCss(".card { width: var(--component-width); }"), []);
});

test("allows literal colors in the central theme", () => {
    assert.deepEqual(
        lintCss(
            ":root { --card-color: #fff; } .card { color: #fff; }",
            fileURLToPath(new URL("../src/theme.css", import.meta.url)),
        ),
        [],
    );
});
