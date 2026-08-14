import reactHooks from 'eslint-plugin-react-hooks';

// @eslint/js（eslint:recommended 相当のフラットコンフィグ）は package.json に
// 無いため追加しておらず、ここでは代わりにバグに直結するコア ルールだけを
// 手動で有効化している。スタイル系のルールは意図的に含めていない。
const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  localStorage: 'readonly',
  fetch: 'readonly',
  URL: 'readonly',
  Blob: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  URLSearchParams: 'readonly',
  btoa: 'readonly',
  Uint8Array: 'readonly',
  performance: 'readonly',
  requestAnimationFrame: 'readonly',
  sessionStorage: 'readonly',
  FileReader: 'readonly',
  Image: 'readonly',
};

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: browserGlobals,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // eslint-plugin-react-hooks v7 の recommended には React Compiler 向けの
      // 追加ルール（react-hooks/refs, react-hooks/set-state-in-effect 等）が
      // 大量に含まれており、React Compiler を使わないこの構成では既存の正当な
      // パターン（レンダー中の ref 参照によるダーティ判定、マウント時の
      // setState 等）まで error として検出してしまう。ここでは従来からの
      // 標準的な2ルールのみを有効にする。
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-const-assign': 'error',
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-class-members': 'error',
      'no-unreachable': 'error',
      'no-fallthrough': 'error',
      'no-case-declarations': 'error',
      'no-redeclare': 'error',
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-func-assign': 'error',
      'no-import-assign': 'error',
      'no-unsafe-negation': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
    },
  },
];
