export interface KissopenCloudRequest {
    readonly method: "GET" | "POST";
    readonly path: string;
    readonly body?: Readonly<Record<string, unknown>>;
}
export interface KissopenCloudResponse {
    readonly status: number;
    readonly text: string;
}
