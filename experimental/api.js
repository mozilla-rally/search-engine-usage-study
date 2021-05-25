/**
 * @file Implementation for experimental API.
 * 
 * It provides definitions for the functions and events
 * defined in the schema.
 * @module WebScience.Experiments.experimental
 */

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

/**
 * @description Using experiments_api feature to define new APIs linked to 
 * the extension. experimental is exposed under the global browser object and 
 * is accessible from background scripts.
 */
this.experimental = class extends ExtensionAPI {
    getAPI() {
        return {
            experimental: {
                createPopup(searchEngineOld, searchEngineNew, modalPrimaryRevert) {
                    // Returns whether the search engine should be reverted.
                    const flags =
                        Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0 +
                        Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1;

                    if(modalPrimaryRevert) {
                        const x = Services.prompt.confirmEx(
                            null,
                            `Change back to ${searchEngineOld} Search?`,
                            `Your search engine has been changed to use ${searchEngineNew}.`,
                            flags,
                            "Change it back",
                            "Keep it",
                            null,
                            null,
                            {}
                        );
                        return x === 0;
                    } else {
                        const x = Services.prompt.confirmEx(
                            null,
                            `Change back to ${searchEngineOld} Search?`,
                            `Your search engine has been changed to use ${searchEngineNew}.`,
                            flags,
                            "Keep it",
                            "Change it back",
                            null,
                            null,
                            {}
                        );
                        return x === 1;
                    }
                },
                /**
                 * Changes the user's default search engine
                 * 
                 * @function
                 * @param {string} searchEngineName - name of search engine to make default
                 */
                async changeSearchEngine(searchEngineNameIn) {
                    const searchEngineDetailsObject = {
                        google: {
                            iconURL: "https://www.google.com/favicon.ico",
                            alias: "@google",
                        },
                        bing: {
                            iconURL: "https://www.bing.com/favicon.ico",
                            alias: "@bing",
                        },
                        yahoo: {
                            iconURL: "https://www.yahoo.com/favicon.ico",
                            alias: "@yahoo",
                        },
                        duckduckgo: {
                            iconURL: "https://duckduckgo.com/favicon.ico",
                            alias: "@duckduckgo",
                        },
                        ecosia: {
                            iconURL: "https://cdn.ecosia.org/assets/images/ico/favicon.ico",
                            alias: "@ecosia",
                        },
                        yandex: {
                            iconURL: "https://yastatic.net/iconostasis/_/KKii9ECKxo3QZnchF7ayZhbzOT8.png",
                            alias: "@yandex",
                        },
                        baidu: {
                            iconURL: "https://www.baidu.com/favicon.ico",
                            alias: "@baidu",
                        },
                        ask: {
                            iconURL: "https://www.ask.com/logo.png",
                            alias: "@ask",
                        },
                    }

                    const searchEngineName = searchEngineNameIn.toLowerCase();

                    // Wait for the search service to initialize and un-hide all the default engines
                    await Services.search.init()
                    Services.search.restoreDefaultEngines();

                    let searchEngine = null

                    // Retrieves the engine we are attempting to make default
                    // from the list of installed engines
                    const installedSearchEngines = await Services.search.getEngines()
                    for(const installedSearchEngine of installedSearchEngines) {
                        if(installedSearchEngine.name.toLowerCase().includes(searchEngineName)) {
                            searchEngine = installedSearchEngine
                            break
                        }
                    }

                    // If the engine we are attempting to make default is not
                    // already installed, swe add it through an OpenSearch xml file
                    if(!searchEngine) {
                        searchEngine = await Services.search.addOpenSearchEngine(`https://citpsearch.cs.princeton.edu/searchengine/openSearch/${searchEngineName}.xml`, searchEngineDetailsObject[ searchEngineName ].iconURL)
                        searchEngine.alias = searchEngineDetailsObject[ searchEngineName ].alias
                    }

                    // Make sure the engine is not hidden, move it to the top of the list of options, and make it the default
                    searchEngine.hidden = false
                    Services.search.moveEngine(searchEngine, 0);
                    Services.search.defaultEngine = searchEngine
                },
                /**
                 * Get the user's current default search engine
                 * @function
                 */
                async getSearchEngine() {
                    await Services.search.init();
                    const defaultEngine = await Services.search.getDefault()
                    return defaultEngine ? defaultEngine.name : "";
                },
                /**
                 * Get the user's current default search engine
                 * @function
                 * @param {string} newHomepage - url of the new homepage
                 */
                changeHomepage(newHomepage) {
                    Services.prefs.setCharPref("browser.startup.homepage", newHomepage)
                },
                /**
                 * Get the user's current default search engine
                 * @function
                 */
                async getHomepage() {
                    return Services.prefs.getCharPref("browser.startup.homepage")
                },


            }
        }
    }
}