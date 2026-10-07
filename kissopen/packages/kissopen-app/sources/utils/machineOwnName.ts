/**
 * A machine's name without the product suffix agents before 0.4.69-preview.1029 put after it
 * ("mac-mini — KISSOPEN Agent"). They still report it until they update, and a person reading
 * which computer a conversation runs on only needs the computer.
 */
export function machineOwnName(name: string | null | undefined): string | undefined {
    return name?.replace(/\s+—\s+(?:KISSOPEN|KissOpen) Agent$/u, '') || undefined;
}
