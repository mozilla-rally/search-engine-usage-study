/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This is the Rollup configuration for the study template. It is
// part of the build system, and you should not have to modify it.

import commonjs from "@rollup/plugin-commonjs";
import replace from "@rollup/plugin-replace";
import resolve from "@rollup/plugin-node-resolve";
<<<<<<< HEAD
import globby from "globby";
import typescript from '@rollup/plugin-typescript';
import webScienceRollupPlugin from "@mozilla/web-science/rollup-plugin";
import svelte from 'rollup-plugin-svelte';
import html from "@rollup/plugin-html"
import fs from "fs";
import copy from 'rollup-plugin-copy'
require("svelte/register");

function makeTemplate(templateData, svelteComponent, props, scriptSrc) {
  return ({ attributes, bundle, files, publicPath, title }) => {
    const body = svelteComponent.render(props).html;
    return templateData.replace("%%BODY%%", body).replace("%%TITLE%%", title).replace("%%SCRIPT%%", scriptSrc);
  };
}

const htmlPages = [];

const choiceBallotTypes = [ "Default", "HiddenDescription", "VisibleDescription", "Extended" ];
for(let index = 0; index < choiceBallotTypes.length; index++) {
  const choiceBallotType = choiceBallotTypes[ index ];
  htmlPages.push(
    html({
      fileName: `pages/choice_ballot_${index + 1}.html`,
      title: "Search Engine Choice Ballot",
      template: makeTemplate(
        fs.readFileSync("./src/pages/template.html", "utf8"),
        require("./src/pages/components/choice-ballot/ChoiceBallot.svelte").default,
        { choiceBallotType },
        "assets/js/choiceBallot.js"
      ),
    })
  );
}

const revertOptions = [ false, true ];
for(let index = 0; index < revertOptions.length; index++) {
  const revertOption = revertOptions[ index ];
  htmlPages.push(
    html({
      fileName: `pages/notice_${index + 1}.html`,
      title: "Search Engine Change Notice",
      template: makeTemplate(
        fs.readFileSync("./src/pages/template.html", "utf8"),
        require("./src/pages/components/notice/Notice.svelte").default,
        { revertOption },
        "assets/js/notice.js"
      ),
    })
  );
}
=======
import copy from "rollup-plugin-copy";
import globby from "globby";
import webScienceRollupPlugin from "@mozilla/web-science/rollup-plugin";
>>>>>>> study-template/main

/**
 * Helper to detect developer mode.
 *
 * @param cliArgs the command line arguments.
 * @return {Boolean} whether or not developer mode is enabled.
 */
function isDevMode(cliArgs) {
<<<<<<< HEAD
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
        svelte({
          compilerOptions: {
            hydratable: true,
          }
        }),
        ...htmlPages,
        copy({
          targets: [
            { src: 'src/pages/assets/*', dest: 'dist/pages/assets' },
          ]
        })
      ],
    }
  ];

  const pageScriptPaths = globby.sync([ `src/page-scripts/choiceBallot.ts`, `src/page-scripts/notice.ts` ]);
  for(const pageScriptPath of pageScriptPaths) {
    rollupConfig.push({
      input: pageScriptPath,
      output: {
        file: `dist/pages/assets/js/${pageScriptPath.slice("src/page-scripts/".length, -3)}.js`,
        format: "iife",
        sourcemap: isDevMode(cliArgs) ? "inline" : false,
      },
      plugins: [
        webScienceRollupPlugin(),
        resolve({
          browser: true,
        }),
        typescript(),
        commonjs(),
      ],
    });
  }

  const contentScriptPaths = globby.sync([ `src/content-scripts/serp-scripts/*.ts` ]);
  for(const contentScriptPath of contentScriptPaths) {
    rollupConfig.push({
      input: contentScriptPath,
      output: {
        file: `dist/${contentScriptPath.slice("src/".length, -3)}.js`,
        format: "iife",
        sourcemap: isDevMode(cliArgs) ? "inline" : false,
      },
      plugins: [
        webScienceRollupPlugin(),
        resolve({
          browser: true,
        }),
        typescript(),
        commonjs(),
      ],
    });
  }

  return rollupConfig;
}
=======
    return Boolean(cliArgs["config-enable-developer-mode"]);
}

/**
 * Helper to detect emulator mode.
 *
 * @param cliArgs the command line arguments.
 * @return {Boolean} whether or not emulator mode is enabled.
 */
function isEmulatorMode(cliArgs) {
    return Boolean(cliArgs["config-enable-emulator-mode"]);
}

export default (cliArgs) => {
    // Configuration for the main background script, src/background.js.
    // The script will be output to dist/background.js with any module
    // dependencies (your own modules or modules from NPM) bundled in.
    const rollupConfig = [
        {
            input: "src/background.js",
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
                    __ENABLE_EMULATOR_MODE__: isEmulatorMode(cliArgs),
                }),
                webScienceRollupPlugin(),
                resolve({
                    browser: true,
                }),
                commonjs()
            ],
        }
    ];

    // Configuration for content scripts (src/**/*.content.js) and
    // worker scripts (src/**/*.worker.js). These files will be
    // output to dist/ with the same relative path they have in
    // src/, but with any module dependencies (your own modules or
    // modules from npm) bundled in. We provide this configuration
    // because content scripts and worker scripts have separate
    // execution environments from background scripts, and a
    // background script might want to reference the bundled
    // scripts (e.g., browser.contentScripts.register() or new
    // Worker()).
    const scriptPaths = globby.sync([`src/**/*.content.js`, `src/**/*.worker.js`]);
    for (const scriptPath of scriptPaths) {
        rollupConfig.push({
            input: scriptPath,
            output: {
                file: `dist/${scriptPath.slice("src/".length)}`,
                format: "iife",
                sourcemap: isDevMode(cliArgs) ? "inline" : false,
            },
            plugins: [
                webScienceRollupPlugin(),
                resolve({
                    browser: true,
                }),
                commonjs(),
                // Copy in the Rally SDK content script and webextension polyfill.
                copy({
                    targets: [{
                        src: [
                            "node_modules/@mozilla/rally/dist/rally-content.js",
                        ],
                        dest: "dist/content/",
                    }],
                    flatten: true,
                }),
                copy({
                    targets: [{
                        src: [
                            "node_modules/webextension-polyfill/dist/browser-polyfill.js",
                        ],
                        dest: "dist/",
                    }],
                    flatten: true,
                }),
            ],
        });
    }

    return rollupConfig;
}
>>>>>>> study-template/main
