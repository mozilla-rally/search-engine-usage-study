/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This is the Rollup configuration for the study template. It is
// part of the build system, and you should not have to modify it.

import commonjs from "@rollup/plugin-commonjs";
import replace from "@rollup/plugin-replace";
import resolve from "@rollup/plugin-node-resolve";
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

htmlPages.push(
  html({
    fileName: `pages/lottery_popup.html`,
    title: "Search Engine Study Lottery Winner",
    template: makeTemplate(
      fs.readFileSync("./src/pages/template.html", "utf8"),
      require("./src/pages/components/lottery-popup/LotteryPopup.svelte").default,
      null,
      "assets/js/lotteryPopup.js"
    ),
  })
);

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

  const pageScriptPaths = globby.sync([ `src/page-scripts/choiceBallot.ts`, `src/page-scripts/notice.ts`, `src/page-scripts/lotteryPopup.ts` ]);
  for(const pageScriptPath of pageScriptPaths) {
    rollupConfig.push({
      input: pageScriptPath,
      output: {
        file: `dist/pages/assets/js/${pageScriptPath.slice("src/page-scripts/".length, -3)}.js`,
        format: "iife",
        sourcemap: isDevMode(cliArgs) ? "inline" : false,
      },
      plugins: [
        replace({
          preventAssignment: true,
          __ENABLE_DEVELOPER_MODE__: isDevMode(cliArgs),
        }),
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
