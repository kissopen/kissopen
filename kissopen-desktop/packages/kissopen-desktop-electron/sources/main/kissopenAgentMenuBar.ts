/*
Turning off the agent's own menu bar item, because KISSOPEN now has one.

The agent ships a menu bar app of its own — it is how somebody running the
agent without this application sees what it is doing. Beside KISSOPEN's item it
would be a second mark for one product, and the reader would have to learn
which of the two answers which question.

So the desktop writes the setting that turns it off, once, and only when the
file does not already answer it: `menu_bar = true` set by hand is a person
saying they want both, and this must not argue with them.

The line is inserted textually rather than by re-serialising the document. The
configuration is hand-edited and full of comments, and a round trip through a
parser would return it stripped of every one of them.
*/
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parse } from "smol-toml";

/**
 * Ensures the agent will not put its own item in the menu bar.
 *
 * Quiet about every failure. This is a tidiness the reader did not ask for,
 * and a desktop that refused to start because it could not write a preference
 * would be trading something that matters for something that does not.
 */
export async function kissopenAgentMenuBarDisable(): Promise<void> {
    // Only macOS has one to turn off; the agent builds nothing for the rest.
    if (process.platform !== "darwin") return;
    const home = process.env.KISSOPEN_HOME_DIR;
    if (!home) return;
    const directory = join(dirname(home), "KISSOPEN", "Config");
    const path = join(directory, "kissopen.toml");
    try {
        let original = "";
        try {
            original = await readFile(path, "utf8");
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") return;
        }
        const next = withMenuBarDisabled(original);
        if (next === undefined) return;
        parse(next); // Never leave the working configuration unparseable.
        await mkdir(directory, { recursive: true, mode: 0o700 });
        await writeFile(`${path}.KISSOPEN.tmp`, next, { mode: 0o600 });
        await rename(`${path}.KISSOPEN.tmp`, path);
    } catch {
        // A configuration this could not write is one the agent reads as it
        // was; the extra item in the bar is the whole of the cost.
    }
}

/**
 * The document with the setting in it, or nothing when it already answers.
 *
 * Exported for its own test: what makes this correct is where the line lands
 * in a file somebody else wrote, which is exactly what a test can hold still.
 */
export function withMenuBarDisabled(original: string): string | undefined {
    const settings = (parse(original) as { settings?: Record<string, unknown> }).settings;
    if (settings && "menu_bar" in settings) return undefined;
    const line = "# KISSOPEN shows this in its own menu bar item.\nmenu_bar = false";
    /*
     * Into the existing table when there is one, because a second `[settings]`
     * header is not a second table — it is a parse error. Directly under the
     * header, so it is not mistaken for belonging to whatever table follows.
     */
    const header = /^\[settings\][ \t]*(\r?\n)/mu.exec(original);
    if (header) {
        const at = header.index + header[0].length;
        return `${original.slice(0, at)}${line}\n${original.slice(at)}`;
    }
    const body = original.trimEnd();
    return body ? `${body}\n\n[settings]\n${line}\n` : `[settings]\n${line}\n`;
}
