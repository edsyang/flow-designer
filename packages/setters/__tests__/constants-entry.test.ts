// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { BuiltinSetters } from '../src/constants';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRequire = createRequire(resolve(packageRoot, '../../package.json'));
const fixture = realpathSync(mkdtempSync(join(tmpdir(), 'flow-setter-constants-')));
const installedPackage = join(fixture, 'node_modules/@flow-designer/setters');
const env = { ...process.env, NODE_PATH:'' };

beforeAll(() => {
  cpSync(join(packageRoot, 'dist'), join(installedPackage, 'dist'), { recursive:true });
  cpSync(join(packageRoot, 'package.json'), join(installedPackage, 'package.json'));
  for (const file of ['constants.ts', 'builtin-setters.ts']) cpSync(join(packageRoot, 'src', file), join(installedPackage, 'src', file), { recursive:true });
  writeFileSync(join(fixture, 'package.json'), JSON.stringify({ private:true, type:'module' }));
});
afterAll(() => { rmSync(fixture, { recursive:true, force:true }); });

function node(script: string, name: string): string {
  const path = join(fixture, name);
  writeFileSync(path, script);
  return execFileSync(process.execPath, [path], { cwd:fixture, env, encoding:'utf8' });
}

describe('published constants-only entry', () => {
  it('loads in independent ESM and CommonJS consumers with no React, Ant Design or model installed', () => {
    const esm = node("import { BuiltinSetters } from '@flow-designer/setters/constants'; console.log(JSON.stringify(BuiltinSetters));", 'consumer.mjs');
    const cjs = node("const { BuiltinSetters } = require('@flow-designer/setters/constants'); console.log(JSON.stringify(BuiltinSetters));", 'consumer.cjs');
    expect(JSON.parse(esm)).toEqual(BuiltinSetters);
    expect(JSON.parse(cjs)).toEqual(BuiltinSetters);
  });

  it('resolves literal identifier declarations for both NodeNext ESM and CommonJS', () => {
    const consumer = `import { BuiltinSetters, type BuiltinSetterName } from '@flow-designer/setters/constants';
const setter: BuiltinSetterName = BuiltinSetters.String;
const exact: 'StringSetter' = BuiltinSetters.String;
// @ts-expect-error Unknown identifiers must remain invalid.
const invalid: BuiltinSetterName = 'UnknownSetter';
void setter; void exact; void invalid;
`;
    writeFileSync(join(fixture, 'consumer.mts'), consumer);
    writeFileSync(join(fixture, 'consumer.cts'), consumer);
    const output = execFileSync(process.execPath, [workspaceRequire.resolve('typescript/bin/tsc'), '--noEmit', '--strict', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2020', 'consumer.mts', 'consumer.cts'], { cwd:fixture, env, encoding:'utf8' });
    expect(output).toBe('');
  });

  it.each(['built', 'source'])('bundles the %s condition without including or importing UI modules', (condition) => {
    writeFileSync(join(fixture, 'entry.js'), "export { BuiltinSetters } from '@flow-designer/setters/constants';");
    const constantsPath = join(installedPackage, 'dist/constants.mjs');
    const entryPath = join(fixture, 'entry.js');
    const config = {
      configFile:false, root:fixture, logLevel:'silent',
      resolve:{ conditions:condition === 'source' ? ['source'] : [] },
      build:{ lib:{ entry:entryPath, formats:['es','cjs'], fileName:'consumer' }, outDir:join(fixture, 'bundle'), minify:false },
    };
    const plugin = `[{ name:'assert-isolated-constants', generateBundle(_options,bundle) {
      const allowed = new Set(${JSON.stringify((condition === 'source' ? [join(installedPackage,'src/constants.ts'), join(installedPackage,'src/builtin-setters.ts'), entryPath] : [constantsPath,entryPath]).map(path => path.split(sep).join('/')))});
      for (const chunk of Object.values(bundle)) if (chunk.type === 'chunk') {
        if (chunk.imports.length || chunk.dynamicImports.length) throw new Error('Unexpected external imports');
        for (const id of Object.keys(chunk.modules)) if (!allowed.has(id)) throw new Error('Unexpected bundled dependency: ' + id);
      }
    }}]`;
    writeFileSync(join(fixture, 'vite.config.mjs'), 'export default ' + JSON.stringify(config).replace(/}$/, ', plugins:' + plugin + '}'));
    const cli = resolve(dirname(workspaceRequire.resolve('vite/package.json')), 'bin/vite.js');
    execFileSync(process.execPath, [cli, 'build', '--config', join(fixture, 'vite.config.mjs')], { cwd:fixture, env, encoding:'utf8' });
    for (const name of ['consumer.js','consumer.cjs']) {
      const code = readFileSync(join(fixture, 'bundle', name), 'utf8');
      expect(code).toContain('StringSetter');
      expect(code).not.toMatch(/react|antd|flow-designer\/model|require\(/i);
    }
  }, 15000);
});
