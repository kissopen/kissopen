import type { JobEvent, Message } from "./types";
import { t } from '@/text';

export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function validateOrigin(raw: string, development: boolean): string {
  const url = new URL(raw);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(t('kissopen.errors.serverMustBeHost'));
  if (url.protocol !== "https:" && !(development && url.protocol === "http:"))
    throw new Error(t('kissopen.errors.httpsRequired'));
  return url.origin;
}
// A snapshot's seq and messages are read atomically by Go. Ignore replayed events.
export function applyEvents(
  messages: Message[],
  cursor: number,
  events: JobEvent[],
) {
  const next = messages.map((m) => ({ ...m }));
  for (const event of events) {
    if (event.seq <= cursor) continue;
    const payload = JSON.parse(event.data);
    const assistant = [...next].reverse().find((m) => m.role === "assistant");
    if (assistant && event.kind === "delta" && typeof payload.text === "string")
      assistant.content += payload.text;
    if (assistant && event.kind === "status") assistant.status = payload.status;
    cursor = event.seq;
  }
  return { messages: next, cursor };
}
export function safeURL(raw: string): string {
  const url = new URL(raw);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error(t('kissopen.errors.unsupportedLink'));
  return url.href;
}
