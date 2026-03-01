module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    'no-eval': 'error',
    'no-unused-vars': 'warn',
    'no-console': 'off',
  },
};
