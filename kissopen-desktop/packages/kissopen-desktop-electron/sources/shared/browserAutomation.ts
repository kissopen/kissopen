/** Native capabilities only; no daemon wire objects or credentials enter the renderer. */
export type DesktopBrowserScope =
    | {
          readonly kind: "local";
          readonly agentId: string;
          readonly connectionId: string | null;
          readonly workspaceId: string;
      }
    | { readonly kind: "relay"; readonly sessionId: string; readonly workspaceId: string };
export type DesktopBrowserAutomationEvent =
    | {
          readonly kind: "pointer";
          readonly bindingId: string;
          readonly tabId: string;
          readonly operationId: string;
          readonly action: "click" | "fill" | "scroll";
          readonly phase: "start" | "end";
          readonly x: number;
          readonly y: number;
      }
    | {
          readonly kind: "open";
          readonly bindingId: string;
          readonly tabId: string;
          readonly url: string;
      }
    | {
          readonly kind: "state";
          readonly bindingId: string;
          readonly tabId: string;
          readonly state: "active" | "paused" | "closed";
          readonly message?: string;
      };
export type DesktopBrowserAutomationAction = "pause" | "resume" | "close";
