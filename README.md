# Search Engine Usage Study [DECOMMISSIONED]
A study to assess how individuals interact with their search engines.

## Requirements
* [Node.js](https://nodejs.org/en/), available via [Homebrew](https://brew.sh/) on macOS
* [Mozilla web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/)

## Supported NPM commands
The repo comes with a set of pre-defined NPM commands (to run as `npm run <command>`):

* `compile-typescript`: Compiles the Typescript source code. The compiled code is saved in the `src/` directory.
* `build`: assembles the final addon. The bundler generated code is saved in the `dist/` directory.
* `dev`: assembles the addon in _developer mode_. In this mode data doesn't get submitted but, instead, is dumped to the [Browser Console](https://developer.mozilla.org/en-US/docs/Tools/Browser_Console). This mode allows for a smoother development process.
* `lint`: run linting on the add-on code.
* `package`: packages the final archive containing the bundled addon, is saved in the `web-ext-artifacts` directory.
* `start`: build the addon and run a Firefox instance and side-load the add-on for manual testing or debugging purposes.
* `test-integration`: perform the provided integration test for the final addon.
* `watch`: assembles the addon in _developer mode_, then runs the browser and watches the source code for changes, automatically reloading the extension when needed.

## Manual testing in the browser
To test, either load as a temporary add-on in Firefox (`about:debugging`) or Chrome ("developer mode" in `chrome://extensions`) or use `npm run start`.

Debugging output is available in Tools → Web Developer → Browser Console. Make sure that the Show Content Messages option is checked. You might find it helpful to set a filter for debugging messages of interest.
