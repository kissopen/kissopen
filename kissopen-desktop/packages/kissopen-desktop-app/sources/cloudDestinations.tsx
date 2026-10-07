import { createContext, useContext, type ReactNode } from "react";
import type {
    KissopenBoardPlace,
    KissopenBoardTiming,
    KissopenBoardSubmission,
    KissopenProjectAnalysis,
    Schedule,
} from "kissopen-desktop-state";
import type {
    MenuItem,
    SidebarItem,
    SidebarSection,
    WorkStartExample,
    WorkStartProject,
} from "kissopen-desktop-ui";

/**
 * The consumer destinations the workspace sidebar pins above its own rows.
 *
 * `KissopenView` knows them — it owns the cloud store and the tab order — while
 * the sidebar that must show them lives several layers down, behind a renderer
 * that has no reason to carry them. Passing them by context keeps that renderer
 * out of it, and lets the workspace view stand alone in tests and blueprints,
 * where the default is simply an empty list.
 */
export interface CloudDestinations {
    readonly items: readonly SidebarItem[];
    readonly onSelect: (id: string) => void;
    /** The destination the window is on, so the sidebar can mark its row. */
    readonly activeId: string;
    /**
     * What a chosen destination shows, rendered in place of the workspace's own
     * content while one is open. It arrives here rather than replacing the whole
     * workspace, because the sidebar the reader navigates with belongs to that
     * workspace — hiding it to show a conversation would take away the only way
     * back.
     */
    readonly content?: ReactNode;
    /**
     * What stands beside that content, in the window's own panel column.
     *
     * The same column the workspace's panel uses, so it comes with the same
     * draggable divider and the same shortcut — a project on another machine
     * is arranged the way a project on this one is, rather than being given a
     * second idea of a side panel.
     */
    readonly panel?: ReactNode;
    /** How wide it was left, when the supplier remembers. */
    readonly panelWidth?: number;
    readonly onPanelWidthChange?: (width: number) => void;
    /**
     * The KISSOPEN account's own profile page. It arrives as a node because the
     * settings shell owns where categories sit, not what a consumer account is.
     */
    readonly profileSettings?: ReactNode;
    /**
     * The signed-in KISSOPEN account, for the sidebar's footer. Absent while
     * signed out, which is when the row correctly shows no identity at all.
     */
    readonly account?: {
        readonly name: string;
        readonly initials: string;
        readonly imageUrl?: string;
    };
    /** Chosen from the footer's identity menu. */
    readonly onAccountAction?: (id: string) => void;
    /**
     * What the sidebar lists beneath the destinations while one is open — the
     * conversations or reports behind it. The workspace's own projects are the
     * list when no destination is: one column, and it always describes whatever
     * the window is currently showing.
     */
    readonly sections?: readonly SidebarSection[];
    /** Opens a row from `sections`; those rows are history, not destinations. */
    readonly onSectionItemSelect?: (id: string) => void;
    /**
     * What a row from `sections` offers in its menu — right-click or its "…"
     * control. Empty, or absent, means the row has no menu.
     */
    readonly sectionItemMenuItems?: (id: string) => MenuItem[];
    /** One entry chosen from that menu. */
    readonly onSectionItemMenuSelect?: (id: string, actionId: string) => void;
    /** The open conversation or report, so its row reads as selected. */
    readonly sectionActiveId?: string;
    /**
     * Things a project could be, offered on the 工作 page before there is one.
     * The account knows the person's work; the workspace does not.
     */
    readonly workExamples?: readonly WorkStartExample[];
    /**
     * Every project the person has — this computer's, the cloud's, other
     * computers' — listed on the 工作 page, and how to open one where it is.
     */
    readonly workProjects?: {
        readonly projects: readonly WorkStartProject[];
        readonly open: (id: string) => void;
    };
    /**
     * Projects' board schedules, which the account holds, and what can be done
     * with them. The board itself is a file in the project, which the workspace
     * reads; building it is a scheduled run on this computer.
     */
    readonly boards?: {
        /** This computer by the relay's id, when its agent cannot say its own. */
        readonly machineId?: string;
        /** By `kissopenBoardKey`. */
        readonly schedules: ReadonlyMap<string, Schedule>;
        readonly submissions?: ReadonlyMap<string, KissopenBoardSubmission>;
        readonly loaded: boolean;
        readonly error: string;
        /** A schedule change is being saved. */
        readonly saving: boolean;
        /** Keeps the schedules current while a board is on screen; returns the way to stop. */
        readonly watch: () => () => void;
        readonly build: (place: KissopenBoardPlace) => void;
        readonly scheduleSave: (
            place: KissopenBoardPlace,
            timing: KissopenBoardTiming | undefined,
        ) => void;
        /** Each project's analysis of new material, by `kissopenBoardKey`, once read. */
        readonly analyses: ReadonlyMap<string, KissopenProjectAnalysis>;
        readonly analysisLoad: (place: KissopenBoardPlace) => void;
        readonly analysisSet: (place: KissopenBoardPlace, enabled: boolean) => void;
        /** Files were just uploaded into the project; its analysis is set to run. */
        readonly uploaded: (place: KissopenBoardPlace) => void;
    };
}

const empty: CloudDestinations = { activeId: "", items: [], onSelect: () => {} };
const CloudDestinationsContext = createContext<CloudDestinations>(empty);

export function CloudDestinationsProvider(props: {
    readonly value: CloudDestinations;
    readonly children: ReactNode;
}) {
    return (
        <CloudDestinationsContext.Provider value={props.value}>
            {props.children}
        </CloudDestinationsContext.Provider>
    );
}

export function useCloudDestinations(): CloudDestinations {
    return useContext(CloudDestinationsContext);
}
