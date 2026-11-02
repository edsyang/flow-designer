# Node package scaffolding

## Purpose and inputs

`@flow-designer/create-node` is an interactive CLI that collects a kebab-case node name, a template preset, a category, and an output directory. Supported presets are BPMN, ComfyUI, ER, and generic.

## Generated files

The CLI emits a package manifest, TypeScript/Vite/Vitest configuration, a node definition, a public index, and a test. Scenario presets choose their own node/index/test templates; common config generation is shared.

The generated package uses strict TypeScript settings and builds ESM/CJS library outputs with declaration files. External React and framework packages are marked as bundler externals by the generated Vite config.

## Constraints

- Keep prompt validation, preset-specific output, and common config templates clearly separated.
- Generated package metadata and imports must remain compatible with current framework exports.
- Update template tests when generated filenames, package scripts, runtime dependencies, or output contracts change.

## Implementation and tests

Implementation: `tools/create-node/src/index.ts`, `src/templates/`, and `src/utils.ts`.

## Setter identifier imports

Generated node definitions import `BuiltinSetters` from `@flow-designer/setters/constants`. These identifiers are schema metadata: using them must not evaluate property-editor controls or UI runtimes. The string values and `BuiltinSetterName` literal union remain compatible with the main package exports and the setter registry. The lightweight entry does not register setters; runtime composition owns registration before rendering settings.

The constants subpath has workspace source resolution and independent ESM/CommonJS runtime and declaration outputs. Its CommonJS declaration uses `.d.cts` so NodeNext consumers do not mistakenly resolve an ESM-only declaration. Existing main-package imports remain supported. Changes must check all three scenario node packages and BPMN, ComfyUI, ER and generic scaffolding presets.

Verification: `packages/setters/__tests__/constants-entry.test.ts` installs the built package into an isolated temporary consumer without UI dependencies, executes ESM and CommonJS imports, typechecks `.mts` and `.cts` NodeNext consumers, and bundles both the built and source conditions while checking that their module graphs contain only the identifier module(s). `tools/create-node/__tests__/create-node.test.ts` checks the lightweight import in every preset. These packaging tests require the setters package to be built first, as in the workspace build-then-test workflow.
