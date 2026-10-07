import { useLayoutEffect, useState, type ComponentType, type ReactNode } from "react";
import "../src/index";
import { Icon } from "../src/Icon";
import { SegmentedControl } from "../src/SegmentedControl";
import { ThemeScope, type ThemeMode } from "../src/ThemeScope";
import "./workbench.css";

type PageModule = Readonly<Record<string, unknown>>;

interface BlueprintPage {
    /** The component plan number, the same one the open page prints in its header. */
    readonly componentNumber: string;
    readonly id: string;
    readonly label: string;
    readonly page: ComponentType;
}

const modules = import.meta.glob<PageModule>("./pages/*Page.tsx", { eager: true });
const pages = Object.entries(modules)
    .map(([path, module]): BlueprintPage => {
        const filename =
            path
                .split("/")
                .at(-1)
                ?.replace(/\.tsx$/u, "") ?? path;
        const exported = Object.entries(module).find(
            ([name, value]) => name.endsWith("Page") && typeof value === "function",
        );
        if (!exported) throw new Error(`Blueprint page ${path} exports no page component.`);
        const componentNumber = module.componentNumber;
        if (typeof componentNumber !== "string")
            throw new Error(`Blueprint page ${path} exports no componentNumber.`);
        const name = filename.replace(/BlueprintPage$|Page$/u, "");
        return {
            componentNumber,
            id: name
                .replace(/([a-z\d])([A-Z])/gu, "$1-$2")
                .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1-$2")
                .toLowerCase(),
            label: name
                .replace(/([a-z\d])([A-Z])/gu, "$1 $2")
                .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2"),
            page: exported[1] as ComponentType,
        };
    })
    /* By plan number, so the selector reads in the order the components were
       planned and a page can be found from a number quoted anywhere else.
       Numerically, or C-100 would sort between C-002b and C-003. */
    .sort((left, right) =>
        left.componentNumber.localeCompare(right.componentNumber, undefined, { numeric: true }),
    );

const defaultPageId = pages.find((page) => page.id === "icon")?.id ?? pages[0]?.id ?? "";

function pageFromHash(): string {
    const id = window.location.hash.slice(1).toLowerCase();
    return pages.some((page) => page.id === id) ? id : defaultPageId;
}

export interface WorkbenchProps {
    /**
     * Whether the browser hash names the open page. The standalone Blueprint
     * owns its address; an embedded workbench leaves the application URL alone.
     */
    readonly hashAddressed?: boolean;
}

/** The retained component index, selector, appearance controls, and active Blueprint page. */
export function Workbench(props: WorkbenchProps = {}) {
    const hashAddressed = props.hashAddressed ?? true;
    const [active, setActive] = useState(hashAddressed ? pageFromHash() : defaultPageId);
    const [appearance, setAppearance] = useState<ThemeMode>("system");
    // eslint-disable-next-line kissopen-react/no-layout-effect -- standalone Blueprint navigation is driven by the browser hash and requires one synchronously cleaned-up hashchange listener
    useLayoutEffect(() => {
        if (!hashAddressed) return;
        const syncHash = () => setActive(pageFromHash());
        window.addEventListener("hashchange", syncHash);
        return () => window.removeEventListener("hashchange", syncHash);
    }, [hashAddressed]);
    const selectPage = (id: string) => {
        if (hashAddressed) window.location.hash = id;
        setActive(id);
    };
    const selected = pages.find((page) => page.id === active) ?? pages[0];
    const brandContent: ReactNode = (
        <>
            <span>
                <Icon name="star" size={14} />
            </span>
            <strong>kissopen-desktop-ui</strong>
            <i>component plans</i>
        </>
    );
    return (
        <ThemeScope mode={appearance} scrollbarVisibility="automatic">
            <div className="workbench-shell">
                <header className="workbench-header">
                    {hashAddressed ? (
                        <a
                            aria-label="kissopen-desktop-ui home"
                            className="workbench-brand"
                            href={`#${defaultPageId}`}
                        >
                            {brandContent}
                        </a>
                    ) : (
                        <button
                            aria-label="kissopen-desktop-ui home"
                            className="workbench-brand"
                            onClick={() => selectPage(defaultPageId)}
                            type="button"
                        >
                            {brandContent}
                        </button>
                    )}
                    <div className="header-axis" aria-hidden="true">
                        <i />
                        <span>16 px minor · 80 px major</span>
                        <i />
                    </div>
                    <div
                        aria-label="Blueprint appearance"
                        className="workbench-appearance"
                        role="group"
                    >
                        <span>Appearance</span>
                        <SegmentedControl
                            onChange={(value) => setAppearance(value as ThemeMode)}
                            segments={[
                                { value: "system", label: "Auto" },
                                { value: "light", label: "Light", icon: "sun" },
                                { value: "dark", label: "Dark", icon: "moon" },
                            ]}
                            size="small"
                            value={appearance}
                        />
                    </div>
                    <label className="component-select">
                        <span>Page</span>
                        <span className="component-select-field">
                            <select
                                aria-label="Open component page"
                                onInput={(event) => selectPage(event.currentTarget.value)}
                                value={selected?.id ?? ""}
                            >
                                {pages.map((page) => (
                                    <option key={page.id} value={page.id}>
                                        {`${page.componentNumber} · ${page.label}`}
                                    </option>
                                ))}
                            </select>
                            <span className="component-select-chevron">
                                <Icon name="chevron-down" size={14} />
                            </span>
                        </span>
                    </label>
                </header>
                <div className="blueprint-field">{selected ? <selected.page /> : null}</div>
            </div>
        </ThemeScope>
    );
}
