import type { FileTreeNode } from "./FileTree";

/**
 * What a drawn row is. A tree draws two things that are not entries — the note
 * that a directory's children are still arriving, and the affordance that asks
 * for the rest of them — and both occupy a row, so both belong to the row model
 * rather than being smuggled in beside it. Only an `entry` is a treeitem the
 * arrow keys stop on.
 */
export type FileTreeRowKind = "entry" | "loading" | "more";

export interface FileTreeRow {
    /** Unique among drawn rows, so it can key a virtual item. */
    readonly id: string;
    readonly kind: FileTreeRowKind;
    /** The entry, or for a loading/more row the directory it belongs to. */
    readonly node: FileTreeNode;
    /** Levels from the top of the listing, which is the row's indentation. */
    readonly depth: number;
    /** The directory holding this row, absent at the top level. */
    readonly parentId?: string;
    /** How many entries share this row's parent, for `aria-setsize`. */
    readonly setSize: number;
    /** This row's place among them, one-based, for `aria-posinset`. */
    readonly posInSet: number;
}

export interface FileTreeRowModel {
    /** Every row the tree draws, in drawing order. */
    readonly rows: readonly FileTreeRow[];
    /**
     * Where each row sits in `rows`, for moving the focus without a scan. Every
     * drawn row is in here, not only the entries: the keyboard stops on the row
     * that asks for the rest of a directory too, and a row it can reach but not
     * find is a row it can leave the focus stranded on.
     */
    readonly indexById: ReadonlyMap<string, number>;
}

/**
 * The rows a tree of nodes draws, flattened.
 *
 * Both of the things this model is for need the drawn sequence rather than the
 * nesting: a virtualizer asks what the nth row is, and the arrow keys ask what
 * comes after this one — and what comes after the last file of an open folder
 * is the next folder's first row, which the nesting cannot answer without
 * walking back up it.
 *
 * Nesting survives as `depth`, `parentId`, and the `aria-level` /
 * `aria-setsize` / `aria-posinset` triple, which is how a tree presented as a
 * flat run of rows still reports its shape. That is what makes virtualizing a
 * tree legitimate rather than a lie told to assistive technology.
 */
function rowsBuild(nodes: readonly FileTreeNode[]): FileTreeRowModel {
    const rows: FileTreeRow[] = [];
    const indexById = new Map<string, number>();
    const push = (row: FileTreeRow): void => {
        indexById.set(row.id, rows.length);
        rows.push(row);
    };
    /**
     * `extra` is the row that asks for the rest of this directory, if it has
     * one: it stands among the children as a treeitem, so it is one of them as
     * far as `aria-setsize` is concerned and the children have to be counted
     * knowing it is coming.
     */
    const walk = (
        level: readonly FileTreeNode[],
        depth: number,
        parentId?: string,
        extra = 0,
    ): void => {
        const setSize = level.length + extra;
        level.forEach((node, position) => {
            push({
                id: node.id,
                kind: "entry",
                node,
                depth,
                ...(parentId === undefined ? {} : { parentId }),
                setSize,
                posInSet: position + 1,
            });
            if (node.kind !== "directory" || !node.expanded) return;
            if (node.loading) {
                // The children's own depth: the note stands where they will.
                push({
                    id: `${node.id}\u0000loading`,
                    kind: "loading",
                    node,
                    depth: depth + 1,
                    parentId: node.id,
                    setSize: 1,
                    posInSet: 1,
                });
                return;
            }
            const children = node.children?.length ?? 0;
            if (node.children) walk(node.children, depth + 1, node.id, node.hasMore ? 1 : 0);
            if (node.hasMore)
                push({
                    id: `${node.id}\u0000more`,
                    kind: "more",
                    node,
                    depth: depth + 1,
                    parentId: node.id,
                    setSize: children + 1,
                    posInSet: children + 1,
                });
        });
    };
    walk(nodes, 0);
    return { rows, indexById };
}

/**
 * Every row model built so far, by the identity of the nodes it was built from.
 *
 * The model is read on every render and again on every keystroke, and a
 * checkout's worth of nodes is not something to walk that often. Nodes are
 * rebuilt whenever the listing actually changes, so the array they arrive in
 * identifies the listing exactly.
 */
const models = new WeakMap<object, FileTreeRowModel>();

/** The drawn rows of these nodes, built once per distinct set of nodes. */
export function fileTreeRowModel(nodes: readonly FileTreeNode[]): FileTreeRowModel {
    const cached = models.get(nodes);
    if (cached) return cached;
    const model = rowsBuild(nodes);
    models.set(nodes, model);
    return model;
}
