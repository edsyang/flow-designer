# Core runtime migration

This guide accompanies the staged core refactor. See the dated verification record for the implemented and validated stages; API changes alone do not establish performance or instance-isolation guarantees.

## Application and adapter contracts

Import `GraphPort`, connection contracts and `CANVAS_COMMANDS` from core. Import `GraphAdapterPort`, native graph configuration and renderer contracts from graph. Model no longer re-exports these application contracts. `Designer.graph` retains native adapter access; `Editor.getGraph()` is the narrow application port. Bridges consume detached final edit snapshots instead of mutable native cells.

UI contracts (`PaneConfig`, `IArea`, `ISkeleton`) belong to skeleton. Engine binds skeleton before plugins initialize; UI plugins acquire and retain their binding with `getSkeleton(editor)`. Core plugins can initialize without a UI.

## Instance services

Use `editor.commands`, `editor.notifications` and `editor.events`, or the corresponding plugin context services. Keep registration disposers and release them on plugin teardown. A disposer owns its exact registration; an old cleanup cannot unregister a newer replacement. Await asynchronous commands so failures remain observable.

Document services are available through `document.getRegistries()` and `document.getSignals()`. An explicitly supplied registry set is caller-owned. Engine-created copies are engine-owned and cleaned up with the designer. Bootstrap catalogs are not a live cross-editor update channel: register dynamic definitions against the intended instance. Content-type and transformer lookups prefer the latest compatible registration; releasing an override exposes the still-active prior entry. Use prototype replacement for repeated metadata refreshes, rather than accumulating registration overlays.

Scoped shortcuts are supplied through `editor.shortcuts` by the browser adapter. Core does not bind document keyboard listeners. Plugin code must release the handle returned from `bind` rather than unregistering a combination globally.

Framework translations are built into i18n. Applications register only business text or overrides. Theme and language remain explicitly shared page preferences; this is separate from document, command, renderer and notification isolation. Browser storage and HTML attributes are managed by browser adapters, not model.

Native global X6 extensions remain explicitly global. Business node renderers use private per-instance registrations; their internal shape names are not serialized as document type identifiers.
