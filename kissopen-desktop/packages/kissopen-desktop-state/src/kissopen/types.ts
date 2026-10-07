// Wire shapes come from the server's own types (internal/api) through the
// generated api.gen.ts; nothing here restates one. Only client-side helpers
// and the names this package has always used live in this file.
import { t } from "../i18n/locale.js";
import type { LibraryItem, Status } from "./api.gen.js";

export type * from "./api.gen.js";

/** A file or picture in the library, as `/files` lists it. */
export type FileItem = LibraryItem;

export const isActive = (status: Status | string) =>
    ["queued", "running", "planning"].includes(status);
export const statusLabel: Record<string, string> = {
    planning: t("正在规划"),
    awaiting_approval: t("等待确认"),
    queued: t("排队中"),
    running: t("执行中"),
    completed: t("已完成"),
    failed: t("未完成"),
    cancelled: t("已停止"),
};
