# Workbench panel composition

## Structure

The React `Workbench` renders a provider-backed editor shell with five skeleton areas: `Header`, `Sidebar`, `Inspector`, `Canvas`, and `CanvasToolbar`. `CanvasToolbar` is overlaid inside the canvas centered along its lower edge and arranges its controls horizontally. It remains outside the graph mount element so graph zoom does not scale the controls. The node library can collapse without disposing its contributions and includes a text search. The inspector remains mounted while hidden so its contextual selection observers can reopen it. The header contains contributed document controls and right-aligned help and language actions, without a node counter. Double-clicking the canvas collapses the inspector; double-clicking blank canvas space also opens a searchable quick-add panel for registered visual node prototypes. Choosing a node creates it centered at the double-click location and selects it.

Apps and plugins extend the shell by adding keyed pane configurations to a named area. These names are the public skeleton API and the matching `data-fd-area` DOM identifiers. The shell should remain a composition mechanism rather than a place for scenario graph or document semantics.

## Responsibilities

- `packages/skeleton` owns areas, pane configuration, and reusable field/settings surfaces.
- `packages/react` owns provider/context, hooks, panel rendering, workbench composition, and React error boundaries.
- `packages/setters` supplies reusable property editors registered against model schemas.
- Plugins may contribute controls to extension areas through skeleton APIs.
- Scenario-level commands and document actions belong in `Header`; graph navigation and editing tools belong in `CanvasToolbar`.

Shared React content creation and component detection belong to `packages/skeleton/src/create-content.ts`, exported from `@flow-designer/skeleton`. Both workbench panes and settings use it for functions, React classes, memo, forwardRef and existing elements. Existing elements retain key/ref when props are merged, with computed setting props taking precedence. Registered string/config setters retain their registry lookup and fallback rules. Core no longer exports these helpers or imports React at runtime; see [the import migration](../../docs/core-ui-helper-migration.md).

## UI constraints

- Keep user-interface concerns out of `packages/core` and data serialization.
- Preserve typed access to engine, document, selection, and graph state in React hooks.
- Keep app-specific labels and setup in the scenario app; shared panel layout stays reusable.
- Clean up React roots/listeners when graph or workbench resources are disposed.

## Implementation and tests

Primary implementation: `packages/skeleton/src/skeleton.ts`, `packages/skeleton/src/area.ts`, and `packages/react/src/workbench.tsx` plus `packages/react/src/panels/`.

## Interaction and accessibility

The floating canvas dock contributes one toggle for select and pan modes through the public graph manager interaction API; pan is the default mode. Existing skeleton controls remain extensible. When the public canvas itself has keyboard focus, unmodified Enter opens quick add at the viewport center; form fields and descendant controls do not trigger it. The canvas exposes an Enter shortcut hint. Quick add focuses its search on opening, uses the node library's shape icons in a vertical result list, supports Arrow Up/Down through results, cycles Tab within the panel, and closes on Escape or an outside pointer. Closing returns focus to the public canvas keyboard target captured before the blank-canvas double-click opens the panel; an outside pointer preserves its new focus target. While a node is being created, duplicate submissions are blocked and failures remain visible.

Dock, quick-add and inspector are siblings of the graph mount and use screen pixels, so graph zoom does not change their control sizes. Focus rings, stable button dimensions and reduced-motion overrides apply to workbench controls. Microinteractions are limited to control color/background changes; graph nodes have no persistent animation.

Selection exposes properties through the inspector and does not mount a floating copy/delete/deselect action popup. The underlying copy, paste, delete and history commands and scoped keyboard shortcuts remain available. Automatic create-and-connect is not provided: a shared scenario-safe connection validation and relation creation API must exist before that UI can be exposed.

The header is composed only from contributed items. The built-in canvas-help and language-switcher plugins independently register and remove their right-aligned controls. Their components and feature styles belong to the plugins package, not the React workbench package. Help opens a labelled modal dialog with a backdrop, trapped Tab/Shift-Tab focus, Escape/outside dismissal, and focus restoration to its trigger. It lists actual canvas, copy/paste, delete, and history operations. Help appears only with a ready graph. Hover, focus, and pressed colors give feedback without moving button targets.

Zoom controls include minus/plus, a keyboard-operable percentage slider, a live percentage output synchronized with graph scale events, and an actual zoom-to-fit action. Dock and slider dimensions remain constant through graph zoom. On narrow workbenches controls use compact stable targets and stay within the canvas bounds.

The library uses searchable, grouped graphic cards; their existing drag handlers remain the creation path. Library and inspector use restrained floating surfaces with shared accent, spacing, field and focus tokens. For initially narrow viewports, the node library starts collapsed at 760px or below and the inspector starts collapsed at 1000px or below. A collapsed library becomes a small floating reopen button instead of occupying a full-height sidebar. Both panels retain explicit keyboard-accessible controls with expanded state and controlled-content references.

Inspector collapse hides content without unmounting contextual observers. Selecting a different single node with settings automatically reveals its configuration, including on narrow viewports; users may manually collapse the currently selected node's inspector until the next configured-node selection. Selection without settings does not force expansion. A collapsed inspector retains its reopen control after widening.

Quick add anchors twelve screen pixels from the blank-canvas double-click point, flips to the other side when its measured size would cross an edge, and clamps inside its owning canvas. Successful quick-add and library-drop creation select the created node through graph/model selection; graph interaction owns the drop bridge. No persistent per-node effects or animation are added.
