# ER diagram scenario

## Composition

The ER app registers its node definitions and generic content type, then creates a designer for `*` document type at version `1.0.0`. It registers the ER relation edge type when the graph becomes ready.

## Domain nodes and ports

- `Table` models table name, JSON fields, and a primary-key name. Its reference input and reference output represent primary/foreign-key links; its `ROW` output represents row data.
- `View` accepts and emits `ROW` data and stores a view name and query.
- `Enum` emits `ENUM_VALUE` data and stores an enum name and JSON values.

The shared data-type metadata defines `ROW`, `REFERENCE`, and `ENUM_VALUE`, each with a matching port color. This is scenario metadata, not a generic graph restriction. The current ER app configures `allowAll`; changing that policy requires an explicit app behavior decision and connection tests.

## Constraints

- Keep ER vocabulary and node schemas in `apps/er/nodes`.
- Keep relation edge presentation in the ER scenario package.
- Preserve field/property meaning and typed port declarations when changing nodes.

## Implementation and tests

Implementation: `apps/er/nodes/src/constants.ts`, `table.ts`, `view.ts`, `enum.ts`, and `relation.ts`. App composition: `apps/er/app/src/app.tsx`.

Scenario links use port-tangent curves with no source or target arrow markers. Their typed or named semantic port identities remain fixed during node and edge editing.
