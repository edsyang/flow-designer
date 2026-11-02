# Feature specifications

Specifications live here and are organized by behavior, not by workspace package. The root `AGENTS.md` contains repository-wide working rules; these documents describe cross-package behavior and contracts.

Specifications define intended behavior; implementation and tests are evidence of current behavior, not automatic authority to redefine the contract. When they disagree, classify the discrepancy as an implementation defect, incorrect test, or outdated contract before changing it. Intentional contract changes must be within the current task's scope and update the relevant consumers and tests.

Use explicit **Required contract**, **Current implementation**, and **Known gaps** sections where behavior differs. A known gap records debt; it does not waive the contract or authorize a fix. Historical documents under `docs/plans/` are reference material, not current instructions or acceptance evidence. Do not create a package-specific spec merely to restate a package manifest or directory.

## Specification quality bar

A specification is a change guide, not a feature summary. Keep only details that help a developer preserve behavior or make a safe change:

- **Ownership and entry points:** identify which layer owns the behavior, where it is initialized, and which neighboring layer must not take over that responsibility.
- **Inputs and outputs:** document public option names, meaningful defaults, identifiers, serialized fields, and transformations between representations.
- **Behavior and invariants:** describe ordering, state transitions, synchronization direction, and what must remain true after save/load, undo/redo, or teardown.
- **Failure and edge cases:** specify missing registrations, invalid or absent metadata, incompatible versions, rejected operations, and resource cleanup where applicable.
- **Change impact:** name consumers or scenario-specific policies that must be checked when a contract changes.
- **Verification:** link concrete implementation and test paths; say which cases those tests cover. Do not claim a case is tested unless a corresponding test exists.

Separate current implementation facts from required contracts. If implementation and documented intent differ, call out the discrepancy rather than silently documenting the implementation as desirable behavior. Avoid generic advice that cannot guide a code change.

## Index

- [Architecture and package boundaries](./architecture/layers-and-boundaries.md)
- [Document model and serialization](./model/document-and-serialization.md)
- [Designer creation and plugin lifecycle](./runtime/engine-and-plugin-lifecycle.md)
- [Graph/model synchronization](./graph/model-graph-synchronization.md)
- [Connection validation](./graph/connection-validation.md)
- [Workbench composition](./workbench/panel-composition.md)
- Scenario specifications: [BPMN](./scenarios/bpmn.md), [ComfyUI](./scenarios/comfyui.md), [ER](./scenarios/er.md)
- [Node package scaffolding](./tooling/create-node.md)

## Verification guidance

See [the verification matrix](../docs/verification.md) for required checks by change type and [the E2E inventory](../e2e/README.md) for test preconditions and known static concerns. Record the command and revision when claiming a check passed.
