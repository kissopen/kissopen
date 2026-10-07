/*
Opening a file that is on another machine.

A conversation running somewhere else writes about its own folder: "the deck is
in outputs/". On this desk that sentence names nothing, so the link stood there
as plain text and the reader was told to go and find the file by hand — on a
machine they were not sitting at.

What happens instead is the phone's answer, which already works: the bytes come
over the relay, land in a copy under the file's own name, and go to whatever
this machine opens that kind of file with. Nothing is written into the reader's
documents and nothing is left behind anywhere they would have to clean up.

Only files worth opening are opened. The list is of things that are read, not
run: an agent can write a link to `install.command` as easily as to `deck.pptx`,
and a window that handed the first to the system would be running a script
because a sentence in a chat asked it to.
*/
import { t } from "kissopen-desktop-state/i18n";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

/**
 * What this window will hand to another application: documents, plain text and
 * pictures. Everything else — archives, binaries, scripts, anything the system
 * would execute — is refused with a sentence rather than opened.
 */
const OPENABLE: ReadonlySet<string> = new Set([
    // Documents, the reason this exists.
    ".doc",
    ".docx",
    ".epub",
    ".key",
    ".numbers",
    ".odp",
    ".ods",
    ".odt",
    ".pages",
    ".pdf",
    ".pot",
    ".potx",
    ".pps",
    ".ppsx",
    ".ppt",
    ".pptx",
    ".rtf",
    ".xls",
    ".xlsm",
    ".xlsx",
    // Text, which the machine opens in an editor.
    ".csv",
    ".json",
    ".log",
    ".md",
    ".tsv",
    ".txt",
    ".xml",
    ".yaml",
    ".yml",
    // Pictures.
    ".bmp",
    ".gif",
    ".heic",
    ".jpeg",
    ".jpg",
    ".png",
    ".tiff",
    ".webp",
]);

/**
 * Brings one file here and opens it.
 *
 * Given the two things it cannot do itself: reading from the machine that has
 * the file, and this machine's own opener. Both are passed in so the rule about
 * what may be opened is decided in one place and can be exercised without a
 * relay or a desktop.
 */
export async function relayFileOpenWith(
    path: string,
    read: (path: string) => Promise<Uint8Array>,
    /** Electron's `shell.openPath`, which answers "" when it worked. */
    open: (path: string) => Promise<string>,
): Promise<void> {
    const name = basename(
        path
            .replace(/[\\/]+$/, "")
            .split(/[\\/]/)
            .pop() ?? path,
    );
    if (!name || name === "." || name === "..") throw new Error(t("这个链接没有指向一个文件"));
    if (!OPENABLE.has(extname(name).toLowerCase())) throw new Error(t("这种文件不能交给其它应用打开"));
    const bytes = await read(path);
    /*
     * A folder of its own for every open. The receiving application shows the
     * file's own name, and two files called `report.pdf` from two machines are
     * two files rather than one overwriting the other while it is being read.
     */
    const directory = join(tmpdir(), "kissopen-remote-files", randomUUID());
    await mkdir(directory, { recursive: true });
    const copy = join(directory, name);
    await writeFile(copy, bytes);
    const failure = await open(copy);
    if (failure) throw new Error(failure);
}
