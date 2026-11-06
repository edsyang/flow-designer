/** Built public-entry characterization, not a workspace build or browser test.
 * Run after pnpm build: node scripts/check-core-baseline.mjs
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(path.join(tmpdir(), "flow-core-baseline-"));
const fixture = JSON.parse(
  await readFile(new URL("fixtures/core-baseline-document.json", import.meta.url), "utf8"),
);
const results = [];
async function run(name, code, extension = "mjs") {
  const filename = path.join(temporary, `${name}.${extension}`);
  await writeFile(filename, code);
  const output = execFileSync(process.execPath, [filename], { encoding: "utf8" });
  results.push({ name, result: "pass", detail: output.trim() });
}
try {
  await mkdir(path.join(temporary, "node_modules/@flow-designer"), { recursive: true });
  for (const name of ["model", "core", "engine", "setters", "skeleton"]) {
    await symlink(
      path.join(root, "packages", name),
      path.join(temporary, "node_modules/@flow-designer", name),
      "dir",
    );
  }
  const behavior = `
    assert.equal(typeof window, 'undefined');
    assert.equal(typeof document, 'undefined');
    for (const name of ['Document','GenericContent','defineNode','Timeline','canUsePort']) assert.equal(typeof model[name], 'function', name);
    for (const name of ['Editor','CommandRegistry','PluginManager']) assert.equal(typeof core[name], 'function', name);
    assert.equal('createContent' in core, false);
    assert.equal('t' in model, false);
    const headlessEditor = new core.Editor();
    assert.equal('getSkeleton' in headlessEditor, false);
    assert.equal('setSkeleton' in headlessEditor, false);
    const headlessPlugins = new core.PluginManager(headlessEditor);
    let headlessInitialized = false;
    try {
      await headlessPlugins.register(ctx => {
        assert.equal(ctx.editor, headlessEditor);
        assert.equal('skeleton' in ctx, false);
        return {name:'headless-consumer',init(){headlessInitialized=true;}};
      });
      await headlessPlugins.init();
      assert.equal(headlessInitialized, true);
    } finally {await headlessPlugins.dispose();}

    model.contentTypesRegistry.register(model.GenericContent);
    model.prototypeRegistry.register(model.defineNode({meta:{name:'Unknown',typeName:'Unknown'},view:{type:'node'},schema:[],editor:[]}));
    model.prototypeRegistry.register(model.defineNode({meta:{name:'Task',typeName:'BaselineTask'},view:{type:'node'},schema:[],editor:[]}));
    const fixture = ${JSON.stringify(fixture)};
    const doc = new model.Document(structuredClone(fixture));
    try {
      assert.deepEqual(doc.getData(), fixture);
      doc.getSelection().setKeys(['a']);
      assert.equal('selection' in doc.getData(), false);
      const original = doc.getData();
      await doc.transaction('gesture', () => {
        doc.getContent().getNode('a').setPosition(50,60);
        doc.getContent().getNode('a').getRelation().updateEdge('curve',{targetPort:'alternate-input',vertices:[{x:170,y:90}]});
      });
      assert.equal(doc.getTimeline().getPoints().length,2);
      assert.equal(doc.getTimeline().isModified(),true);
      const changed=doc.getData();
      assert.equal(changed.elements.find(item=>item.id==='curve').typeName,'BaselineCurve');
      doc.getTimeline().back();assert.deepEqual(doc.getData(),original);
      doc.getTimeline().forward();assert.deepEqual(doc.getData(),changed);
      const detached=doc.getData();detached.elements.find(item=>item.id==='curve').vertices[0].x=999;
      assert.deepEqual(doc.getData(),changed);
      const saved=doc.save();assert.deepEqual(saved,changed);assert.equal(doc.getTimeline().isModified(),false);
      const restored=new model.Document(structuredClone(fixture));
      try {restored.load(saved);assert.deepEqual(restored.getData(),changed);assert.equal(restored.getTimeline().isModified(),false);assert.equal(restored.getTimeline().getPoints().length,1);}finally{restored.destroy();}
      const commands=new core.CommandRegistry();const answer=Promise.resolve('result');commands.register('baseline',()=>answer);assert.equal(commands.executeCommand('baseline'),answer);assert.equal(await answer,'result');
      console.log('public exports, headless plugin lifecycle, serialization, transient selection, gesture undo/redo, detached snapshots, save/load, command promise PASS');
    } finally {doc.destroy();}
  `;
  await run(
    "esm-domain-core",
    `import assert from 'node:assert/strict';import * as model from '@flow-designer/model';import * as core from '@flow-designer/core';${behavior}`,
  );
  await run(
    "cjs-domain-core",
    `const assert=require('node:assert/strict');const model=require('@flow-designer/model');const core=require('@flow-designer/core');(async()=>{${behavior}})().catch(error=>{console.error(error);process.exitCode=1;});`,
    "cjs",
  );
  // These are known limitations, asserted explicitly rather than counted as successful Node engine consumption.
  await run(
    "esm-engine-node-limitation",
    `import assert from 'node:assert/strict';await assert.rejects(import('@flow-designer/engine'),error=>error.code==='ERR_UNKNOWN_FILE_EXTENSION'&&error.message.includes('.css'));console.log('KNOWN LIMITATION: native Node ESM engine import requires a CSS-aware browser bundler');`,
  );
  await run(
    "cjs-engine-node-limitation",
    `const assert=require('node:assert/strict');assert.throws(()=>require('@flow-designer/engine'),error=>error instanceof SyntaxError&&error.stack.includes('.css'));console.log('KNOWN LIMITATION: native Node CJS engine import cannot parse transitive CSS');`,
    "cjs",
  );
  const consumer = `import {Document,defineNode,type DocumentData} from '@flow-designer/model';
import {Editor,CommandRegistry,type IPluginContext} from '@flow-designer/core';
import {createDesigner,type DesignerOptions,type PaneConfig as EnginePaneConfig,type ISkeleton as EngineSkeleton,type IArea as EngineArea} from '@flow-designer/engine';
import type {PaneConfig,ISkeleton,IArea} from '@flow-designer/skeleton';
// @ts-expect-error UI contracts no longer belong to the document model.
import type {PaneConfig as RemovedModelPane} from '@flow-designer/model';
// @ts-expect-error Check each removed export independently.
import type {ISkeleton as RemovedModelSkeleton} from '@flow-designer/model';
// @ts-expect-error Check each removed export independently.
import type {IArea as RemovedModelArea} from '@flow-designer/model';
import {BuiltinSetters} from '@flow-designer/setters/constants';
const data:DocumentData={id:'test',documentType:'*',documentVersion:'1'};
void [Document,defineNode,Editor,CommandRegistry,createDesigner,BuiltinSetters,data];
const options:DesignerOptions={documentType:"*",documentVersion:"1"};void options;
const pane = {key:'consumer-pane',area:'header',content:'Panel',contentProps:{title:'Consumer'}} satisfies PaneConfig;
declare const skeleton:ISkeleton;
const area:IArea=skeleton.header;
area.add(pane);
const unregister:()=>void=area.hooks.didMount(container=>{
  const element:HTMLElement=container;void element;
  return ()=>{};
});void unregister;
const enginePane:EnginePaneConfig=pane;
const engineSkeleton:EngineSkeleton=skeleton;
const engineArea:EngineArea=area;
const directPane:PaneConfig=enginePane;
const directSkeleton:ISkeleton=engineSkeleton;
const directArea:IArea=engineArea;
void [directPane,directSkeleton,directArea];
type Assert<T extends true>=T;
// Structural assignments alone would accept a mistakenly emitted any export.
type PublicUiContracts=[
  Assert<0 extends (1 & PaneConfig) ? false : true>,
  Assert<0 extends (1 & ISkeleton) ? false : true>,
  Assert<0 extends (1 & IArea) ? false : true>,
  Assert<'skeleton' extends keyof IPluginContext ? false : true>
];
const publicUiContracts:PublicUiContracts=[true,true,true,true];void publicUiContracts;`;
  await writeFile(path.join(temporary, "consumer.mts"), consumer);
  await writeFile(path.join(temporary, "consumer.cts"), consumer);
  await writeFile(
    path.join(temporary, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2020",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ["consumer.mts", "consumer.cts"],
    }),
  );
  execFileSync(
    process.execPath,
    [
      path.join(root, "node_modules/typescript/bin/tsc"),
      "-p",
      path.join(temporary, "tsconfig.json"),
    ],
    { stdio: "inherit" },
  );
  results.push({
    name: "public-types-nodenext",
    result: "pass",
    detail:
      "ESM/CJS consumers; skeleton UI contracts and engine facade, removed model UI exports, headless core context; skipLibCheck=true characterizes consumer exports, not dependency declaration correctness",
  });
  const generators = {
    generic: "generateGenericNodeDef",
    bpmn: "generateBpmnNodeDef",
    er: "generateERNodeDef",
    comfyui: "generateComfyUINodeDef",
  };
  for (const [kind, exported] of Object.entries(generators)) {
    const generator = await import(
      pathToFileURL(path.join(root, "tools/create-node/dist/templates", `${kind}.js`)).href
    );
    const generated = generator[exported]({ kebabName: `baseline-${kind}`, category: "tasks" });
    assert.match(generated, /@flow-designer\/model/);
    assert.match(generated, /@flow-designer\/setters\/constants/);
    await writeFile(path.join(temporary, `${kind}.ts`), generated);
  }
  await writeFile(
    path.join(temporary, "scaffold-tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ["generic.ts", "bpmn.ts", "er.ts", "comfyui.ts"],
    }),
  );
  execFileSync(
    process.execPath,
    [
      path.join(root, "node_modules/typescript/bin/tsc"),
      "-p",
      path.join(temporary, "scaffold-tsconfig.json"),
    ],
    { stdio: "inherit" },
  );
  results.push({
    name: "scaffold-generated-consumers",
    result: "pass",
    detail:
      "all four built generators produce strictly typed definitions consuming model and setters/constants with bundler resolution; no generated package installation/publishing claimed",
  });
  console.log(JSON.stringify({ node: process.version, results }, null, 2));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
