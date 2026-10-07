/*
Installs the shared sync package's platform for tests.

Node's implementation rather than the app's: the app's is native modules that
do not exist outside a device, and the point of these tests is the logic above
that seam. The bytes match — the package's own tests prove the two
implementations agree on the wire format.
*/
import { syncPlatformInstall } from '@kissopen/kissopen-sync/platform';
import { nodePlatform } from '@kissopen/kissopen-sync/node';

syncPlatformInstall(await nodePlatform());
