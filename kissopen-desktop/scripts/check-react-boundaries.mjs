#!/usr/bin/env node
// Architecture check for React state boundaries in packages that are not linted
// by the `kissopen-react` ESLint plugin (currently kissopen-desktop-electron). It enforces the
// same two contracts the plugin enforces for kissopen-desktop-app and kissopen-desktop-ui:
//
//   * useLayoutEffect is banned as an imperative DOM boundary. A genuine
//     imperative measurement may keep one documented, local
//     `eslint-disable-next-line kissopen-react/no-layout-effect -- <concrete reason>`
//     on the line directly above the call.
//   * useEffect, useState, and useReducer are banned outright: the desktop shell
//     must be fully drivable from a kissopen-desktop-state snapshot and mockable like the
//     web app, so its product state and side effects live in kissopen-desktop-state, never
//     inside a React tree.
//
// The check reads source directly (no bundler, no ESLint) so it runs anywhere.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = [join(repoRoot, "packages", "kissopen-desktop-electron", "sources")];
const SOURCE = /\.(?:ts|tsx)$/u;
const SKIP = /\.test\.(?:ts|tsx)$/u;
const MINIMUM_REASON_LENGTH = 12;
const LAYOUT_EFFECT_RULE = "kissopen-react/no-layout-effect";

function sourceFiles(root) {
    const files = [];
    const walk = (dir) => {
        for (const entry of readdirSync(dir)) {
            if (entry === "node_modules" || entry === "dist") continue;
            const full = join(dir, entry);
            if (statSync(full).isDirectory()) walk(full);
            else if (SOURCE.test(entry) && !SKIP.test(entry)) files.push(full);
        }
    };
    try {
        walk(root);
    } catch {
        // A target directory may not exist in every checkout; nothing to scan.
    }
    return files;
}

/** A documented, local single-line escape hatch with a concrete reason. */
function documentedLayoutEffect(previousLine) {
    if (!previousLine) return false;
    if (!previousLine.includes(LAYOUT_EFFECT_RULE)) return false;
    if (!/\beslint-disable-(?:next-line|line)\b/u.test(previousLine)) return false;
    const separator = previousLine.indexOf("--");
    if (separator === -1) return false;
    return previousLine.slice(separator + 2).trim().length >= MINIMUM_REASON_LENGTH;
}

const problems = [];
for (const root of TARGETS) {
    for (const file of sourceFiles(root)) {
        const lines = readFileSync(file, "utf8").split("\n");
        const where = relative(repoRoot, file);
        lines.forEach((line, index) => {
            if (/\buseEffect\s*\(/u.test(line)) {
                problems.push(
                    `${where}:${index + 1}  useEffect runs side effects inside React. The desktop shell must be driven from kissopen-desktop-state; move the effect there.`,
                );
            }
            if (/\b(?:useState|useReducer)\s*\(/u.test(line)) {
                problems.push(
                    `${where}:${index + 1}  useState/useReducer keeps product state in React. Move it into kissopen-desktop-state.`,
                );
            }
            if (/\buseLayoutEffect\s*\(/u.test(line) && !documentedLayoutEffect(lines[index - 1])) {
                problems.push(
                    `${where}:${index + 1}  useLayoutEffect is an imperative DOM boundary and is banned. Drive the surface from kissopen-desktop-state, or add a documented local \`eslint-disable-next-line ${LAYOUT_EFFECT_RULE} -- <concrete reason>\`.`,
                );
            }
        });
    }
}

if (problems.length > 0) {
    console.error("React boundary check failed:\n");
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(`\n${problems.length} problem(s).`);
    process.exit(1);
}
console.log("React boundary check passed.");
