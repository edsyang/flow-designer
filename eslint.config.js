import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import eslintConfigPrettier from "eslint-config-prettier";

// Shared framework packages must not depend on scenario packages, even via subpaths.
const scenarioImports = [
  {
    group: [
      "@flow-designer/bpmn-*",
      "@flow-designer/bpmn-*/**",
      "@flow-designer/comfyui-*",
      "@flow-designer/comfyui-*/**",
      "@flow-designer/er-*",
      "@flow-designer/er-*/**",
      "**/apps/**",
    ],
    message: "Scenario dependencies belong in apps/, not shared framework packages.",
  },
];
const baseImports = [
  { group: ["@antv/x6*"], message: "X6 只能在 @flow-designer/graph 包内使用" },
  {
    group: ["antd", "antd/**", "@ant-design/*", "@alifd/*", "uxcore"],
    message: "壳包禁止引入 UI 组件库",
  },
  { group: ["lodash*"], message: "使用原生 API 替代 lodash" },
];
const coreUIImports = {
  group: [
    "@flow-designer/graph",
    "@flow-designer/graph/**",
    "**/graph/src/**",
    "@flow-designer/i18n/react",
    "@flow-designer/react",
    "@flow-designer/react/**",
    "@flow-designer/skeleton",
    "@flow-designer/skeleton/**",
    "@flow-designer/setters",
    "@flow-designer/setters/**",
    "@flow-designer/plugins",
    "@flow-designer/plugins/**",
    "@flow-designer/engine",
    "@flow-designer/engine/**",
    "**/react/src/**",
    "**/skeleton/src/**",
    "**/setters/src/**",
    "**/plugins/src/**",
    "**/engine/src/**",
  ],
  message: "Core must depend on model contracts rather than UI or composition layers.",
};
const reactRuntimeImports = {
  group: ["react", "react/**", "react-dom", "react-dom/**"],
  allowTypeImports: true,
  message: "Keep React runtime code outside core; type-only imports are allowed.",
};

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**"] },
  ...tseslint.configs.strictTypeChecked,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-deprecated": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-dynamic-delete": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-unnecessary-condition": "warn",
      "@typescript-eslint/no-confusing-void-expression": "warn",
      "@typescript-eslint/restrict-template-expressions": "warn",
      "@typescript-eslint/no-base-to-string": "warn",
      "@typescript-eslint/require-await": "warn",
      "@typescript-eslint/no-redundant-type-constituents": "warn",
      "@typescript-eslint/no-this-alias": "warn",
      "@typescript-eslint/no-unnecessary-type-parameters": "warn",
      "@typescript-eslint/no-unnecessary-type-arguments": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "warn",
      "@typescript-eslint/no-unnecessary-type-conversion": "warn",
      "@typescript-eslint/no-invalid-void-type": "warn",
      "@typescript-eslint/unbound-method": "warn",
      "@typescript-eslint/restrict-plus-operands": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/prefer-promise-reject-errors": "warn",

      "react/jsx-no-target-blank": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      "no-eval": "error",
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],

      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@antv/x6*"], message: "X6 只能在 @flow-designer/graph 包内使用" },
            { group: ["antd", "@alifd/*", "uxcore"], message: "壳包禁止引入 UI 组件库" },
            { group: ["lodash*"], message: "使用原生 API 替代 lodash" },
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["packages/graph/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            ...scenarioImports,
            {
              group: ["antd", "@ant-design/*", "@alifd/*", "uxcore"],
              message: "壳包禁止引入 UI 组件库",
            },
            { group: ["lodash*"], message: "使用原生 API 替代 lodash" },
          ],
        },
      ],
    },
  },
  {
    files: [
      "packages/setters/**/*.{ts,tsx}",
      "packages/plugins/**/*.{ts,tsx}",
      "packages/react/**/*.{ts,tsx}",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@antv/x6*"], message: "X6 只能在 @flow-designer/graph 包内使用" },
            ...scenarioImports,
            { group: ["@alifd/*", "uxcore"], message: "请使用 antd 替代其他 UI 组件库" },
            { group: ["lodash*"], message: "使用原生 API 替代 lodash" },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/{model,skeleton,engine}/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        { patterns: [...baseImports, ...scenarioImports] },
      ],
    },
  },
  {
    files: ["packages/model/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            ...baseImports,
            ...scenarioImports,
            coreUIImports,
            {
              group: ["@flow-designer/core", "@flow-designer/core/**", "**/core/src/**"],
              message: "Model cannot depend on application contracts or compatibility re-exports.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/core/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [...baseImports, ...scenarioImports, coreUIImports, reactRuntimeImports],
        },
      ],
    },
  },
  {
    files: [
      "**/vite.config.ts",
      "**/vitest.config.ts",
      "**/__tests__/**/*.{ts,tsx}",
      "e2e/**/*.{ts,tsx,mjs}",
    ],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ["packages/i18n/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            ...baseImports,
            ...scenarioImports,
            {
              group: ["@flow-designer/*", "**/model/src/**", "**/core/src/**", "**/engine/src/**"],
              message: "The translation runtime must not depend on editor packages.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/i18n/src/index.ts", "packages/i18n/src/catalog/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            ...baseImports,
            ...scenarioImports,
            reactRuntimeImports,
            {
              group: ["@flow-designer/*", "./react", "./react.*"],
              message: "Keep the translation entry independent from React and editor packages.",
            },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
);
