import { localAgentSocketPath } from "./localAgentSocketPath.js";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

/** Filesystem locations shared by Kissopen, Kissopen Agent, and the Kissopen Agent daemon. */
export interface KissopenDaemonPaths {
    readonly agentDirectory: string;
    readonly binaryConfigPath: string;
    readonly distDirectory: string;
    readonly kissopenHome: string;
    readonly installLockPath: string;
    readonly logPath: string;
    readonly socketPath: string;
    readonly tokenPath: string;
    readonly versionsDirectory: string;
}

export function kissopenDaemonPaths(
    environment: NodeJS.ProcessEnv = process.env,
    homeDirectory: string = homedir(),
): KissopenDaemonPaths {
    const kissopenHome = kissopenHomeResolve(environment, homeDirectory);
    const agentDirectory = join(kissopenHome, "agent");
    const distDirectory = join(kissopenHome, "dist");
    return {
        agentDirectory,
        binaryConfigPath: join(distDirectory, "config.json"),
        distDirectory,
        kissopenHome,
        installLockPath: join(distDirectory, "install.lock"),
        logPath: join(agentDirectory, "daemon.log"),
        socketPath: localAgentSocketPath(agentDirectory),
        tokenPath: join(agentDirectory, "token"),
        versionsDirectory: join(distDirectory, "version"),
    };
}

/** The installed binary's file name. Windows will not execute it without `.exe`. */
export const KISSOPEN_AGENT_BINARY_FILE_NAME =
    process.platform === "win32" ? "kissopen-agent.exe" : "kissopen-agent";

export function kissopenAgentBinaryPath(paths: KissopenDaemonPaths, version: string): string {
    return join(paths.versionsDirectory, version, KISSOPEN_AGENT_BINARY_FILE_NAME);
}

function kissopenHomeResolve(environment: NodeJS.ProcessEnv, homeDirectory: string): string {
    const configured = environment.KISSOPEN_HOME_DIR?.trim();
    if (configured === undefined || configured.length === 0) return join(homeDirectory, ".kissopen");
    const expanded = configured.startsWith("~")
        ? join(homeDirectory, configured.slice(1))
        : configured;
    return isAbsolute(expanded) ? expanded : join(homeDirectory, expanded);
}
