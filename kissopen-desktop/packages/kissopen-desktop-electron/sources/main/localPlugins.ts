import { createHash, randomUUID } from "node:crypto";
import { crc32, inflateRawSync } from "node:zlib";
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parse, stringify, type TomlTable } from "smol-toml";
import type { CloudPlugin, CloudPluginsList } from "kissopen-desktop-state";

const NAME = /^[a-z][a-z0-9-]{0,63}$/u;
const LIMIT = 8 * 1024 * 1024;

/** A ZIP is data, never an installer. Reject links, traversal and unbounded expansion. */
export function localPluginArchiveRead(bytes: Buffer): ReadonlyMap<string, Buffer> {
    if (!bytes.length || bytes.length > LIMIT)
        throw new Error("Plugin ZIPs must be smaller than 8 MB.");
    let end = -1;
    for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65557); at--) {
        if (
            bytes.readUInt32LE(at) === 0x06054b50 &&
            at + 22 + bytes.readUInt16LE(at + 20) === bytes.length
        ) {
            end = at;
            break;
        }
    }
    if (end < 0 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6))
        throw new Error("Use a standard, single-file ZIP archive.");
    const count = bytes.readUInt16LE(end + 10);
    const offset = bytes.readUInt32LE(end + 16);
    const size = bytes.readUInt32LE(end + 12);
    if (!count || count > 2048 || offset + size !== end || count !== bytes.readUInt16LE(end + 8))
        throw new Error("The plugin archive is malformed or too large.");
    const files = new Map<string, Buffer>();
    const names = new Set<string>();
    let at = offset;
    let expanded = 0;
    for (let i = 0; i < count; i++) {
        if (at + 46 > end || bytes.readUInt32LE(at) !== 0x02014b50)
            throw new Error("The ZIP directory is invalid.");
        const flags = bytes.readUInt16LE(at + 8);
        const method = bytes.readUInt16LE(at + 10);
        const compressed = bytes.readUInt32LE(at + 20);
        const length = bytes.readUInt32LE(at + 24);
        const nameLength = bytes.readUInt16LE(at + 28);
        const next =
            at + 46 + nameLength + bytes.readUInt16LE(at + 30) + bytes.readUInt16LE(at + 32);
        if (next > end || flags & 1 || ![0, 8].includes(method) || length > 2 * 1024 * 1024)
            throw new Error("Encrypted, oversized or unsupported ZIP entries are not allowed.");
        const name = bytes.subarray(at + 46, at + 46 + nameLength).toString("utf8");
        const path = name.replace(/\/$/u, "");
        if (
            !path ||
            path.length > 512 ||
            /[\\\x00-\x1f:]/u.test(path) ||
            path.split("/").some((part) => !part || part === "." || part === "..")
        )
            throw new Error("The plugin contains an unsafe file path.");
        const canonical = path.normalize("NFC").toLowerCase();
        if (names.has(canonical)) throw new Error("The plugin contains duplicate file paths.");
        names.add(canonical);
        const mode = bytes.readUInt32LE(at + 38) >>> 16;
        const kind = mode & 0xf000;
        if (kind && kind !== 0x8000 && kind !== 0x4000)
            throw new Error("Links and special files are not allowed in plugins.");
        const local = bytes.readUInt32LE(at + 42);
        if (local + 30 > offset || bytes.readUInt32LE(local) !== 0x04034b50)
            throw new Error("The ZIP entry is invalid.");
        const localNameLength = bytes.readUInt16LE(local + 26);
        const start = local + 30 + localNameLength + bytes.readUInt16LE(local + 28);
        if (
            start + compressed > offset ||
            bytes.subarray(local + 30, local + 30 + localNameLength).toString("utf8") !== name ||
            bytes.readUInt16LE(local + 8) !== method ||
            bytes.readUInt16LE(local + 6) !== flags
        )
            throw new Error("The ZIP entry does not match its directory.");
        if (!name.endsWith("/")) {
            const data =
                method === 0
                    ? bytes.subarray(start, start + compressed)
                    : inflateRawSync(bytes.subarray(start, start + compressed), {
                          maxOutputLength: 2 * 1024 * 1024,
                      });
            expanded += data.length;
            if (
                data.length !== length ||
                crc32(data) !== bytes.readUInt32LE(at + 16) ||
                expanded > LIMIT
            )
                throw new Error("The plugin failed its integrity or size check.");
            files.set(path, data);
        }
        at = next;
    }
    if (at !== end) throw new Error("The ZIP directory is incomplete.");
    return files;
}

function object(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
function strings(value: unknown): value is Record<string, string> {
    return object(value) && Object.values(value).every((item) => typeof item === "string");
}
function document(files: ReadonlyMap<string, Buffer>, path: string): Record<string, unknown> {
    const data = files.get(path);
    if (!data)
        throw new Error(
            "The ZIP must contain plugin.json or .codex-plugin/plugin.json at its root.",
        );
    const value: unknown = JSON.parse(data.toString("utf8"));
    if (!object(value)) throw new Error("The plugin manifest must be a JSON object.");
    return value;
}
function manifest(files: ReadonlyMap<string, Buffer>, digest: string): CloudPlugin {
    const format = files.has("plugin.json") ? "agent-plugins" : "codex";
    const doc = document(files, format === "codex" ? ".codex-plugin/plugin.json" : "plugin.json");
    if (
        typeof doc.name !== "string" ||
        !NAME.test(doc.name) ||
        ["apply", "import"].includes(doc.name) ||
        typeof doc.version !== "string" ||
        doc.version.length > 100 ||
        typeof doc.description !== "string" ||
        doc.description.length > 4000
    )
        throw new Error("The plugin needs a valid name, version and description.");
    if (
        format === "agent-plugins" &&
        doc.$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
    )
        throw new Error("Use Agent Plugins schema version 1.0.0.");
    const skillRoot =
        typeof doc.skills === "string"
            ? doc.skills.replace(/^\.\//u, "").replace(/\/$/u, "")
            : "skills";
    if (
        (doc.skills !== undefined && typeof doc.skills !== "string") ||
        !skillRoot ||
        skillRoot.split("/").some((part) => !NAME.test(part))
    )
        throw new Error("The plugin skills directory is invalid.");
    const unsupported = ["hooks", "agents", "commands", "apps", "extensions"].filter(
        (key) =>
            doc[key] !== undefined || [...files.keys()].some((path) => path.startsWith(`${key}/`)),
    );
    const mcp = servers(files, format, "", unsupported);
    return {
        id: doc.name,
        name: doc.name,
        description: doc.description,
        version: doc.version,
        digest,
        enabled: false,
        active: false,
        removed: false,
        skills: [...files.keys()].filter(
            (path) => path.startsWith(skillRoot + "/") && path.endsWith("/SKILL.md"),
        ).length,
        skill_root: skillRoot,
        servers: Object.keys(mcp).length,
        unsupported,
        format,
        connections: [],
    };
}
function servers(
    files: ReadonlyMap<string, Buffer>,
    format: string,
    root: string,
    unsupported: string[],
): TomlTable {
    const path = format === "codex" ? ".mcp.json" : "mcp.json";
    if (!files.has(path)) return {};
    const doc = document(files, path);
    if (
        !object(doc.mcpServers) ||
        Object.keys(doc.mcpServers).length > 16 ||
        (format === "agent-plugins" &&
            doc.$schema !== "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json")
    )
        throw new Error("The MCP manifest is invalid.");
    const result: TomlTable = {};
    for (const [name, value] of Object.entries(doc.mcpServers)) {
        if (!NAME.test(name) || !object(value))
            throw new Error("The MCP server name or configuration is invalid.");
        if (
            Object.keys(value).some(
                (key) =>
                    ![
                        "type",
                        "command",
                        "args",
                        "cwd",
                        "url",
                        "headers",
                        "env",
                        "oauth_resource",
                    ].includes(key),
            ) ||
            JSON.stringify(value).includes("${") ||
            value.oauth_resource
        ) {
            unsupported.push(
                `MCP ${name}: connect or configure this server in the Agent's own MCP settings`,
            );
            continue;
        }
        if (
            (value.env !== undefined && !strings(value.env)) ||
            (value.headers !== undefined && !strings(value.headers))
        )
            throw new Error("MCP environment and headers must contain text values.");
        const config: TomlTable = { enabled: true };
        if (
            typeof value.command === "string" &&
            value.command &&
            !value.url &&
            [undefined, "stdio"].includes(value.type as string | undefined)
        ) {
            if (
                value.args !== undefined &&
                (!Array.isArray(value.args) || !value.args.every((arg) => typeof arg === "string"))
            )
                throw new Error("MCP command arguments must be text.");
            const cwd = typeof value.cwd === "string" ? value.cwd.replace(/^\.\//u, "") : ".";
            if (cwd !== "." && (!cwd || cwd.split("/").some((part) => !NAME.test(part))))
                throw new Error("MCP working directories must stay inside the plugin.");
            config.command = value.command;
            config.args = (value.args ?? []) as string[];
            config.cwd = join(root, cwd);
            if (value.env) config.env = value.env as Record<string, string>;
        } else if (
            typeof value.url === "string" &&
            !value.command &&
            [undefined, "http", "streamable-http"].includes(value.type as string | undefined)
        ) {
            const url = new URL(value.url);
            if (url.protocol !== "https:" || url.username || url.password)
                throw new Error("MCP URLs must use HTTPS without embedded credentials.");
            config.url = url.href;
            config.transport = "http";
            if (value.headers) config.http_headers = value.headers as Record<string, string>;
        } else {
            unsupported.push(`MCP ${name}: unsupported transport`);
            continue;
        }
        result[name] = config;
    }
    return result;
}

export class LocalPlugins {
    readonly accountKey: string;
    readonly root: string;
    private queue: Promise<unknown> = Promise.resolve();
    private applying = false;
    private error = "";
    constructor(
        readonly paths: { data: string; skills: string; mcp: string },
        readonly accountId: string,
        recoveredKey?: string,
    ) {
        this.accountKey =
            recoveredKey ?? createHash("sha256").update(accountId).digest("hex").slice(0, 24);
        if (!/^[a-f0-9]{24}$/u.test(this.accountKey))
            throw new Error("The plugin account identity is invalid.");
        this.root = join(paths.data, this.accountKey);
    }
    /** Recover after an app crash without exposing another account's managed skills. */
    async deactivateOtherAccounts(): Promise<boolean> {
        let wasActive = false;
        const entries = await readdir(this.paths.data, { withFileTypes: true }).catch(
            (error: NodeJS.ErrnoException) => {
                if (error.code === "ENOENT") return [];
                throw error;
            },
        );
        for (const entry of entries) {
            if (entry.name === this.accountKey || !/^[a-f0-9]{24}$/u.test(entry.name)) continue;
            if (!entry.isDirectory() || entry.isSymbolicLink())
                throw new Error(
                    "The managed plugin account folder is invalid; it was left unchanged.",
                );
            const other = new LocalPlugins(this.paths, "", entry.name);
            wasActive ||= (await other.list()).plugins.some((row) => row.active);
            await other.deactivate();
        }
        return wasActive;
    }
    private async archiveRead(row: CloudPlugin): Promise<ReadonlyMap<string, Buffer>> {
        const bytes = await readFile(join(this.root, row.id, "archive.zip"));
        if (createHash("sha256").update(bytes).digest("hex") !== row.digest)
            throw new Error(
                "An installed plugin changed on disk. Remove it and import a verified copy.",
            );
        const files = localPluginArchiveRead(bytes);
        const verified = manifest(files, row.digest);
        if (
            verified.id !== row.id ||
            verified.format !== row.format ||
            verified.skill_root !== row.skill_root
        )
            throw new Error("The installed plugin record does not match its package.");
        return files;
    }
    private serial<T>(work: () => Promise<T>): Promise<T> {
        const next = this.queue.then(work);
        this.queue = next.catch(() => undefined);
        return next;
    }
    private async records(): Promise<CloudPlugin[]> {
        let names: string[];
        try {
            names = await readdir(this.root);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
            throw error;
        }
        const result: CloudPlugin[] = [];
        for (const id of names.filter((name) => NAME.test(name)).slice(0, 32)) {
            let row: CloudPlugin;
            try {
                row = JSON.parse(
                    await readFile(join(this.root, id, "record.json"), "utf8"),
                ) as CloudPlugin;
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
                throw error;
            }
            if (row.id !== id) throw new Error("The installed plugin record is invalid.");
            result.push(row);
        }
        return result;
    }
    async list(): Promise<CloudPluginsList> {
        return {
            plugins: await this.records(),
            applying: this.applying,
            ...(this.error ? { error: this.error } : {}),
        };
    }
    install(archive: string, expected?: { id: string; sha256: string }): Promise<void> {
        if (this.applying)
            return Promise.reject(
                new Error("Wait for the current plugin selection to finish applying."),
            );
        return this.serial(async () => {
            if (archive.length > Math.ceil((LIMIT * 4) / 3) + 4)
                throw new Error("Plugin ZIPs must be smaller than 8 MB.");
            const bytes = Buffer.from(archive, "base64");
            const digest = createHash("sha256").update(bytes).digest("hex");
            if (expected && expected.sha256 !== digest)
                throw new Error("The plugin package failed its checksum.");
            const files = localPluginArchiveRead(bytes);
            const row = manifest(files, digest);
            if (expected && row.id !== expected.id)
                throw new Error("The downloaded plugin does not match the catalog.");
            const rows = await this.records();
            if (rows.length >= 32 || rows.some((item) => item.id === row.id))
                throw new Error(
                    "Remove the existing version first; at most 32 plugins can be installed.",
                );
            await mkdir(this.root, { recursive: true, mode: 0o700 });
            const stage = join(this.root, `.import-${randomUUID()}`);
            try {
                for (const [path, data] of files) {
                    const target = join(stage, "package", path);
                    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
                    await writeFile(target, data, { mode: 0o600, flag: "wx" });
                }
                await writeFile(join(stage, "archive.zip"), bytes, { mode: 0o600 });
                await writeFile(join(stage, "record.json"), JSON.stringify(row), { mode: 0o600 });
                await rename(stage, join(this.root, row.id));
            } finally {
                await rm(stage, { recursive: true, force: true });
            }
        });
    }
    set(id: string, enabled: boolean, remove: boolean): Promise<void> {
        if (this.applying)
            return Promise.reject(
                new Error("Wait for the current plugin selection to finish applying."),
            );
        return this.serial(async () => {
            if (!NAME.test(id)) throw new Error("That is not a plugin name.");
            const row = (await this.records()).find((item) => item.id === id);
            if (!row) throw new Error("The plugin is no longer installed.");
            await this.writeRecord({ ...row, enabled: remove ? false : enabled, removed: remove });
        });
    }
    private async writeRecord(row: CloudPlugin): Promise<void> {
        const path = join(this.root, row.id, "record.json");
        await writeFile(path + ".tmp", JSON.stringify(row), { mode: 0o600 });
        await rename(path + ".tmp", path);
    }
    /** Only an explicit Apply action restarts the daemon; never installing or opening this page. */
    apply(restart: () => Promise<unknown>): void {
        if (this.applying) return;
        this.applying = true;
        this.error = "";
        void this.serial(async () => {
            try {
                await this.publish(true);
                await restart();
                for (const row of await this.records()) {
                    if (row.removed) await rm(join(this.root, row.id), { recursive: true });
                    else await this.writeRecord({ ...row, active: row.enabled });
                }
            } catch (error) {
                this.error =
                    error instanceof Error ? error.message : "The plugin could not be activated.";
                await this.publish(false).catch(() => undefined);
                for (const row of await this.records())
                    await this.writeRecord({ ...row, active: false });
            } finally {
                this.applying = false;
            }
        }).catch((error: unknown) => {
            this.error =
                error instanceof Error ? error.message : "The plugin could not be activated.";
            this.applying = false;
        });
    }
    deactivate(): Promise<void> {
        return this.serial(async () => {
            await this.publish(false);
            for (const row of await this.records())
                await this.writeRecord({ ...row, active: false });
        });
    }
    private async publish(enabled: boolean): Promise<void> {
        const BEGIN = `# KissOpen managed plugins ${this.accountKey} begin`;
        const END = `# KissOpen managed plugins ${this.accountKey} end`;
        const rows = await this.records();
        const configurations: TomlTable = {};
        const prefix = `kissopen_${this.accountKey}_`;
        for (const row of rows) {
            if (!enabled || !row.enabled || row.removed) continue;
            const files = await this.archiveRead(row);
            for (const [name, config] of Object.entries(
                servers(files, row.format, join(this.root, row.id, "package"), []),
            ))
                configurations[prefix + row.id + "_" + name] = config;
        }
        let original = "";
        try {
            if ((await lstat(this.paths.mcp)).isSymbolicLink())
                throw new Error(
                    "The MCP configuration is a link; manage it manually in Agent settings.",
                );
            original = await readFile(this.paths.mcp, "utf8");
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        const start = original.indexOf(BEGIN);
        const finish = original.indexOf(END);
        if (start < 0 !== finish < 0 || (start >= 0 && finish < start))
            throw new Error(
                "The managed plugin configuration is incomplete; the original file was left unchanged.",
            );
        const own =
            start < 0 ? original : original.slice(0, start) + original.slice(finish + END.length);
        const parsed = parse(own);
        const existing = object(parsed.mcp_servers) ? parsed.mcp_servers : {};
        if (Object.keys(configurations).some((key) => key in existing))
            throw new Error(
                "A user-configured MCP server has this name; rename it before applying this plugin.",
            );
        if (Object.keys(configurations).length + Object.keys(existing).length > 512)
            throw new Error(
                "There are too many MCP servers. Disable some plugins before applying.",
            );
        const next =
            own +
            (Object.keys(configurations).length
                ? `\n${BEGIN}\n${stringify({ mcp_servers: configurations })}${END}\n`
                : "");
        parse(next);
        if (!rows.length && original === next) return;
        // Prepare every skill package before touching its visible directory.
        await mkdir(this.paths.skills, { recursive: true, mode: 0o700 });
        const changes: {
            active: string;
            stage: string;
            backup: string;
            held: boolean;
            installed: boolean;
        }[] = [];
        try {
            for (const row of rows) {
                const active = join(
                    this.paths.skills,
                    `kissopen-plugin-${this.accountKey}-${row.id}`,
                );
                const change = {
                    active,
                    stage: join(this.paths.skills, `.kissopen-stage-${randomUUID()}`),
                    backup: join(this.paths.skills, `.kissopen-backup-${randomUUID()}`),
                    held: false,
                    installed: false,
                };
                changes.push(change);
                let exists = false;
                try {
                    const info = await lstat(active);
                    if (
                        !info.isDirectory() ||
                        info.isSymbolicLink() ||
                        (await readFile(join(active, ".kissopen-owned"), "utf8")) !==
                            `${this.accountKey}:${row.id}`
                    )
                        throw new Error(
                            "A user-owned skill directory has this name. It was left unchanged.",
                        );
                    exists = true;
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
                }
                if (enabled && row.enabled && !row.removed && row.skills) {
                    const files = await this.archiveRead(row);
                    await mkdir(change.stage, { mode: 0o700 });
                    for (const [path, data] of files) {
                        if (path.endsWith("SKILL.md") && !path.startsWith(row.skill_root + "/"))
                            continue;
                        const target = join(change.stage, path);
                        await mkdir(dirname(target), { recursive: true, mode: 0o700 });
                        await writeFile(target, data, { mode: 0o600, flag: "wx" });
                    }
                    await writeFile(
                        join(change.stage, ".kissopen-owned"),
                        `${this.accountKey}:${row.id}`,
                        { mode: 0o600, flag: "wx" },
                    );
                }
                if (exists) {
                    await rename(active, change.backup);
                    change.held = true;
                }
                if (enabled && row.enabled && !row.removed && row.skills) {
                    await rename(change.stage, active);
                    change.installed = true;
                }
            }
            const current = await readFile(this.paths.mcp, "utf8").catch(
                (error: NodeJS.ErrnoException) => {
                    if (error.code === "ENOENT") return "";
                    throw error;
                },
            );
            if (current !== original)
                throw new Error(
                    "Your MCP settings changed while applying plugins. Try again; your edits were preserved.",
                );
            if (original !== next) {
                await mkdir(dirname(this.paths.mcp), { recursive: true, mode: 0o700 });
                await writeFile(this.paths.mcp + ".kissopen-tmp", next, { mode: 0o600 });
                await rename(this.paths.mcp + ".kissopen-tmp", this.paths.mcp);
            }
        } catch (error) {
            for (const change of [...changes].reverse()) {
                if (change.installed) await rm(change.active, { recursive: true, force: true });
                if (change.held) await rename(change.backup, change.active);
            }
            throw error;
        } finally {
            for (const change of changes) {
                await rm(change.stage, { recursive: true, force: true });
                await rm(change.backup, { recursive: true, force: true });
            }
        }
    }
}
