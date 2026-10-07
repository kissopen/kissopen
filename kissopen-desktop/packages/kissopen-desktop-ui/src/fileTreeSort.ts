/*
 * The order files are listed in, shared by every shape the listing takes.
 *
 * A file browser has exactly one right answer to "where is this row", and it
 * must not depend on which shape the listing happens to be in or on what order
 * the host handed the paths over. Git answers `ls-files` in byte order, which
 * puts every capitalised name in a block above the lowercase ones and orders
 * `v10` before `v9`; a status listing answers in whatever order the working
 * tree was walked. Neither is an order anybody reads in.
 */

/**
 * How two names in the same directory compare: the reader's own language,
 * digits read as numbers rather than characters, and case ignored, so `README`
 * sits with `readme` instead of in a separate block of capitals.
 */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/**
 * Two names in one directory, in reading order.
 *
 * The collator deliberately calls names that differ only in case or accent
 * equal, which is right for reading and useless for ordering: two files that
 * compare equal would swap places between one render and the next. The raw
 * comparison behind it is the tie-break, so `Makefile` and `makefile` sit
 * together and always in the same order.
 */
export function fileNameCompare(left: string, right: string): number {
    const natural = collator.compare(left, right);
    if (natural !== 0) return natural;
    return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Two repository-relative paths, in the order a tree of them is drawn.
 *
 * The comparison walks the paths a segment at a time. Where one path ends and
 * the other keeps going, the one that keeps going is a directory at that level
 * and the one that ends is a file inside it, so directories sort ahead of files
 * without either shape having to sort its rows a second time. Everything else
 * is `fileNameCompare` on the segment.
 *
 * The result is that a flat listing and a nested one put the same file in the
 * same place relative to its neighbours, and that the tree builder can emit
 * rows in the order it meets them.
 */
export function filePathCompare(left: string, right: string): number {
    const leftSegments = left.split("/");
    const rightSegments = right.split("/");
    const shared = Math.min(leftSegments.length, rightSegments.length);
    for (let index = 0; index < shared; index += 1) {
        const leftEnds = index === leftSegments.length - 1;
        const rightEnds = index === rightSegments.length - 1;
        if (leftEnds !== rightEnds) return leftEnds ? 1 : -1;
        const order = fileNameCompare(leftSegments[index]!, rightSegments[index]!);
        if (order !== 0) return order;
    }
    return leftSegments.length - rightSegments.length;
}

/**
 * Every entry that has ever been sorted, by the identity of the array it
 * arrived in.
 *
 * Ordering twenty thousand paths costs a locale comparison per step, which is
 * far too much to spend again because a directory was opened. The listing's
 * entries are rebuilt only when the host answers with different files, so the
 * array they arrive in is the honest cache key: the same array is by definition
 * the same listing. Entries are read, never written, which is what makes
 * handing the same sorted array back safe.
 */
const sorted = new WeakMap<object, readonly unknown[]>();

/**
 * The same entries in listing order.
 *
 * Callers may pass the entries in whatever order the host produced them; every
 * shape of the listing goes through here first, so none of them has to know
 * how files are ordered or remember to do it.
 */
export function fileEntriesSort<Entry extends { readonly path: string }>(
    entries: readonly Entry[],
): readonly Entry[] {
    const cached = sorted.get(entries);
    if (cached) return cached as readonly Entry[];
    const order = [...entries].sort((left, right) => filePathCompare(left.path, right.path));
    sorted.set(entries, order);
    return order;
}
