/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
    webextensions: true,
    jquery: true,
  },
  ignorePatterns: [ "jquery.js" ],
  extends: [
    "eslint:recommended",
    "plugin:import/warnings",
    "plugin:node/recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  overrides: [
    {
      files: "tests/**",
      env: {
        mocha: true,
      },
      extends: [
        "plugin:mocha/recommended",
      ],
    },
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
  },
  plugins: [
    "import",
    "node",
    "mocha",
    "@typescript-eslint"
  ],
  root: true,
  rules: {
    "node/no-deprecated-api": "error",
    "node/no-extraneous-require": "off",
    "node/no-missing-import": "off",
    "node/no-unpublished-import": "off",
    "node/no-unpublished-require": "off",
    "node/no-unsupported-features/es-syntax": "off",
    "no-multi-spaces": "error",
    "no-var": "warn",
    "prefer-const": "off",
    "no-undef": 'off',
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off"
  },
  parser: "@typescript-eslint/parser",
  globals: {
    ChromeUtils: false,
    ExtensionAPI: false,
    __ENABLE_DEVELOPER_MODE__: false,
  }
};
