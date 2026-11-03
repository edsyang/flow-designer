# Flow Designer

[English](./README.md)

![CI](https://github.com/edsyang/flow-designer/actions/workflows/ci.yml/badge.svg)

Flow Designer 是一个基于 React、TypeScript 和 AntV X6 的可扩展可视化流程编辑器框架。它把通用编辑器能力与具体业务场景分离，可用于 BPMN 流程、ComfyUI 数据流、ER 图以及自定义节点图。

> 项目处于持续开发阶段。当前仓库包含框架工作区包和示例应用；API 与发布状态可能变化。

## 特性

- **场景无关的核心**：文档模型、插件生命周期、画布、工作台和属性编辑器可由不同场景复用。
- **可扩展节点模型**：用 `defineNode()` 声明节点视图、端口、数据 schema 和属性编辑器。
- **可插拔行为**：支持内置与自定义插件，并可按需启用或禁用内置插件。
- **类型化连接**：端口可声明数据类型，连接规则通过 validator 配置。
- **数据导入与导出**：通过 `ContentTransformer` 连接内部文档模型和场景外部格式。
- **完整示例**：仓库提供 BPMN、ComfyUI 和 ER 三个独立场景应用。

## 国际化

工作台以及 BPMN、ComfyUI、ER 示例支持简体中文和英语。默认使用简体中文；语言选择会保存在浏览器存储中。

自定义应用把场景词条传给 `createDesigner`；engine 会在插件初始化前把核心词条和场景词条一起加载到 i18next：

```ts
const designer = await createDesigner({
  documentType: "*",
  documentVersion: "1.0.0",
  localeMessages: {
    "en-US": {
      "custom.node.title": "My node",
    },
    "zh-CN": {
      "custom.node.title": "我的节点",
    },
  },
});
await setLocale("en-US");
```

节点元数据和属性标签直接调用带语义 key 的 `t('custom.node.title')`。用户输入的节点标签保持原样。切换语言不会改写文档数据。

## 场景示例

| 场景    | 示例内容                                    | 启动命令           |
| ------- | ------------------------------------------- | ------------------ |
| BPMN    | 流程节点、流程内容模型、Sequence Flow       | `pnpm dev:bpmn`    |
| ComfyUI | 类型化数据端口、工作流导入/导出 transformer | `pnpm dev:comfyui` |
| ER      | Table、View、Enum 节点和关系边              | `pnpm dev:er`      |

开发服务器默认使用 Vite 端口。E2E 测试使用 `5179`、`5180` 和 `5181`；运行 E2E 前需在三个终端分别启动示例应用。

## 环境要求

- Node.js `>=18.12.0`
- pnpm `9.x`（仓库通过 `packageManager` 固定为 `pnpm@9.15.9`）

## 开始使用

### 运行仓库中的示例

```bash
git clone https://github.com/edsyang/flow-designer.git
cd flow-designer
pnpm install
pnpm dev:bpmn
```

选择其他场景：

```bash
pnpm dev:comfyui
pnpm dev:er
```

### 在应用中定义一个节点

核心 API 可从 `@flow-designer/engine` 统一导入。以下示例展示了在已配置 React/Vite 应用中注册通用内容模型和一个节点，并渲染工作台：

```tsx
import "@flow-designer/react/style.css";
import "@flow-designer/skeleton/style.css";
import "@flow-designer/plugins/style.css";
import { createRoot } from "react-dom/client";
import {
  BuiltinSetters,
  contentTypesRegistry,
  createDesigner,
  defineNode,
  GenericContent,
  prototypeRegistry,
  Workbench,
} from "@flow-designer/engine";

const mount = document.getElementById("root");
if (!mount) throw new Error("Missing #root element");

contentTypesRegistry.register(GenericContent);
prototypeRegistry.register(
  defineNode({
    meta: {
      name: "my-node",
      typeName: "MyNode",
      category: "basic",
      icon: "box",
    },
    view: {
      type: "node",
      shape: "fd-rect",
      defaultSize: { width: 200, height: 60 },
      ports: [
        { group: "in", position: "left" },
        { group: "out", position: "right" },
      ],
    },
    schema: [{ name: "name", type: "string", defaultValue: "" }],
    editor: [{ target: "name", description: "Name", setter: BuiltinSetters.String }],
  }),
);

const designer = await createDesigner({
  container: mount,
  documentType: "*",
  documentVersion: "1.0.0",
});

createRoot(mount).render(<Workbench engine={designer.engine} />);
```

外部应用必须在入口文件中导入上述三个公开样式文件；导入 JavaScript 包不会自动加载构建时提取的 CSS。

该示例需要 React 18 和支持 JSX 的构建环境。场景应用还应在创建 designer 前注册自己的节点、内容类型和 transformer。更多按场景组织的设计约束见 [功能规格索引](./.spec/README.md)。

### 仅需 Setter 标识的模块

节点定义等只使用内置编辑器名称的模块，应从轻量子路径导入：

```ts
import { BuiltinSetters, type BuiltinSetterName } from "@flow-designer/setters/constants";
```

此入口支持工作区 source 解析、ESM、CommonJS 及对应类型声明，不会加载控件、React、Ant Design 或 model 代码，标识值保持不变。它不负责注册编辑器；运行时仍通过主包的 `registerBuiltinSetters` 注册。现有 `@flow-designer/setters` 主入口和 engine 门面导入继续兼容。`create-node` 的四种模板均生成轻量导入。

## 项目结构

```text
packages/       通用框架：model、core、graph、plugins、react、engine 等
apps/
  bpmn/         BPMN 场景的 model、nodes、utils 和 app
  comfyui/      ComfyUI 场景的 nodes、utils 和 app
  er/           ER 场景的 nodes、utils 和 app
tools/
  create-node/  节点包脚手架 CLI
e2e/            Playwright 端到端测试和手动诊断脚本
.spec/          按功能与行为组织的设计规格
```

## 开发与测试

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

单包验证可使用：

```bash
pnpm --filter @flow-designer/model test
pnpm --filter @flow-designer/model typecheck
```

先在三个终端启动 E2E 所需的场景应用：

```bash
pnpm dev:e2e:bpmn
pnpm dev:e2e:comfyui
pnpm dev:e2e:er
```

然后运行 Playwright E2E 套件：

```bash
pnpm test:e2e
```

部分 `e2e/*.mjs` 文件是手动诊断脚本，不属于 Playwright 自动测试套件；运行它们前请先启动所需的示例应用。

## 参与贡献

欢迎提交 issue 和 pull request。提交改动前，请优先运行受影响包的测试与类型检查；跨包 API 或序列化格式变更也应覆盖相关示例应用和规格文档。GitHub Actions 会在每次 push 和 pull request 时执行工作区构建与 Vitest 单元测试。

## 工程规范

[AGENTS.md](./AGENTS.md) 规定贡献者与 Agent 的工作约束；[验证指南](./docs/verification.md) 按变更类型列出检查要求；[E2E 清单](./e2e/README.md) 说明浏览器测试准备与已知问题。[docs/plans](./docs/plans/README.md) 中的文件是历史资料，不是当前执行指令。

## License

本项目采用 [MIT License](./LICENSE)。
