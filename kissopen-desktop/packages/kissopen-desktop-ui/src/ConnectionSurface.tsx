import { Activity, type ReactNode } from "react";

/** Activity retains DOM/local state while suspending hidden window listeners. */
export function ConnectionSurface(props: {
    readonly active: boolean;
    readonly children: ReactNode;
}) {
    return (
        <Activity mode={props.active ? "visible" : "hidden"}>
            <div
                className="kissopen-connections__surface"
                data-kissopen-desktop-ui="connection-surface"
            >
                {props.children}
            </div>
        </Activity>
    );
}
