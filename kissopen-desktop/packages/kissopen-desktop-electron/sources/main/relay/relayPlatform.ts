/*
Gives the shared sync core the primitives Node has.

Separate from the rest of the relay code, and free of Electron, because
forgetting this is exactly the mistake it guards against: the package refuses
to work until a platform is installed, and the first thing the reader does is
decode a base64 secret. Without this, every start failed with "kissopen-sync
has no platform installed" — correctly, and where nobody could see it.

Installed once. libsodium needs one await before it will do anything, so this
is asynchronous here and instant afterwards.
*/
import { syncPlatformInstall } from "@kissopen/kissopen-sync/platform";
import { nodePlatform } from "@kissopen/kissopen-sync/node";

let installing: Promise<void> | undefined;

/** Resolves once the shared core can be used. Safe to call repeatedly. */
export function relayPlatformReady(): Promise<void> {
    installing ??= nodePlatform().then(syncPlatformInstall);
    return installing;
}
