const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { releaseInput, checkManifest, checkVersionOutput, checkPackage } = require('./cli-release.cjs');

test('stable and beta releases have explicit, distinct channels and CLI tags', () => {
  assert.deepEqual(releaseInput('1.2.4-beta.0', 'beta'), {
    version: '1.2.4-beta.0', channel: 'beta', tag: 'cli-1.2.4-beta.0', tarball: 'kissopen-1.2.4-beta.0.tgz',
  });
  assert.equal(releaseInput('1.2.4', 'latest').tag, 'cli-1.2.4');
});

test('rejects unsafe versions, wrong channels, and noncanonical semver', () => {
  for (const [version, channel] of [
    ['1.2.4-beta.0', 'latest'], ['1.2.4', 'beta'], ['1.2.4-rc.0', 'beta'],
    ['01.2.4', 'latest'], ['1.2.4-beta.01', 'beta'], ['v1.2.4', 'latest'],
    ['1.2.4\n', 'latest'], ['1.2.4; echo bad', 'latest'], ['1.2.4', 'next'],
  ]) assert.throws(() => releaseInput(version, channel), `${version} / ${channel}`);
});

const manifest = () => ({
  name: 'kissopen', version: '1.2.4-beta.0',
  repository: { url: 'git+https://github.com/slopus/happy.git' },
  dependencies: { zod: '^4.0.0' },
  devDependencies: { '@kissopen/kissopen-wire': 'workspace:*' },
});

test('accepts bundled wire dev dependency but rejects runtime workspace dependencies', () => {
  checkManifest(manifest(), '1.2.4-beta.0');
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    const pkg = manifest();
    pkg[field] = { '@kissopen/kissopen-wire': '0.1.0' };
    assert.throws(() => checkManifest(pkg, pkg.version), /kissopen-wire/);
  }
  for (const spec of ['workspace:*', 'file:../x', 'link:../x']) {
    const pkg = manifest();
    pkg.dependencies.other = spec;
    assert.throws(() => checkManifest(pkg, pkg.version), /Unresolved/);
  }
});

test('rejects the wrong package, version, and provenance repository', () => {
  for (const overrides of [
    { name: 'kissopen-agent' }, { version: '1.2.3' }, { repository: { url: 'https://github.com/other/kissopen' } },
  ]) assert.throws(() => checkManifest({ ...manifest(), ...overrides }, '1.2.4-beta.0'));
});

test('checks the Kissopen version, not the bundled Claude version or a substring', () => {
  checkVersionOutput('kissopen version: 1.2.4-beta.0\nUsing Claude Code v2.1.224\n2.1.224 (Claude Code)\n', '1.2.4-beta.0');
  assert.throws(() => checkVersionOutput('kissopen version: 1.2.3\n1.2.4-beta.0 (Claude Code)\n', '1.2.4-beta.0'));
  assert.throws(() => checkVersionOutput('kissopen version: 1.2.4-beta.01\n', '1.2.4-beta.0'));
});

function packageFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kissopen-release-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const directory of ['bin', 'dist', 'tools/archives']) fs.mkdirSync(path.join(root, directory), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    ...manifest(), bin: { kissopen: './bin/kissopen.mjs', 'kissopen-mcp': './bin/kissopen-mcp.mjs' },
  }));
  for (const file of ['bin/kissopen.mjs', 'bin/kissopen-mcp.mjs', 'dist/index.mjs', 'dist/index.cjs', 'dist/lib.mjs', 'dist/lib.cjs']) {
    fs.writeFileSync(path.join(root, file), '');
  }
  for (const tool of ['ripgrep', 'difftastic']) {
    for (const platform of ['arm64-darwin', 'x64-darwin', 'arm64-linux', 'x64-linux', 'arm64-win32', 'x64-win32']) {
      fs.writeFileSync(path.join(root, 'tools/archives', `${tool}-${platform}.tar.gz`), '');
    }
  }
  return root;
}

test('packaging gate rejects runtime wire imports but accepts the embedded manifest', t => {
  const root = packageFixture(t);
  const bundle = path.join(root, 'dist/index.mjs');
  fs.writeFileSync(bundle, 'const packageJson = {devDependencies: {"@kissopen/kissopen-wire": "workspace:*"}};');
  checkPackage(root, '1.2.4-beta.0');
  for (const source of [
    'import { x } from "@kissopen/kissopen-wire";', 'const x = require("@kissopen/kissopen-wire");',
    'await import("@kissopen/kissopen-wire");', 'export { x } from "@kissopen/kissopen-wire/subpath";',
    'import "@kissopen/kissopen-wire";',
  ]) {
    fs.writeFileSync(bundle, source);
    assert.throws(() => checkPackage(root, '1.2.4-beta.0'), /Runtime kissopen-wire import/);
  }
});

test('packaging gate requires CLI entrypoints and every platform tool archive', t => {
  const root = packageFixture(t);
  fs.unlinkSync(path.join(root, 'bin/kissopen.mjs'));
  assert.throws(() => checkPackage(root, '1.2.4-beta.0'), /Missing kissopen entrypoint/);
  fs.writeFileSync(path.join(root, 'bin/kissopen.mjs'), '');
  fs.unlinkSync(path.join(root, 'tools/archives/ripgrep-x64-win32.tar.gz'));
  assert.throws(() => checkPackage(root, '1.2.4-beta.0'), /Missing ripgrep archive for x64-win32/);
});

test('packaging gate refuses to include the separately released server runtime', t => {
  const root = packageFixture(t);
  fs.mkdirSync(path.join(root, 'tools/server'));
  assert.throws(() => checkPackage(root, '1.2.4-beta.0'), /kissopen-server-self-host/);
});