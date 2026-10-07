import { realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";

/**
 * Documents the desktop hands to the reader's own applications. The preview has
 * no viewer for them — a Word or PowerPoint file is a zip archive, and read as
 * text it is a wall of mojibake — so they open in whatever this machine uses
 * for them. Only formats that are documents are listed: anything the system
 * would run rather than show (an .exe, a script, a shortcut) is refused, so a
 * link an agent wrote can never start a program.
 */
const DOCUMENT_EXTENSIONS: ReadonlySet<string> = new Set([
    ".doc",
    ".docx",
    ".dot",
    ".dotx",
    ".epub",
    ".key",
    ".numbers",
    ".odg",
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
    ".vsd",
    ".vsdx",
    ".xls",
    ".xlsb",
    ".xlsm",
    ".xlsx",
    ".xlt",
    ".xltx",
]);

/**
 * Opens one document inside a workspace in the application this machine uses
 * for its type. The path is resolved against the workspace root and must still
 * be inside it after symbolic links are followed.
 */
export async function fileOpenDefault(
    root: string,
    path: string,
    /** The system's own opener (Electron's `shell.openPath`), answering "" on success. */
    open: (path: string) => Promise<string>,
): Promise<void> {
    if (!DOCUMENT_EXTENSIONS.has(extname(path).toLowerCase()))
        throw new Error("Only documents can be opened in another application.");
    const base = await realpath(root);
    const target = await realpath(resolve(base, path));
    const inside = relative(base, target);
    if (inside === "" || inside.startsWith("..") || isAbsolute(inside))
        throw new Error("The file is not inside this workspace.");
    // A link named like a document may point at something that is not one.
    if (!DOCUMENT_EXTENSIONS.has(extname(target).toLowerCase()))
        throw new Error("Only documents can be opened in another application.");
    if (!(await stat(target)).isFile()) throw new Error("The path is not a file.");
    const failure = await open(target);
    if (failure) throw new Error(failure);
}
