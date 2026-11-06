# P0 核心重构基线与 P2 契约迁移路线

日期：2026-11-06。运行时基线为已提交 i18n 阶段 `419757d`；本文和新增检查不修改 runtime。P1 同时在进行源码拆分，下面公共消费检查只读取此前构建的 dist，不将中间源码当作已构建产品。当前 P0、P1 已完成；P2 以下内容仅为设计方案，尚未实施。

## 可运行产物和命令

- `scripts/check-core-baseline.mjs`：消费 package exports 的已构建公开入口，不使用 source condition/TS alias，不构建或写入任何 dist。临时 consumer 位于系统临时目录，退出时清理。
- `scripts/fixtures/core-baseline-document.json`：通用内部文档的固定节点、命名端口、曲线类型、顶点、自定义名称和嵌套属性。
- 先有最新完整构建（包括 create-node），再运行 `node scripts/check-core-baseline.mjs`。本次 P0 没有重跑全 build，使用 root 已构建产物；脚本不能证明未构建源码的行为。
- `pnpm --filter @flow-designer/create-node test`：生成器自身特征测试。
- 本机实际使用 Node v22.23.2；这是本次验证环境，不新增全项目 Node 版本要求。

本次脚本六组检查全部通过，生成器 27/27 通过。结果见 `/private/tmp/flow-core-baseline-result.log`、`/private/tmp/flow-core-baseline-scaffold.log`，临时机器证据不进入发布包。

## 模块格式的实际支持与局限

| 消费路径 | 本次证据 | 不应推导的承诺 |
| --- | --- | --- |
| model/core package exports，原生 Node ESM | 导入并执行 Document/CommandRegistry 特征检查成功，无 window/document | 尚不能说 model 的全部浏览器工具或未来所有入口都可在服务端执行 |
| model/core package exports，原生 Node CJS | require 并执行相同特征检查成功 | 不代表 engine 同样支持原生 Node |
| engine 原生 Node ESM | 明确复现 transitive X6 stencil CSS 的 `ERR_UNKNOWN_FILE_EXTENSION` | 不能把声明 `.mjs` 入口等同于无 DOM 的 Node 支持 |
| engine 原生 Node CJS | 明确复现 transitive CSS 的 SyntaxError | 不能声称 SSR/Node require 可直接运行完整 engine |
| engine/model/core + setters/constants 类型 | 独立 `.mts`/`.cts` consumer，strict NodeNext 编译通过 | 使用 skipLibCheck=true，只验证公开消费用法和类型解析，不证明传递声明全部无错 |
| create-node 四种定义生成器 | 从现有 built generator 生成实际 TS，strict bundler resolution 编译通过 | 未安装/打包/发布生成包，不声称其所有模块格式或所有生成文件已独立验收 |
| engine 浏览器应用 | 三场景通过既有 facade 组合，root 本轮完整 Chrome E2E 82/82 | 本脚本未运行浏览器，不新增 engine 的 Node/SSR 格式保证 |

脚本对 engine 的 Node 阻塞是具名的“已知局限”断言，不将其报告为 engine 原生 Node 消费成功。若后续修复支持该路径，应有意识更新基线及真实成功用例；若异常变成其他原因，当前断言必须失败，不能吞掉任意导入错误。

## 公共入口与消费者清单

| 入口/能力 | 直接消费与证据文件 | P2/P6 约束 |
| --- | --- | --- |
| model 的 Document/Content/Props/Timeline/序列化、defineNode/registries | `packages/model/src/index.ts`；BPMN `apps/bpmn/model/src`；各场景 `nodes/src`；create-node 四模板 | 领域数据留 model；defineNode 组合体验首批保留；注册实例化不混入 P2 |
| model 的 ISkeleton/IArea/PaneConfig | `packages/model/src/interfaces.ts`；core editor/plugin types；skeleton 和 React panels | UI 契约迁 skeleton，禁止 model/core 反向导出 UI |
| model 的 IGraphManager/GraphEvent/应用命令 | `interfaces.ts`、`canvas-commands.ts`；core Editor；plugins bridge/commands；React Canvas | 应用窄端口与 typed finalized DTO 迁 core；X6 工具专属协议留 graph |
| core Editor/CommandRegistry/插件生命周期 | `packages/core/src/index.ts`；engine；plugins；skeleton UI 绑定 | 保持无 React/X6 runtime；Promise 返回/错误不得丢失 |
| engine facade | `apps/{bpmn,er,comfyui}/app/src/app.tsx` | 保持 facade 同名应用导出；低层导入迁移不通过反向 re-export 修补 |
| setters/constants | 四个 `tools/create-node/src/templates/{generic,bpmn,er,comfyui}.ts` 及场景节点定义 | 保持轻入口和当前 source/built 路径；不改回主 UI 入口 |
| i18n 主入口与 /react | `packages/i18n`；engine 组合；React hook 门面 | 已独立、无业务目录/存储；独立 Provider 不等于完整 designer 已多实例隔离 |
| create-node CLI | `tools/create-node/src/index.ts`；`templates/package-json.ts`、`config-files.ts` | CLI 是 ESM；模板声明双产物，TS 使用 bundler resolution；全生成包 install/build/消费者打包仍需专项验收 |

脚本采用 namespace 公共导出断言和真实 API 用法，不固定所有临时内部导出的精确数量。迁移前仍须对改动符号执行 `rg` 查全消费者，不能把表当成自动生成的完整外部用户清单。

## 冻结的序列化与事务特征

公共消费者脚本对 ESM/CJS 各执行一次：

1. 固定文档完整 round-trip：document ID/type/version、节点 IDs/typeName/props/position、edge ID/typeName/sourceRef/targetRef/sourcePort/targetPort/props/vertices。
2. Selection 是 transient，不写入 getData；这不宣称 selection 在 undo 时的所有交互均由本脚本覆盖。
3. 单次 transaction 同时改位置和 relation port/vertices，只新增一个 history point；undo/redo 精确恢复完整 before/after。
4. 读取快照后修改其嵌套 vertices 不影响模型。
5. save 返回完整数据并标记当前干净；新文档 load(saved) 完整恢复并建立单一干净基线。
6. core CommandRegistry 原样返回异步 Promise。

这些是本次新增长期可运行检查。更深失败语义继续由现有 `packages/model/__tests__/timeline.test.ts`、`document.test.ts`、`packages/plugins/__tests__/canvas-commands.test.ts` 等负责：bounded full checkpoints（默认100）、重叠 async coalescing 非隔离事务、失败不做通用整图 rollback、owned-reference compensation、并发外部编辑保护。P0 不将这些改写为数据库事务，也不把 save marker 当持久存储成功。

BPMN 自定义解析/关系行为由 `apps/bpmn/model/__tests__/{bpmn-model,integration}.test.ts` 固定；ComfyUI 外部格式由 `apps/comfyui/utils/__tests__/transformer.test.ts` 固定；三个 nodes 包 registration/definition tests 固定节点与端口目录。通用 JSON fixture 不声称代替场景格式 fixture，不保证外部转换无损。上述场景包测试本 agent 本次未单独重跑，最终 workspace gate 由 root 执行。

## 浏览器与性能基线（root 提供，文件已核对）

- 完整 Chrome E2E：82/82，日志 `/tmp/flow-core-baseline-e2e.log`。本 agent 未重复启动浏览器。
- 已构建 production preview 5199：100/300/500 节点，各2倍边数，各3次；证据 `/tmp/flow-core-baseline-performance/*/performance.json`。没有在采样期间重构建。

| nodes/edges | 300px drag P95 范围 | fit 后 drag P95 范围 | loadFinalRender 范围 | legacy warning elements | rendered edges / routing failures / error elements |
| --- | --- | --- | --- | --- | --- |
| 100/200 | 16.7–16.8ms | 16.7–16.8ms | 944.7–990.0ms | 101 | 200 / 0 / 0 |
| 300/600 | 16.7ms | 16.7ms | 3108.9–3161.2ms | 309 | 600 / 0 / 0 |
| 500/1000 | 16.7–16.8ms | 16.7–16.8ms | 1733.6–1771.1ms | 517 | 1000 / 0 / 0 |

这是特定图布局、设备与浏览器的采样，不是60fps普遍保证。常规 drag 每次实际 positionEvents=30、routePasses=126；fit 后分别为60/240，仅4条局部边参与。初始加载 removed=2 是替换默认 Start/End，undo 的 removedOnUndo=0，不能混作重构造成全图重建。legacy warning 不为零，跨行 fixture 并非所有路线严格合法，不等于丢线；load 最终收敛秒级仍是明确成本。比较后续优化须保留图布局、真实 position events、route passes、边数、错误/警告和 render-ready 条件，不能只比较程序化 move 或把加载尾部算到拖动上。现有 `e2e/performance.spec.ts` 保存逐帧数据和 dragWork，勿删去这些真实性检查。

## P2 精确接口路线（设计，尚未实施）

### 1. 契约归属和原子迁移

- core 新增内部 `graph-contracts` 与 `canvas-commands` 模块并从主入口导出；不新增 npm 包。
- 将 `CANVAS_COMMANDS` 及现有请求/结果从 model 原样迁 core，命令字符串、行为与实现位置不变；实现继续在 plugins。
- model 保留 SerializedNode/SerializedRelation/SerializedEdgeElement、PortDefinition、canUsePort 和领域关系。纯 Point/endpoint 数据可留 model或在 core 使用结构类型，避免反向 import。
- core 定义按真实调用面组合的 GraphPort；Editor.getGraph/PluginContext.graph 使用此纯应用端口。Designer.graph 保留 graph adapter；engine 的 IGraphManager 兼容别名可由 graph 提供，不把原生逃逸能力带回 core。内部消费者只依赖所需能力。
- UI agent 负责 PaneConfig/IArea/ISkeleton 迁 skeleton 以及 typed `bindSkeleton(editor,skeleton)`/`getSkeleton(editor)` 的 WeakMap 绑定；core 删除 UI ownership，不依赖 skeleton。挂载绑定须返回身份校验 disposer。
- model 旧应用/UI出口与内部消费者同一阶段原子移除；engine 从上层重新聚合新归属保持 facade 名称。不得用 model→core/skeleton 的兼容反向 re-export。直接 model 用户导入路径为明确 breaking，迁移表需记录。

### 2. GraphPort 按现有真实使用面组合

建议具体能力接口如下，先保持现有方法语义，不一次重设计所有 Options：

- `GraphProjectionPort`：addNode/addEdge/removeCell/resetCells/updateNodeData，以及明确的节点/边投影更新操作；只接受/返回数据，不返回 cell。
- `GraphSelectionPort`：select/getSelection。
- `GraphViewportPort`：zoomTo/getZoom/zoomToFit/centerContent/resize/clientToLocal/localToClient。
- `GraphInteractionPort`：setInteractionMode/getInteractionMode、startNodeDrag。
- `GraphConnectionPort`：getPortDefinition/getDefaultEdgeType/getEdgeTypeName，evaluateConnection/resolveConnection/checkConnection。区分 prototype candidate 和真实 commit，保留 strict 指定端口校验与仅几何失败可fallback。
- `GraphEventsPort`：独立 typed subscription/event map；核心 finalized 事件不再用 `(...unknown[])` 交出实时 cell。graph adapter 原生 on/off API 保留原 payload，新应用事件使用独立入口，避免静默破坏外部消费者。
- `GraphManager` 组合上述能力用于便捷门面；init/dispose 生命周期接口可单独组合。
- registerNodeType/registerEdgeType 的 React component/config、getX6Graph/useX6Plugin/stencil 工具属于 graph adapter。P2 中显式标记临时 escape-hatch consumer并逐个迁移，不伪装成纯 core GraphPort。

不把全部 EdgeTypeConfig 机械搬到 core：其 component/renderer 是 UI/graph adapter 责任；应用创建只需 edge type ID、默认 props/schema元数据与 connection decision 数据。

### 3. 最终手势 DTO 和时序

新增只读、脱离 cell 的 finalized snapshot（名称可在实施 review 确定）：

- `NodeMoveCommit`：nodeId、最终 position、`edges: readonly EdgeEndpointPatch[]`。
- `EdgeEndpointPatch`：edgeId、真实 sourceNodeId/targetNodeId、最终 sourcePortId/targetPortId、detached vertices；需要类型时包含 edgeType ID，而非推导 router mode。
- `ConnectionCommit`：edgeId、新建/重连及原 source owner ID、最终两个 endpoint、edgeType、detached props/vertices。
- `VerticesCommit`：edgeId、source owner ID、detached vertices。
- `StencilDropCommit`：临时 cell ID、typeName、最终位置；选择、点击、空白连接、拒绝事件只包含 IDs、坐标、原因码，不传 cell 或 DOM event。

Graph 在合法状态恢复/最终port解析完成后同步复制 DTO，再发事件；plugins 在 await 或延后提交时不再读取 mutable X6 cell，避免监听器先后关系。节点移动必须包含第三方障碍导致改变端口的非相连边，不仅 connected edges。被拒操作不发成功commit；保留既有reason/warning事件，legacy诊断不同于新操作拒绝。

DTO 是最终变更快照，不是整图快照、不授权全图 rollback；一次 gesture仍一次 Document.transaction。projection更新触发的回声需使用明确来源/操作身份过滤，不能只依赖异步期间布尔方向开关。

### 4. P2 验收与不扩范围

- public消费脚本迁移 direct imports但fixture完全不变，engine facade同名 API 保留；类型无 UI 反向依赖。
- bridge不再需要 X6NodeHandle/X6EdgeHandle 强转完成 finalized commits；live cell变化不能影响已发DTO。
- 事件后、async提交前修改原cell，提交仍采用原DTO；同时加入 connected和非connected reroute边。
- 单手势ports/type/vertices/saveLoad/undoRedo完全一致；拒绝/no-op/owned补偿与并发外部编辑既有测试保持。
- UI binding cleanup覆盖A解除不能删B覆盖后的绑定；core不再保留任何Skeleton类型/React runtime依赖。
- 不同时改CommandBus实例化（P3）、所有编辑服务实现（P4）、router算法/缓存（P5）、全部NodeDefinition UI类型（P6）。P1拆分完成并freeze后才开始runtime迁移。

### 5. 实施切分与额外风险

先冻结接口和 DTO 产生时机，再分派生产者与消费者，最终原子集成：UI 契约迁 skeleton；core 定义应用端口、plugins 迁移消费；graph 提供适配实现；engine 保留组合门面并验证消费。不要留下只能编译一半的提交。

NodeBridge 当前仍直接调用原生 position/attrs/ports；须改成数据化 updateNode patch，并保留差异更新，避免接口变干净却引入全量刷新。原生 clipboard 留在 graph 适配器，通过 copyCells 等窄方法调用。P2 不同时修改注册实例化、路由算法或事务补偿。

P3 隔离还须覆盖 X6 全局 shape 注册：即使 model registries 按实例创建，相同 typeName 的渲染闭包仍可能相互覆盖。应评估实例化原生 shape ID 与身份绑定的注销，保持序列化 typeName 不变；同时验证场景语言刷新、setter/transformer 注册和迟到异步回调，不以两个 registry 对象作为隔离成功的证据。
