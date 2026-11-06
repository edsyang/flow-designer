# Color theme

The workbench ships a light and a dark appearance. The theme is transient UI state owned by the model layer: it never becomes part of the serialized document and never enters the undo timeline.

## Required contract

- **Ownership.** `@flow-designer/model/src/theme.ts` owns the resolved theme. Consumers must read and change it through `getTheme`, `setTheme`, `subscribeTheme`, `getThemeSnapshot`, and `applyTheme`; no package keeps its own copy.
- **Resolution order.** The stored value in browser storage (`flow-designer:theme`) wins; otherwise the platform `prefers-color-scheme` decides; otherwise the theme is `light`. Only `"light"` and `"dark"` are valid.
- **Mutation.** `setTheme` is a no-op when the value is unchanged. A real change persists the value (storage failures warn and do not throw), applies the `data-fd-theme` attribute plus `color-scheme` on `document.documentElement`, bumps the snapshot version, and notifies every subscriber. Listeners that throw must not prevent the remaining listeners from running.
- **Snapshot.** `getThemeSnapshot()` returns `` `${theme}#${version}` `` so `useSyncExternalStore` consumers re-render on every mutation, including a repeated switch back to the previous value.
- **React surface.** `useTheme()` from `@flow-designer/react` returns `{ theme, setTheme, toggleTheme }`. `Workbench` subscribes to the same store, applies the theme to the document root, renders `data-fd-theme` on its root element, and selects the antd `darkAlgorithm` when the theme is dark.
- **Tokens.** `packages/react/src/design-tokens.less` defines the light palette on `:root` and the dark palette on `:root[data-fd-theme="dark"]`. Component styles are authored in Less and must consume `--fd-*` tokens; a literal color is acceptable only as a `var()` fallback.
- **Canvas.** The X6 background follows the theme (`#f7f8fa` light, `#121722` dark) unless the caller passes `graphOptions.background`, which always wins. The grid is a mesh pattern whose stroke follows the theme (`#e8ebf0` light, `#242c3c` dark). `GraphManager` subscribes to the theme store, repaints the background and grid, and re-applies the diagram palette to every node and edge; newly added cells pick the palette up on `cell:added`.
- **Caller colours.** The palette owns only built-in defaults and values still equal to its last managed colour. A caller colour change detaches that cell attribute from palette management. Explicit edge-type `defaultAttrs.line.stroke` and port-item `attrs.circle.fill` take priority even when equal to a default palette value, including on creation in dark mode. Semantic port stroke colours remain intact. Selection keeps a separate base stroke/width so recolouring does not erase the highlight and deselection restores the current themed or caller-owned base. Internal ownership metadata is weakly keyed by cells and is not serialized. `NodeConfig` does not expose arbitrary attrs; a raw X6 node colour explicitly set to exactly its built-in default before insertion is indistinguishable from an inherited default.
- **Diagram palette.** `GraphManager` owns a small palette (`resolveCanvasPalette`) for `fd-*` node bodies, event bodies, labels, ports, and edge lines. Shapes stay theme-agnostic: a shape renders its light defaults unless the palette overwrites `body.fill`/`body.stroke`/`label.fill`/`line.stroke`.
- **Switching.** `setTheme` marks the document root with `data-fd-theme-switching` for 240 ms. Stylesheets suppress transitions and animations while that attribute is present so the recolour is a single frame rather than a cross-fade of every surface.
- **Control.** The `plugin-theme` built-in plugin adds a header toggle (`workbench-theme`, `align: "right"`). Disabling `plugin-theme` removes the control but leaves the resolved theme and every consumer intact.
- **Non-goals.** Switching themes must not change document data, selection, history, or zoom, and must not require a reload.

## Current implementation

| Concern | Location |
| --- | --- |
| Theme state, persistence, snapshot | `packages/model/src/theme.ts` |
| Public exports | `packages/model/src/index.ts` (`applyTheme`, `getTheme`, `getThemeSnapshot`, `setTheme`, `subscribeTheme`, `getInitialTheme`, `Theme`) |
| React hook | `packages/react/src/hooks/use-theme.ts`, exported from `packages/react/src/index.ts` |
| Workbench wiring | `packages/react/src/workbench.tsx` (`readTheme`, `buildTheme`, `applyTheme` effect, `data-fd-theme`) |
| Palettes | `packages/react/src/design-tokens.less` |
| Canvas background, grid, diagram palette | `packages/graph/src/graph-manager.ts` (`backgroundOption`, `resolveBackgroundColor`, `resolveGridColor`, `resolveCanvasPalette`, `applyNodeTheme`, `applyEdgeTheme`, `applyCanvasTheme`, `subscribeTheme`) |
| Switching window | `packages/model/src/theme.ts` (`beginThemeSwitch`), `packages/react/src/design-tokens.less` (`data-fd-theme-switching`) |
| Toggle control | `packages/plugins/src/theme/{index,theme-switcher}.tsx`, registered in `packages/plugins/src/register-builtin-plugins.ts` |
| Messages | `packages/plugins/src/messages.ts` (`workbench.theme.*`) |
| Tests | `packages/model/__tests__/theme.test.ts`, `packages/react/__tests__/use-theme.test.tsx` |

## Known gaps

- Only cells whose shape name starts with `fd-` receive the diagram palette. Custom shapes registered by consumers keep their own attrs and must call `applyNodeTheme`-equivalent logic themselves (the palette methods are private to `GraphManager`).
- The transition-suppression window is a fixed 240 ms; a much slower stylesheet transition would still be partially visible.
- The platform preference is read once when the theme state initializes; later `prefers-color-scheme` changes are not observed. An explicit stored choice always wins.
- There is no `createDesigner` option to force an initial theme; callers can call `setTheme` before mounting the workbench.
- Portaled antd overlays inherit colors from the ConfigProvider algorithm, but consumer-authored CSS that uses `--fd-*` tokens inside a portal rendered outside the workbench element still resolves against `:root`, so the tokens must stay on the document root.
