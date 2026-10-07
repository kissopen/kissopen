/*
Opening a file from the account's library.

The library is on the business server; what this machine has is the file's
signed address. So the bytes are fetched from there, land in a copy under the
file's own name, and go to whatever this machine opens that kind of file with —
the same road a file on another machine takes, and the same list of what is
worth opening. Only the account's own server is fetched from: the address comes
from the window, and a window is not trusted to name a host.
*/
import { t } from "kissopen-desktop-state/i18n";
import { shell } from "electron";
import { kissopenCloudBaseUrl } from "./kissopenCloud";
import { relayFileOpenWith } from "./relay/relayFileOpen";
import type { RelayCommandResult } from "../shared/relayContract";

export async function kissopenFileOpen(url: string, name: string): Promise<RelayCommandResult> {
    let address: URL;
    try {
        address = new URL(url);
    } catch {
        return { ok: false, error: t("这个文件没有地址") };
    }
    if (address.origin !== new URL(kissopenCloudBaseUrl()).origin) {
        return { ok: false, error: t("只打开账号服务器上的文件") };
    }
    try {
        await relayFileOpenWith(
            name,
            async () => {
                const response = await fetch(address);
                if (!response.ok) throw new Error(t("文件读取失败（{status}）", { status: response.status }));
                return new Uint8Array(await response.arrayBuffer());
            },
            (path) => shell.openPath(path),
        );
        return { ok: true };
    } catch (error) {
        return { ok: false, error: (error as Error).message };
    }
}
