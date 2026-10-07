const { execSync } = require('child_process');

// Apply patches to node_modules
require('../patches/fix-pglite-prisma-bytes.cjs');
require('../patches/fix-livekit-room-reuse.cjs');
require('../patches/expose-pierre-diffs-style.cjs');
require('../patches/force-preact-cjs.cjs');
require('../patches/fix-pierre-trees-preact-hooks.cjs');
require('../patches/fix-react-native-audio-api-size-t.cjs');
require('../patches/fix-rn-gradle-foojay-gradle9.cjs');
require('../patches/fix-expo-router-action-subtitle-ios16.cjs');

if (process.env.SKIP_KISSOPEN_WIRE_BUILD === '1') {
  console.log('[postinstall] SKIP_KISSOPEN_WIRE_BUILD=1, skipping @kissopen/kissopen-wire build');
  process.exit(0);
}

execSync('pnpm --filter @kissopen/kissopen-wire build', {
  stdio: 'inherit',
});
