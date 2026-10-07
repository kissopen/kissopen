import {
    computeAccessibleDescription,
    computeAccessibleName,
    getRole,
} from "dom-accessibility-api";

export interface BrowserObservation {
    metadata: {
        text: string;
        controls: string[];
        omitted: number;
        visuals: number;
        truncated: boolean;
    };
    elements: Element[];
}

/** Runs once inside the current guest; never reads or returns editable values. */
export function observe(): BrowserObservation {
    const originals = new WeakMap<Element, Element>();
    const copies = new WeakMap<Element, Element>();
    const mirror = document.implementation.createHTMLDocument();
    // The detached document is inert. The naming library needs a Window for its
    // DOM utilities; styles are read only from corresponding original elements.
    Object.defineProperty(mirror, "defaultView", { value: window });
    let nodes = 0;
    let truncated = false;
    const copy = (node: Node): Node | undefined => {
        if (++nodes > 20000) {
            truncated = true;
            return;
        }
        if (node.nodeType === Node.TEXT_NODE) return mirror.createTextNode(node.textContent || "");
        if (!(node instanceof Element)) return;
        if (node.matches("script,style,noscript,iframe")) return;
        const clone = mirror.importNode(node, false) as Element;
        originals.set(clone, node);
        copies.set(node, clone);
        const editable = node.matches(
            "input:not([type=button]):not([type=submit]):not([type=reset]),textarea,[contenteditable]",
        );
        if (editable) {
            clone.removeAttribute("value");
            clone.removeAttribute("aria-valuenow");
            clone.removeAttribute("aria-valuetext");
        } else {
            for (const child of node.childNodes) {
                const next = copy(child);
                if (next) clone.appendChild(next);
            }
        }
        if (node.shadowRoot) {
            const shadow = clone.attachShadow({ mode: "open" });
            for (const child of node.shadowRoot.childNodes) {
                const next = copy(child);
                if (next) shadow.appendChild(next);
            }
        }
        return clone;
    };
    const tree = copy(document.documentElement);
    if (tree) mirror.replaceChild(tree, mirror.documentElement);
    const styles = new WeakMap<Element, CSSStyleDeclaration>();
    const style = (element: Element): CSSStyleDeclaration => {
        const original = originals.get(element) || element;
        let result = styles.get(original);
        if (!result) {
            result = getComputedStyle(original);
            styles.set(original, result);
        }
        return result;
    };
    const options = { getComputedStyle: style, computedStyleSupportsPseudoElements: false };
    const clean = (text: string, max: number) => text.replace(/\s+/gu, " ").trim().slice(0, max);
    const text: string[] = [];
    let textLength = 0;
    let visuals = 0;
    const candidates: { element: Element; line: string; priority: number; order: number }[] = [];
    const roles = new Set([
        "button",
        "link",
        "textbox",
        "searchbox",
        "checkbox",
        "radio",
        "switch",
        "combobox",
        "listbox",
        "option",
        "menuitem",
        "menuitemcheckbox",
        "menuitemradio",
        "tab",
        "slider",
        "spinbutton",
        "treeitem",
    ]);
    const walk = (node: Node | null, excluded = false): void => {
        if (!node) return;
        if (node.nodeType === Node.TEXT_NODE) {
            if (!excluded && textLength < 8000) {
                const value = clean(node.textContent || "", 8000 - textLength);
                if (value) {
                    text.push(value);
                    textLength += value.length + 1;
                }
            }
            return;
        }
        if (!(node instanceof Element) || !copies.has(node)) {
            if (node instanceof HTMLIFrameElement && node.getClientRects().length) visuals++;
            return;
        }
        const computed = style(node);
        if (
            node.hasAttribute("hidden") ||
            node.getAttribute("aria-hidden") === "true" ||
            computed.display === "none" ||
            computed.visibility === "hidden" ||
            computed.visibility === "collapse"
        )
            return;
        const editable = node.matches("input,textarea,[contenteditable]");
        const box = node.getBoundingClientRect();
        const visible = box.width > 0 && box.height > 0;
        if (visible && node.matches("canvas,img,svg")) visuals++;
        const role = getRole(node) || (node.matches("[contenteditable]") ? "textbox" : "generic");
        if (
            visible &&
            (roles.has(role) ||
                node.matches(
                    "a,button,input:not([type=hidden]),textarea,select,[tabindex]:not([tabindex='-1']),[contenteditable]",
                ))
        ) {
            const clone = copies.get(node)!;
            const name = clean(
                computeAccessibleName(clone, options) || node.getAttribute("placeholder") || "",
                160,
            );
            const description = clean(computeAccessibleDescription(clone, options), 120);
            const states: string[] = [];
            if (node.matches(":disabled") || node.closest('[aria-disabled="true"]'))
                states.push("disabled");
            if (node instanceof HTMLInputElement && ["checkbox", "radio"].includes(node.type))
                states.push(`checked=${node.indeterminate ? "mixed" : node.checked}`);
            else if (node.hasAttribute("aria-checked"))
                states.push(`checked=${clean(node.getAttribute("aria-checked")!, 16)}`);
            if (node instanceof HTMLOptionElement) states.push(`selected=${node.selected}`);
            else if (node.hasAttribute("aria-selected"))
                states.push(`selected=${clean(node.getAttribute("aria-selected")!, 16)}`);
            for (const state of ["expanded", "pressed", "invalid"]) {
                if (node.hasAttribute(`aria-${state}`))
                    states.push(`${state}=${clean(node.getAttribute(`aria-${state}`)!, 16)}`);
            }
            if (node.matches("[readonly],[aria-readonly='true']")) states.push("readonly");
            if (node.matches("[required],[aria-required='true']")) states.push("required");
            if (node instanceof HTMLInputElement) states.push(`type=${node.type}`);
            const inViewport =
                box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth;
            if (!inViewport) states.push("offscreen");
            const formControl =
                node.matches("button,input,textarea,select") ||
                ["textbox", "checkbox", "radio", "combobox"].includes(role);
            candidates.push({
                element: node,
                line: `${role} ${JSON.stringify(name)}${states.length ? ` [${states.join(", ")}]` : ""}${description ? ` description=${JSON.stringify(description)}` : ""}`,
                priority: (inViewport ? 0 : 2) + (formControl ? 0 : 1),
                order: candidates.length,
            });
        }
        for (const child of node.childNodes) walk(child, excluded || editable);
        if (node.shadowRoot)
            for (const child of node.shadowRoot.childNodes) walk(child, excluded || editable);
    };
    walk(document.body);
    // Visible form controls get budget before long navigation menus. Keep DOM
    // order in the returned snapshot and report every omitted control explicitly.
    candidates.sort((a, b) => a.priority - b.priority || a.order - b.order);
    const selected: typeof candidates = [];
    let budget = 14000;
    for (const candidate of candidates) {
        const cost = candidate.line.length + 32;
        if (selected.length < 200 && cost <= budget) {
            selected.push(candidate);
            budget -= cost;
        }
    }
    selected.sort((a, b) => a.order - b.order);
    return {
        metadata: {
            text: text.join("\n"),
            controls: selected.map((row) => row.line),
            omitted: candidates.length - selected.length,
            visuals,
            truncated: truncated || textLength >= 8000,
        },
        elements: selected.map((row) => row.element),
    };
}
