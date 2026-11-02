import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

// Shared framework packages must not depend on scenario packages, even via subpaths.
const scenarioImports = [
  {
    group: ['@flow-designer/bpmn-*', '@flow-designer/bpmn-*/**', '@flow-designer/comfyui-*', '@flow-designer/comfyui-*/**', '@flow-designer/er-*', '@flow-designer/er-*/**', '**/apps/**'],
    message: 'Scenario dependencies belong in apps/, not shared framework packages.',
  },
]
const baseImports = [
  { group: ['@antv/x6*'], message: 'X6 只能在 @flow-designer/graph 包内使用' },
  { group: ['antd', 'antd/**', '@ant-design/*', '@alifd/*', 'uxcore'], message: '壳包禁止引入 UI 组件库' },
  { group: ['lodash*'], message: '使用原生 API 替代 lodash' },
]
const coreUIImports = {
  group: ['@flow-designer/react', '@flow-designer/react/**', '@flow-designer/skeleton', '@flow-designer/skeleton/**', '@flow-designer/setters', '@flow-designer/setters/**', '@flow-designer/plugins', '@flow-designer/plugins/**', '@flow-designer/engine', '@flow-designer/engine/**', '**/react/src/**', '**/skeleton/src/**', '**/setters/src/**', '**/plugins/src/**', '**/engine/src/**'],
  message: 'Core must depend on model contracts rather than UI or composition layers.',
}
const reactRuntimeImports = {
  group: ['react', 'react/**', 'react-dom', 'react-dom/**'],
  allowTypeImports: true,
  message: 'Keep React runtime code outside core; type-only imports are allowed.',
}

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**'] },
  ...tseslint.configs.strictTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

      'react/jsx-no-target-blank': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      'no-console': 'error',
      'no-debugger': 'error',
      'no-eval': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],

      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@antv/x6*'], message: 'X6 只能在 @flow-designer/graph 包内使用' },
          { group: ['antd', '@alifd/*', 'uxcore'], message: '壳包禁止引入 UI 组件库' },
          { group: ['lodash*'], message: '使用原生 API 替代 lodash' },
        ],
      }],
    },
  },
  {
    files: ['packages/graph/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          ...scenarioImports,
          { group: ['antd', '@ant-design/*', '@alifd/*', 'uxcore'], message: '壳包禁止引入 UI 组件库' },
          { group: ['lodash*'], message: '使用原生 API 替代 lodash' },
        ],
      }],
    },
  },
  {
    files: [
      'packages/setters/**/*.{ts,tsx}',
      'packages/plugins/**/*.{ts,tsx}',
      'packages/react/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@antv/x6*'], message: 'X6 只能在 @flow-designer/graph 包内使用' },
          ...scenarioImports,
          { group: ['@alifd/*', 'uxcore'], message: '请使用 antd 替代其他 UI 组件库' },
          { group: ['lodash*'], message: '使用原生 API 替代 lodash' },
        ],
      }],
    },
  },
  {
    files: ['packages/{model,skeleton,engine}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [...baseImports, ...scenarioImports] }],
    },
  },
  {
    files: ['packages/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [...baseImports, ...scenarioImports, coreUIImports, reactRuntimeImports],
      }],
    },
  },
)
