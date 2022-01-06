/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This is the Rollup configuration for the study template. It is
// part of the build system, and you should not have to modify it.

import commonjs from "@rollup/plugin-commonjs";
import replace from "@rollup/plugin-replace";
import resolve from "@rollup/plugin-node-resolve";
import typescript from '@rollup/plugin-typescript';
import webScienceRollupPlugin from "@mozilla/web-science/rollup-plugin";

/**
 * Helper to detect developer mode.
 *
 * @param cliArgs the command line arguments.
 * @return {Boolean} whether or not developer mode is enabled.
 */
function isDevMode(cliArgs) {
  return Boolean(cliArgs[ "config-enable-developer-mode" ]);
}

export default (cliArgs) => {
  // Configuration for the main background script, src/background.js.
  // The script will be output to dist/background.js with any module
  // dependencies (your own modules or modules from NPM) bundled in.
  const rollupConfig = [
    {
      input: "src/background.ts",
      output: {
        file: "dist/background.js",
        sourcemap: isDevMode(cliArgs) ? "inline" : false,
      },
      plugins: [
        replace({
          preventAssignment: true,
          // In Developer Mode, the study does not submit data and
          // gracefully handles communication errors with the Core
          // Add-on.
          __ENABLE_DEVELOPER_MODE__: isDevMode(cliArgs),
        }),
        resolve({
          browser: true,
        }),
        commonjs(),
        typescript(),
        webScienceRollupPlugin(),
      ],
    }
  ];

  return rollupConfig;
}