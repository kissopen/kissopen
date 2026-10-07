/*
Installs the Node platform before any test runs.

The package refuses to work without one, on purpose. Doing it here rather than
in each test file means a test that forgets is a test that fails loudly.
*/
import { syncPlatformInstall } from '../platform';
import { nodePlatform } from '../platformNode';

syncPlatformInstall(await nodePlatform());
