import type { Machine, Session } from '@/sync/storageTypes';
import type { Project } from '@/sync/projectTypes';
import { getSessionProjectId } from '@/sync/projectTypes';
import { getMachineName } from '@/sync/machineChoices';
import { getSessionActivityAt } from '@/utils/sessionActivity';
import { getSessionName } from '@/utils/sessionUtils';
import type { WorkProject } from './ProjectPage';

type Building = WorkProject & { conversations: { id: string; title: string; updatedAt: number }[] };

/**
 * The account's projects as the phone can know them, the same way the
 * desktop's remote view knows them.
 *
 * A project record says nothing about which computer it lives on — the same
 * project can be opened on two. Its conversations do: each names its project
 * and its computer, so a project appears on a computer once that computer has
 * worked in it. The name comes from the project record. The folder, which the
 * board is read from, is the outermost folder its conversations ran in there.
 *
 * Conversations that name no project (a CLI session started in some folder)
 * are grouped by computer and folder instead, a folder inside another one on
 * the same computer belonging to the outer one.
 *
 * A project record from a current agent also says which computer published it
 * and its folder there. Such a project is listed even before anyone has talked
 * in it, and its folder is the record's rather than a conversation's guess.
 *
 * The cloud workspace has projects too, in its managed projects folder; its
 * home folder, where chats run, is not one, and neither are bots' folders.
 *
 * The cloud workspace's chats are
 * chat happens, not a project, and a bot's conversation lives in the bot's own
 * folder, so neither is counted. Newest first.
 */
export function buildWorkProjects(
    sessions: readonly Session[],
    machines: readonly Machine[],
    records: Readonly<Record<string, Project>>,
    cloudMachineId: string | undefined,
    cloudPlace: string,
): WorkProject[] {
    const names = new Map(machines.map(machine => [machine.id, getMachineName(machine)]));
    if (cloudMachineId) names.set(cloudMachineId, cloudPlace);
    // On the cloud machine only its managed projects folder holds projects.
    const inPlace = (machineId: string, path: string) =>
        machineId !== cloudMachineId || path.startsWith(`${CLOUD_PROJECTS_ROOT}/`);
    const byProject = new Map<string, Building>();
    const byFolder: Building[] = [];
    const eligible = sessions
        .filter(session => {
            const metadata = session.metadata;
            // An archived conversation has left its project — among them the cloud's
            // board builds — and its agent no longer answers for it, so nothing is read through it.
            return !!metadata?.machineId && !metadata.bot && metadata.lifecycleState !== 'archived'
                && inPlace(metadata.machineId, trimSlash(metadata.path ?? ''));
        })
        .sort((a, b) => (a.metadata?.path?.length ?? 0) - (b.metadata?.path?.length ?? 0));
    for (const session of eligible) {
        const machineId = session.metadata!.machineId!;
        const path = trimSlash(session.metadata?.path ?? '');
        const updatedAt = getSessionActivityAt(session);
        const conversation = { id: session.id, title: getSessionName(session), updatedAt };
        const projectId = getSessionProjectId(session);
        if (projectId) {
            const key = `${machineId}:${projectId}`;
            const seen = byProject.get(key);
            if (seen) {
                seen.conversations.push(conversation);
                seen.updatedAt = Math.max(seen.updatedAt, updatedAt);
                if (!seen.path && path) seen.path = path;
                continue;
            }
            byProject.set(key, {
                id: key,
                name: records[projectId]?.name || folderName(path) || projectId,
                place: names.get(machineId) ?? '',
                machineId,
                path,
                updatedAt,
                conversations: [conversation],
                cloud: machineId === cloudMachineId,
            });
            continue;
        }
        if (!path) continue;
        const owner = byFolder.find(project => project.machineId === machineId && (project.path === path || path.startsWith(`${project.path}/`)));
        if (owner) {
            owner.conversations.push(conversation);
            owner.updatedAt = Math.max(owner.updatedAt, updatedAt);
            continue;
        }
        byFolder.push({
            id: `${machineId}:${path}`,
            name: folderName(path) || path,
            place: names.get(machineId) ?? '',
            machineId,
            path,
            updatedAt,
            conversations: [conversation],
            cloud: machineId === cloudMachineId,
        });
    }
    for (const [projectId, record] of Object.entries(records)) {
        if (!record.machineId || !record.path || record.kind === 'home' || !inPlace(record.machineId, trimSlash(record.path))) continue;
        const key = `${record.machineId}:${projectId}`;
        const seen = byProject.get(key);
        if (seen) {
            seen.path = trimSlash(record.path);
            continue;
        }
        byProject.set(key, {
            id: key,
            name: record.name || folderName(record.path),
            place: names.get(record.machineId) ?? '',
            machineId: record.machineId,
            path: trimSlash(record.path),
            updatedAt: record.updatedAt,
            conversations: [],
            cloud: record.machineId === cloudMachineId,
        });
    }
    // A folder that is already a project's folder on that computer is that project.
    const projects = [...byProject.values()];
    const loose = byFolder.filter(folder => !projects.some(project => project.machineId === folder.machineId && project.path && (folder.path === project.path || folder.path.startsWith(`${project.path}/`))));
    const all = [...projects, ...loose];
    // The project's files are read through a conversation that runs in its own folder.
    const rootOf = new Map<string, string>();
    for (const session of eligible) {
        const key = `${session.metadata!.machineId}:${trimSlash(session.metadata?.path ?? '')}`;
        if (!rootOf.has(key)) rootOf.set(key, session.id);
    }
    for (const project of all) {
        project.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
        const root = rootOf.get(`${project.machineId}:${project.path}`);
        if (root) project.rootSessionId = root;
    }
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Where the cloud workspace's agent keeps the projects it manages. */
export const CLOUD_PROJECTS_ROOT = '/home/agent/KISSOPEN/Projects';

function folderName(path: string): string {
    return path.split(/[/\\]/).filter(Boolean).at(-1) ?? '';
}

function trimSlash(path: string): string {
    return path.length > 1 ? path.replace(/[/\\]+$/, '') : path;
}
