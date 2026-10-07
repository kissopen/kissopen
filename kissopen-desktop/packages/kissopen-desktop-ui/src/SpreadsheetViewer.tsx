import { t } from "kissopen-desktop-state";
import { useCallback, useState } from "react";
import { read, utils, type WorkBook } from "xlsx";
import { DocumentViewerNotice, documentBytesRead } from "./DocumentViewerNotice";

export type SpreadsheetViewerProps = {
    /** Where the workbook's bytes are: an app-served address or an object URL. */
    url: string;
    name: string;
};

/**
 * How many rows of a sheet are shown. A table of hundreds of thousands of rows
 * is not something to read in a panel, and drawing it would stall the window;
 * the notice under the table says the rest exists.
 */
const SHEET_ROWS_SHOWN = 2_000;

type SheetState =
    | { readonly status: "loading" }
    | { readonly status: "ready"; readonly workbook: WorkBook }
    | { readonly status: "error"; readonly message: string };

/**
 * C-296c SpreadsheetViewer — a workbook as tables, one sheet at a time, with
 * SheetJS. It reads Excel (xlsx, xlsm, xlsb, xls), OpenDocument and WPS sheets.
 * Formulas show their last computed values, as a spreadsheet shows them.
 */
export function SpreadsheetViewer(props: SpreadsheetViewerProps) {
    const [state, setState] = useState<SheetState>({ status: "loading" });
    const [sheet, setSheet] = useState(0);
    const { url } = props;
    const load = useCallback(
        (node: HTMLDivElement | null) => {
            if (node === null) return undefined;
            let cancelled = false;
            setState({ status: "loading" });
            setSheet(0);
            void documentBytesRead(url)
                .then((bytes) => {
                    if (cancelled) return;
                    // One extra row is read, so the table knows when there are more.
                    const workbook = read(bytes, {
                        type: "array",
                        cellDates: true,
                        sheetRows: SHEET_ROWS_SHOWN + 1,
                    });
                    setState({ status: "ready", workbook });
                })
                .catch((error: unknown) => {
                    if (cancelled) return;
                    setState({
                        status: "error",
                        message: error instanceof Error ? error.message : String(error),
                    });
                });
            return () => {
                cancelled = true;
            };
        },
        [url],
    );
    const workbook = state.status === "ready" ? state.workbook : undefined;
    const names = workbook?.SheetNames ?? [];
    const current = names[Math.min(sheet, Math.max(0, names.length - 1))];
    const worksheet = current === undefined ? undefined : workbook?.Sheets[current];
    const rows = worksheet?.["!ref"] ? utils.decode_range(worksheet["!ref"]).e.r + 1 : 0;
    return (
        <div
            className="kissopen-document-viewer"
            data-kissopen-desktop-ui="spreadsheet-viewer"
            ref={load}
        >
            {state.status === "ready" ? null : (
                <DocumentViewerNotice
                    name={props.name}
                    state={state.status === "error" ? { error: state.message } : "loading"}
                />
            )}
            {worksheet === undefined ? null : (
                <>
                    <div
                        className="kissopen-document-viewer__scroll kissopen-document-viewer__scroll--sheet"
                        // SheetJS escapes every cell's text in the table it writes.
                        dangerouslySetInnerHTML={{
                            __html: utils.sheet_to_html(worksheet, { header: "", footer: "" }),
                        }}
                    />
                    {rows > SHEET_ROWS_SHOWN ? (
                        <p className="kissopen-document-viewer__more">
                            {t("Showing the first {count} rows.", { count: SHEET_ROWS_SHOWN })}
                        </p>
                    ) : null}
                    {names.length > 1 ? (
                        <div className="kissopen-document-viewer__sheets" role="tablist">
                            {names.map((name, index) => (
                                <button
                                    aria-selected={name === current}
                                    className="kissopen-document-viewer__sheet"
                                    key={name}
                                    onClick={() => setSheet(index)}
                                    role="tab"
                                    type="button"
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    ) : null}
                </>
            )}
        </div>
    );
}
