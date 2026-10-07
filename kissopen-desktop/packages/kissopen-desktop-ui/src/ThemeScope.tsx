import type { ThemeDoc } from "kissopen-desktop-state";
import { type ReactNode } from "react";
import { themeStylesheet } from "./themeStylesheet";

export type ThemeMode = "dark" | "light" | "system";
export type ScrollbarVisibility = "always" | "automatic";

export type ThemeScopeProps = {
    children: ReactNode;
    mode: ThemeMode;
    scrollbarVisibility?: ScrollbarVisibility;
    /** The account's custom theme, drawn over the product's own look; none for the product's own. */
    theme?: ThemeDoc | null;
};

/**
 * Applies one user-selected appearance to a stable product subtree while
 * retaining the system palette when no explicit override is selected. A
 * custom theme is one stylesheet over theme.css, scoped to this element, so
 * light, dark and system stay the appearance's choice.
 */
export function ThemeScope(props: ThemeScopeProps) {
    return (
        <>
            {props.theme ? (
                <style data-kissopen-desktop-ui="theme-stylesheet">
                    {themeStylesheet(props.theme)}
                </style>
            ) : null}
            <div
                className={
                    props.mode === "system"
                        ? "kissopen-theme-scope"
                        : `kissopen-theme-scope kissopen-theme-${props.mode}`
                }
                data-kissopen-desktop-ui="theme-scope"
                data-scrollbar-visibility={props.scrollbarVisibility ?? "automatic"}
            >
                {props.children}
            </div>
        </>
    );
}
