// Wire shapes come from the server's own types (internal/api) through the
// generated api.gen.ts; nothing here restates one. Only client-side shapes and
// helpers live in this file.
import type { LibraryItem, Status } from "./api.gen";
import { t } from '@/text';

export type * from "./api.gen";

/** A file or picture in the library, as `/files` lists it. */
export type FileItem = LibraryItem;

/** A picture picked on this device, before and after it is uploaded. */
export type CloudImage = {
  id: string;
  name: string;
  uri: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
};
export const isActive = (status: Status | string) =>
  ["queued", "running", "planning"].includes(status);
export const statusLabel: Record<string, string> = {
  planning: t('kissopen.taskStatus.planning'),
  awaiting_approval: t('kissopen.taskStatus.awaitingConfirmation'),
  queued: t('kissopen.taskStatus.queued'),
  running: t('kissopen.taskStatus.running'),
  completed: t('kissopen.taskStatus.completed'),
  failed: t('kissopen.taskStatus.incomplete'),
  cancelled: t('kissopen.taskStatus.stopped'),
};
