import { partitionComponentProps } from "./componentProps";
import { type CSSProperties, type ReactNode } from "react";
import { Icon } from "./Icon";
export type ToolbarSearch = {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
};
export type ToolbarProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    title?: string;
    subtitle?: string;
    leading?: ReactNode;
    trailing?: ReactNode;
    search?: ToolbarSearch;
    height?: number;
    /**
     * Names the title as a heading at this level. A toolbar over a section is
     * usually a label rather than a heading, which is why the default stays a
     * span; when the toolbar heads a whole screen it is that screen's heading,
     * and the headings below it need something to sit under.
     */
    titleLevel?: 1 | 2 | 3;
};
/**
 * C-026 Toolbar — panel/section header bar. A default 48px strip that sits at
 * the top of a panel (admin tables, settings sections): a title with an
 * optional subtitle on the left, an optional leading slot, and a right-pinned
 * actions cluster holding an optional inset search well and a trailing slot.
 * Composes on KISSOPEN's surface without a visual separator.
 */
export function Toolbar(props: ToolbarProps) {
    const [local] = partitionComponentProps(props, [
        "className",
        "data-testid",
        "style",
        "title",
        "subtitle",
        "leading",
        "trailing",
        "search",
        "height",
        "titleLevel",
    ]);
    const hasHeading = () => local.title !== undefined || local.subtitle !== undefined;
    const hasActions = () => local.search !== undefined || local.trailing !== undefined;
    return (
        <header
            className={["kissopen-toolbar", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="toolbar"
            data-testid={local["data-testid"]}
            style={{
                ...local.style,
                ...(local.height === undefined
                    ? {}
                    : { "--kissopen-toolbar-height": `${local.height}px` }),
            }}
        >
            {local.leading ? (
                <div
                    className="kissopen-toolbar__leading"
                    data-kissopen-desktop-ui="toolbar-leading"
                >
                    {local.leading}
                </div>
            ) : null}
            {hasHeading() ? (
                <div
                    className="kissopen-toolbar__heading"
                    data-kissopen-desktop-ui="toolbar-heading"
                >
                    {local.title !== undefined
                        ? ((
                              Title = local.titleLevel === undefined
                                  ? ("span" as const)
                                  : (`h${String(local.titleLevel)}` as "h1" | "h2" | "h3"),
                          ) => (
                              <Title
                                  className="kissopen-toolbar__title"
                                  data-kissopen-desktop-ui="toolbar-title"
                              >
                                  <span className="kissopen-toolbar__title-ink">{local.title}</span>
                              </Title>
                          ))()
                        : null}
                    {local.subtitle !== undefined ? (
                        <span
                            className="kissopen-toolbar__subtitle"
                            data-kissopen-desktop-ui="toolbar-subtitle"
                        >
                            <span className="kissopen-toolbar__subtitle-ink">{local.subtitle}</span>
                        </span>
                    ) : null}
                </div>
            ) : null}
            {hasActions() ? (
                <div
                    className="kissopen-toolbar__actions"
                    data-kissopen-desktop-ui="toolbar-actions"
                >
                    {local.search
                        ? ((search) => (
                              <div
                                  className="kissopen-toolbar__search"
                                  data-kissopen-desktop-ui="toolbar-search"
                              >
                                  <span
                                      aria-hidden="true"
                                      className="kissopen-toolbar__search-icon"
                                      data-kissopen-desktop-ui="toolbar-search-icon"
                                  >
                                      <Icon name="search" size={14} />
                                  </span>
                                  <input
                                      aria-label={search.placeholder ?? "Search"}
                                      className="kissopen-toolbar__search-input"
                                      data-kissopen-desktop-ui="toolbar-search-input"
                                      onInput={(event) =>
                                          search.onChange(event.currentTarget.value)
                                      }
                                      placeholder={search.placeholder ?? "Search"}
                                      type="text"
                                      value={search.value}
                                  />
                              </div>
                          ))(local.search)
                        : null}
                    {local.trailing ? (
                        <div
                            className="kissopen-toolbar__trailing"
                            data-kissopen-desktop-ui="toolbar-trailing"
                        >
                            {local.trailing}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </header>
    );
}
