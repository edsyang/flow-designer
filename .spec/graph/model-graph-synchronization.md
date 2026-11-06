# Model and graph synchronization

## Ownership

The document/content model owns persistent editor state. The graph manager owns rendered X6 cells and their interactive presentation. Bridges synchronize the two representations; graph cells are not a replacement for document data.

## Synchronization behavior

The X6 graph plugin creates a `GraphManager`, registers node and edge types, and connects it to document content through bridges. The graph bridge:

- observes model changes and adds or removes corresponding graph cells;
- converts node prototypes, positions, labels, and serialized relations into graph configurations;
- attaches node/edge bridges for graph-originated edits;
- tracks synchronization direction to avoid treating reflected updates as fresh user changes;
- reconciles graph cells by ID on timeline restore, retaining existing cells and refreshing their model projections;
- unregisters observers and event listeners during teardown.

Graph edits that represent persistent state must flow back through model contracts so save/load and undo/redo continue to operate on document data.

## Identity and endpoints

Node and relation identifiers are used to correlate model elements with graph cells. Relations may include source/target node identifiers, port identifiers, edge type, props, and vertices. The graph preserves explicit relation ports and chooses missing ports from registered input/output ports using geometric direction.

## Change constraints

- Keep X6-specific behavior in `packages/graph` and `packages/plugins/src/x6-graph/`.
- Preserve one-way synchronization guards and dispose observers when graph instances are replaced.
- Remove graph-container and document-level DOM listeners when the graph manager is disposed. Resolve workbench overlays within the owning workbench rather than through a document-global query.
- Any change to endpoint, port, or vertex serialization must be checked against scenario transformers and undo/redo.

## Implementation and tests

Primary implementation: `packages/graph/src/graph-manager.ts` and `packages/plugins/src/x6-graph/bridge/`. Validate graph plugin and scenario integration tests after changing bridge behavior.

## Edge persistence contract

Persistent edge edits flow through model relations and history. Connection names remain relation metadata edited in the property inspector; model projection does not display them as canvas labels or register a double-click name editor. Reconnection updates or moves an existing relation, and segment-tool edits commit vertices. Default routing and hover/selection styling are presentation concerns. Hovering does not change routing or vertices. Segment edits preserve their port endpoints and commit orthogonal manual bends. Repeated segment edits remove redundant closed bends rather than accumulating small loops. Moving an endpoint node clears manual bends and reroutes the edge. Ports without an explicit ID, label, or data type are interchangeable directional ports and follow relative node positions during movement; named or typed semantic ports stay attached. Final position, port changes, and cleared bends commit together in one node-move history transaction. Edge types with an explicitly null router, including curved edges, remain router-free and expose a curve vertex tool rather than the orthogonal segment tool. Curve vertices are persisted through the same commit event. Edge type remains the source of router and connector mode during initial projection, drag previews, node movement, history restore, and loading. Registered router options and named-port axes are preserved. Verify endpoint, label, and vertex behavior through save/load and undo/redo, including scenario transformers and browser tool interaction.

## Incremental projection and interaction

Initial synchronization creates nodes before attaching relation bridges, so each relation is projected once. Timeline restore reconciles node IDs and refreshes surviving nodes and relation projections without clearing the canvas. Connection name properties survive projection and restoration without becoming visible canvas text; reconnection changes the existing relation and a source change moves it in one document transaction. The graph records vertex changes when the segment or curve-vertex tool completes an edit; tool-handle behavior requires browser verification.

The graph exposes select and pan interaction modes, initially pan. The floating canvas dock uses one toggle to switch between those modes. Space-drag and middle-button drag provide temporary scoped panning. `graphOptions.virtual` opts into the X6 2.19 virtual renderer and defaults to false.

Ordinary canvas wheel and trackpad pinch zoom at the pointer without requiring a modifier. Zoom is bounded to 1–300%; wheel targets must belong to the owning scroller and exclude form controls. Sidebar, inspector and help overlays do not zoom the canvas below them. Stencil drops preserve the native pointer-centered position without moving existing node screen coordinates on entry. A panel drag pans only after 500ms of stable edge dwell (6px jitter allowance); sliding along or leaving the edge cancels the dwell. Existing canvas-node drags pan immediately at an edge. Animation frames recheck viewport and overlay coverage, and release, cancellation, blur, resize and disposal stop pending pan work. Successful stencil creation selects the new graph and model node.

At 300 or more nodes the graph defaults to viewport presentation culling, with 300 screen pixels of overscan. `graphOptions.viewportCulling: false` disables it. Culling changes view visibility only, leaving the model, X6 cell visibility, selection and history intact. Edges use measured rendered path bounds; unmeasurable or changing paths stay visible, including paths crossing the viewport. Scroll, zoom, resize and model-driven geometry changes refresh presentation. Disposal restores owned view styles and removes listeners. Model node references are held by the graph manager outside X6's deep-cloned cell data and supplied to React node components; they are released on cell removal and graph disposal.

`edge:geometry:changed` carries `{ edge }` after a route redraw, including third-party-obstacle changes that do not mutate that edge's model. It invalidates and temporarily reveals only the affected edge, then measures that path after rendering. Geometry invalidation does not scan all cells on each drag frame. A browser regression covers an initially culled edge whose offscreen endpoints stay fixed while an obstacle reroutes its path into the viewport.

## Obstacle-aware routing

New orthogonal connections and interactive moves require an exact-axis, obstacle-free route with at most three bends and no reversed or self-intersecting segments. A finite candidate search prefers direct and one-bend routes and bounds lane candidates to 48 per axis. Bent routes use an outward stub of at least 12 graph units where space permits; opposing close ports share the available lane evenly, with a compressed minimum of 4 units. Straight links need no artificial bend. Zooming far out can still make a graph-unit stub visually small. The BPMN default block marker opts into presentation-only compression on short target legs, leaving a visible axial line behind the arrow; custom marker definitions remain unchanged and normal size returns when space permits. Loaded graphs may retain an existing legal longer route through the constrained Manhattan adapter and bounded backup. Within the backup, clear direct or one-bend routes avoid search; blocked fallback routes consider boundary lanes before a bounded visibility-grid search. The backup limits its local coordinate set and explored states, so routing is a practical length/bend heuristic, not a claim of global optimality. Endpoint stubs preserve signed outward directions and shorten before close external obstacles.

The port-curve connector preserves direct Bezier links that clear node bodies. Blocked curves and manual curve waypoints use an obstacle corridor with rounded corners and port-aligned tangents. Node bounds are cached and updated by node geometry events. Moving an unrelated obstacle invalidates intersecting cached route segments and routes whose equally short or shorter candidates it blocked, with redraws coalesced per animation frame. These blocker dependencies restore deterministic routes when an obstacle moves away or its movement is undone; removing an edge releases its dependency set. Generic port alternatives are evaluated without mutating graph endpoints and only the winning pair is applied. An internal `edge:geometry:changed` event invalidates presentation culling after these redraws.

A blocked anchor, overlap, or bounded search can prevent a valid route. New connections reject with the translatable `routeUnavailable` reason. Node drags restore the latest legal preview before paint (including snapline translations); ending in an illegal state restores every selected node and associated ports/vertices to the gesture start before model synchronization. Net unchanged transactions create no history. Segment drags similarly retain a legal preview and revert rejected edits. Unrelated obstacles are checked against cached route footprints, not only attached links.

Legacy data is retained. A legal route needing more bends remains visible with `data-routing-warning`. Physically impossible legacy geometry uses an explicitly red dashed diagnostic connection, marked `data-routing-error`, rather than disappearing; this diagnostic is not a collision-free route. Only persisted model projections produce legacy warnings; temporary native drags and adjusted drops do not. `edge:routing:degraded` aggregates `{ edgeIds, reason: "workbench.connection.legacyRouteWarning" }` once per animation frame for a visible workbench warning. Recovery removes the diagnostic presentation and restores caller stroke, dash and marker styling. Pending warning frames are cancelled on disposal.
