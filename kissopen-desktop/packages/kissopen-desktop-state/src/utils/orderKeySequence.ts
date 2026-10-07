import { generateKeyBetween } from "./fractionalIndexing.js";

/**
 * Mints `count` keys that sort in sequence after `after`, or from the start of
 * the range when it is null. The result depends only on its inputs, so a client
 * materializing a personal order optimistically derives exactly the keys the
 * server derives from the same list.
 */
export function orderKeySequence(count: number, after: string | null = null): string[] {
    const keys: string[] = [];
    let previous = after;
    for (let index = 0; index < count; index += 1) {
        previous = generateKeyBetween(previous, null);
        keys.push(previous);
    }
    return keys;
}
