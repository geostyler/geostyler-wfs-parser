module.exports = {
  extends: '@terrestris/eslint-config-typescript',
  rules: {
    'no-underscore-dangle': 'off',
    camelcase: [
      'off',
      {
        ignoreImports: true
      }
    ]
  }
};
