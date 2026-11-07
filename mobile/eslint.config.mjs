import expoConfig from 'eslint-config-expo/flat.js';

export default [
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      'coverage/**',
      '__tests__/**',
      'scripts/**',
      'e2e/**',
      'babel.config.js',
      'jest.config.js',
      '.detoxrc.js',
    ],
  },
  ...expoConfig.map((config) => {
    const rules = { ...config.rules };
    if (rules['react-hooks/refs']) rules['react-hooks/refs'] = 'warn';
    if (rules['react-hooks/preserve-manual-memoization']) rules['react-hooks/preserve-manual-memoization'] = 'warn';
    if (rules['react-hooks/set-state-in-effect']) rules['react-hooks/set-state-in-effect'] = 'warn';
    if (rules['@typescript-eslint/no-require-imports']) rules['@typescript-eslint/no-require-imports'] = 'off';
    if (rules['@typescript-eslint/array-type']) rules['@typescript-eslint/array-type'] = 'off';
    if (rules['@typescript-eslint/no-explicit-any']) rules['@typescript-eslint/no-explicit-any'] = 'off';
    return { ...config, rules };
  }),
];
