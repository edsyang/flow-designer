# ComfyUI scenario

## Composition

The ComfyUI app registers the scenario node set and `comfyuiTransformer`, then creates a generic document and renders the shared workbench. Its external workflow schema is isolated in `apps/comfyui/utils`.

## Typed node ports

The sample node set covers checkpoint loading, text encoding, sampling, VAE decoding, and image saving. Port data types distinguish `MODEL`, `CLIP`, `VAE`, `CONDITIONING`, `LATENT`, and `IMAGE`; matching colors are presentation metadata. The generic `sameDataType` validator is available, but the current ComfyUI app does not pass it through `graphOptions.connecting.connectionValidator`, so these type declarations do not currently block incompatible connections.

## Import/export contract

The transformer format is `comfyui-api`, with internal content type `comfyui`. Import maps external node IDs to generated internal IDs, copies non-array inputs into node props, and converts array-valued input links into internal edges with source and target port identifiers. Imported positions come from `_meta.position` when present, otherwise default to `{ x: 0, y: 0 }`.

Export assigns sequential external IDs to the current node order, serializes node class types, props, and positions, then writes edge links into target node inputs. This mapping does not promise to preserve original external IDs or arbitrary external fields that are not represented in the internal model.

## Constraints

- Keep ComfyUI API details in this scenario's transformer/types, not in the generic engine.
- Preserve port names and data-type semantics when changing node definitions or edge mapping.
- If enabling `sameDataType` in the app, treat it as an intentional interaction-policy change and add integration coverage for compatible and incompatible ComfyUI links.
- Test import, export, node ordering, and edge-to-input mapping when changing the transformer.

## Implementation and tests

Implementation: `apps/comfyui/utils/src/transformer.ts`, `apps/comfyui/utils/src/types.ts`, and `apps/comfyui/nodes/src/`. Transformer tests: `apps/comfyui/utils/__tests__/transformer.test.ts`.

Scenario links use port-tangent curves with no source or target arrow markers. Their typed or named semantic port identities remain fixed during node and edge editing.
