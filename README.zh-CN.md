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

翻译状态归 `@flow-designer/i18n`，不依赖 model、React、浏览器存储或应用词条。自定义应用把场景词条传给 `createDesigner`；框架内置词条自动可用，engine 会在插件初始化前添加场景词条：

```ts
import { createDesigner } from "@flow-designer/engine";
import { setLocale } from "@flow-designer/i18n";

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

词条也可以在初始化之后注册（例如插件或懒加载模块就绪时）。`registerMessages` 合并整份目录，`addMessages` 合并单个语言，两者都会触发已订阅的工作台组件重新渲染：

```ts
import { registerMessages } from "@flow-designer/i18n";

registerMessages({ "en-US": { "custom.node.title": "My node" } });
```

新传入的同名 key 会覆盖该语言中的旧值，其余 key 保留。React 组件通过 `useTranslate` 读取翻译，它同时订阅语言与词条目录的变化；原有 `@flow-designer/react` hook 继续作为兼容门面：

```tsx
import { useTranslate } from "@flow-designer/react";

function Toolbar() {
  const { t, locale, setLocale } = useTranslate();
  return (
    <button onClick={() => void setLocale(locale === "en-US" ? "zh-CN" : "en-US")}>
      {t("workbench.language.label")}
    </button>
  );
}
```

如果节点定义在模块求值时调用 `t()`，应先初始化，再导入和注册这些定义：

```ts
import { initializeDesignerI18n } from "@flow-designer/engine";
import { scenarioMessages } from "./i18n";

await initializeDesignerI18n(scenarioMessages);
await import("./register-nodes");
```

每个 `createI18n()` 服务默认包含框架词条，统一在 `packages/i18n/src/catalog/` 按领域维护。应用只需注册自己的文案或显式覆盖，无需逐包组装目录。`initializeDesignerI18n` 添加场景词条并读取浏览器初始语言偏好（无有效偏好时为中文）。场景词条及示例 header 文案归各场景的 `nodes/src/i18n.ts`。`createDesigner` 持有语言持久化订阅，在销毁或初始化失败时清理；仅注册词条不会写入存储。

独立 React 子树可以显式创建并初始化服务：

```tsx
import { createI18n } from "@flow-designer/i18n";
import { I18nProvider, useTranslate } from "@flow-designer/i18n/react";

const translations = createI18n();
await translations.initializeI18n({ "en-US": { greeting: "Hello" } }, "en-US");
// 后代 useTranslate() 使用此服务。
const view = (
  <I18nProvider instance={translations}>
    <MyWidget />
  </I18nProvider>
);
```

纯服务默认中文，不自行读取或持久化浏览器偏好。完整 designer 本轮仍使用共享默认服务；Provider 不会隔离其插件和注册表，不能据此宣称同页多 designer 隔离。

**迁移：** 原从 `@flow-designer/model` 导入的翻译函数和 `Locale`/`Messages` 类型改从 `@flow-designer/i18n` 导入，model 不再转导出。UI 启动时调用的底层 `initializeI18n` 改为 engine 的 `initializeDesignerI18n(scenarioMessages)`。底层 `initializeI18n` 仍供独立服务使用，已包含框架词条，但不读取浏览器偏好。`coreMessages` 继续从 i18n 和 engine 门面导出以兼容原入口；原来的各包目录导出已移除。应用应注册自己的词条，而非重新注册内置目录。

## 主题

工作台内置明暗两套外观。内置的 `plugin-theme` 插件会在头部加一个切换按钮，选择结果保存在浏览器存储中，切换时同时更新设计 token 与 antd 算法，无需刷新页面。主题属于临时 UI 状态：不会写入 `Document.getData()`，也不进入撤销历史。

应用既可以直接从 model 层读写主题，也可以使用 React hook：

```tsx
import { setTheme } from "@flow-designer/model";
import { useTheme } from "@flow-designer/react";

function ThemeButton() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>{theme}</button>;
}

setTheme("dark");
```

组件样式应使用 `@flow-designer/react/style.css` 中的 `--fd-*` token；深色配色定义在 `:root[data-fd-theme="dark"]` 上。若显式传入 `graphOptions.background`，画布颜色仍以该配置为准。

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
pnpm format:check
pnpm lint
pnpm check:boundaries
pnpm typecheck
pnpm build
pnpm test
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

欢迎提交 issue 和 pull request。提交改动前，请优先运行受影响包的测试与类型检查；跨包 API 或序列化格式变更也应覆盖相关示例应用和规格文档。GitHub Actions 会在每次 push 和 pull request 时执行格式检查、lint、导入边界断言、类型检查、工作区构建与 Vitest 单元测试；Playwright E2E 套件不属于 CI 门禁。

## 工程规范

[AGENTS.md](./AGENTS.md) 规定贡献者与 Agent 的工作约束；[验证指南](./docs/verification.md) 按变更类型列出检查要求；[E2E 清单](./e2e/README.md) 说明浏览器测试准备与已知问题。[docs/plans](./docs/plans/README.md) 中的文件是历史资料，不是当前执行指令。

## UI 契约导入迁移

`ISkeleton`、`IArea`、`PaneConfig` 从 model 迁至 `@flow-designer/skeleton`。UI 插件通过 skeleton 的 `getSkeleton(ctx.editor)` 获取 UI；core Editor/PluginContext 不再持有 UI。engine 自动绑定和释放 skeleton，聚合入口仍导出这些类型。独立组合 UI 时使用 `bindSkeleton(editor, skeleton)` 并释放其 disposer；有效绑定存在时拒绝重复绑定。React 组件继续使用 `useSkeleton()`。

## License

本项目采用 [MIT License](./LICENSE)。
