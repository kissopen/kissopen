/*
Hands the shared sync package this app's primitives, before anything uses it.

Imported for its effect, from the entry point, ahead of the router. The package
refuses to work until this has run — deliberately, so a missed wiring fails at
startup rather than producing ciphertext nobody can read.
*/
import { syncPlatformInstall } from '@kissopen/kissopen-sync/platform';
import { appSyncPlatform } from './syncPlatform';

syncPlatformInstall(appSyncPlatform);
