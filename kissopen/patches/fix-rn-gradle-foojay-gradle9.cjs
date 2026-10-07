/**
 * Removes the Foojay toolchain resolver from @react-native/gradle-plugin.
 *
 * Expo's prebuild generates a Gradle 9.0 wrapper, but React Native 0.83.1 applies
 * the Foojay resolver in its own settings.gradle.kts. Every published version of
 * that plugin, 0.5.0 through 0.10.0, references JvmVendorSpec.IBM_SEMERU, and
 * Gradle 9 deleted that field — 9.0's JvmVendorSpec keeps IBM but not IBM_SEMERU.
 * So the Android build dies during settings evaluation, before any task runs:
 *
 *   Class org.gradle.jvm.toolchain.JvmVendorSpec does not have member field
 *   'org.gradle.jvm.toolchain.JvmVendorSpec IBM_SEMERU'
 *
 * Bumping the resolver does not help; it has to go. Its only job is downloading a
 * JDK on demand, and our builds supply one through JAVA_HOME, so nothing is lost.
 *
 * Remove this patch once React Native ships a resolver that understands Gradle 9.
 */
const fs = require('fs');
const path = require('path');

const files = [
    'node_modules/@react-native/gradle-plugin/settings.gradle.kts',
    'packages/kissopen-app/node_modules/@react-native/gradle-plugin/settings.gradle.kts',
];

const LINE = /^plugins \{ id\("org\.gradle\.toolchains\.foojay-resolver-convention"\)\.version\("[^"]+"\) \}$/m;
const NOTE =
    '// Removed by patches/fix-rn-gradle-foojay-gradle9.cjs: every published foojay-resolver\n' +
    '// references JvmVendorSpec.IBM_SEMERU, which Gradle 9 deleted. The JDK comes from JAVA_HOME.';

for (const relative of files) {
    const file = path.resolve(__dirname, '..', relative);
    if (!fs.existsSync(file)) continue;
    const before = fs.readFileSync(file, 'utf8');
    if (!LINE.test(before)) continue;
    fs.writeFileSync(file, before.replace(LINE, NOTE));
    console.log('[patch] dropped foojay resolver from ' + relative);
}
