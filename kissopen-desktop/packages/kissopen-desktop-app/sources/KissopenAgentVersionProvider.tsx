import { createContext, useContext, type ReactNode } from "react";
import { kissopenAgentVersionAtLeast } from "kissopen-desktop-state";

/**
 * The addressed Kissopen Agent's most recently observed product version. It stays
 * available while that agent reconnects and is undefined until one version has
 * been observed.
 */
export const KissopenAgentVersionContext = createContext<string | undefined>(undefined);

export interface KissopenAgentVersionProviderProps {
    readonly children: ReactNode;
    readonly lastKnownVersion?: string;
}

/** Supplies the addressed KISSOPEN Agent's last known version to an application subtree. */
export function KissopenAgentVersionProvider(props: KissopenAgentVersionProviderProps) {
    return (
        <KissopenAgentVersionContext.Provider value={props.lastKnownVersion}>
            {props.children}
        </KissopenAgentVersionContext.Provider>
    );
}

/** The addressed Kissopen Agent's last known version, if one has been observed. */
export function useKissopenAgentVersion(): string | undefined {
    return useContext(KissopenAgentVersionContext);
}

/**
 * Whether the addressed Kissopen Agent is new enough for a feature. An unknown
 * version is unsupported so a component never offers an operation speculatively.
 */
export function useKissopenAgentVersionAtLeast(minimumVersion: string): boolean {
    return kissopenAgentVersionAtLeast(useKissopenAgentVersion(), minimumVersion);
}
