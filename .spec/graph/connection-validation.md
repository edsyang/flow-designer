# Connection validation

## Ownership and call path

The scenario app chooses semantic compatibility policy; `packages/graph` adapts that policy to X6. `GraphOptions.connecting.connectionValidator` is optional. When supplied, X6's `validateConnection` callback resolves each endpoint's cell ID and port ID, looks up the corresponding registered `PortDefinition`, builds a `ConnectionContext`, and returns the validator's synchronous boolean result.

The context always has `sourceNode` and `targetNode` strings. If X6 supplies no endpoint cell, the graph adapter currently uses an empty string for that node ID. `sourcePort` and `targetPort` are `PortDefinition | null`; absent or unresolvable port IDs become `null`. Port lookup accepts either the declared port ID or the generated `${group}-${position}` ID used when a definition omits `id`.

If no semantic validator is configured, the graph adapter returns `true`. This means only that the application adds no extra semantic rejection; X6's other connection rules remain active.

## Independent X6 rules

`allowBlank`, `allowLoop`, and `allowMulti` are separate X6 connection options. Their defaults in `GraphManager.init` are respectively `false`, `false`, and `true`. A custom validator or `allowAll` does not override those options, endpoint shape constraints, or other X6 checks. `highlight` affects connection presentation, not compatibility.

## Built-in semantic policies

| Validator | Accepts | Rejects |
| --- | --- | --- |
| `sameDataType` | A source port has a non-null `dataType` and it exactly equals the target port's `dataType`. | Missing source port/type, missing target port, or unequal values. Matching `undefined` values are not accepted. |
| `directionOnly` | `sourcePort.group === 'out'` and `targetPort.group === 'in'`. | Missing ports or any other group/direction, including reversed endpoints. |
| `allowAll` | Every semantic context (the implementation does not inspect its arguments). | Nothing semantically. |

These policies read model metadata only. `position`, `color`, and `label` are presentation/layout metadata and do not imply type or direction semantics.

## Scenario policy

The scenario app is responsible for selecting a validator that matches its domain. ComfyUI declares typed ports and uses `sameDataType` when configured; ER currently configures `allowAll` despite declaring `ROW`, `REFERENCE`, and `ENUM_VALUE` port types. BPMN configures outgoing-to-incoming validation; its start/end node port definitions therefore prevent incoming connections to starts and outgoing connections from ends. See [ComfyUI](../scenarios/comfyui.md), [ER](../scenarios/er.md), and [BPMN](../scenarios/bpmn.md).

## Change constraints

- Keep the callback synchronous, deterministic, and free of model mutations; it can be invoked repeatedly while the user is drawing a connection.
- Do not infer semantic compatibility from port color or visual position.
- If changing ID fallback or port lookup, preserve connections for definitions both with and without explicit `id`.
- Keep semantic rejection distinct from X6 structural options so a validator cannot accidentally re-enable blank, loop, or multiple connections.
- When changing scenario policy, test both valid and invalid connections in that scenario; do not change ER's permissive policy implicitly while changing generic validation.

## Implementation and verification

- Context assembly and X6 option wiring: `packages/graph/src/graph-manager.ts` (`init`, `validateConnection`, `getPortDefinition`).
- Built-ins: `packages/graph/src/validators.ts`.
- Validator unit cases: `packages/graph/__tests__/validators.test.ts` (equal and unequal types, missing ports/types, direction, and permissive policy).
- Graph registration/port lookup: `packages/graph/__tests__/graph-manager.test.ts`.
- Scenario selection: `apps/comfyui/app/src/app.tsx` and `apps/er/app/src/app.tsx`.

When modifying behavior, add an integration test for the X6 callback as well as policy unit tests when the change affects endpoint resolution, defaults, or the interaction with `allowBlank`, `allowLoop`, or `allowMulti`.
