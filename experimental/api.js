/**
 * @file Implementation for experimental API. This API implements the functionality for getting/setting
 * the browser's default search engine and homepage and also for popping up a modal dialog. This experimental
 * component is needed because the functionality described requires full chrome privileges which are not available from
 * the environment that a WebExtension runs in.
 */

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

// This pref stores the original search engine name, which will be restored on uninstall and the pref cleared.
const ORIGINAL_ENGINE_PREF = "extensions.search-engine-usage.oldEngine";

// This pref stores the original homepage, which will be restored on uninstall and the pref cleared.
const ORIGINAL_HOMEPAGE_PREF = "extensions.search-engine-usage.homepage";

/**
 * Using experiments_api feature to define new APIs linked to 
 * the extension. experimental is exposed under the global browser object and
 * is accessible from background scripts.
 */
this.experimental = class extends ExtensionAPI {
    getAPI() {
        return {
            experimental: {
                /**
                 * Pops up a modal dialog notifying the participant that their search engine has been changed
                 * and asks the participant if they would like to change it back.
                 * @param {string} searchEngineOld - the name of the search engine that their default was changed from.
                 * @param {string} searchEngineNew - the name of the search engine that their default was changed to.
                 * @param {boolean} modalPrimaryRevert - whether the option to change their search engine back on the modal dialog will be the primary button.
                 * @returns {Promise<boolean>} A promise to whether the participant chose to revert their search engine
                 * back to what it previously was.
                 */
                async createPopup(searchEngineOld, searchEngineNew, modalPrimaryRevert) {
                    // Returns whether the search engine should be reverted.
                    const flags =
                        Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0 +
                        Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1;

                    const modalTitle = `Change back to ${searchEngineOld} Search?`;
                    const modalText = ` The "Search Engine Usage and Result Quality" extension changed search to use ${searchEngineNew.toLowerCase()}.com`;

                    const keepEngineButtonText = "Keep it";
                    const revertEngineButtonText = "Change it back";
                    const primaryButtonText = modalPrimaryRevert ? revertEngineButtonText : keepEngineButtonText;
                    const secondaryButtonText = modalPrimaryRevert ? keepEngineButtonText : revertEngineButtonText;

                    const choice = await Services.prompt.asyncConfirmEx(
                        null,
                        Services.prompt.MODAL_TYPE_WINDOW,
                        modalTitle,
                        modalText,
                        flags,
                        primaryButtonText,
                        secondaryButtonText,
                        null,
                        null,
                        {}
                    );

                    return choice.get("buttonNumClicked") === (modalPrimaryRevert ? 0 : 1);
                },
                /**
                 * Changes the participant's default search engine.
                 * @param {string} searchEngineName - the name of the search engine to make default.
                 * @param {boolean} revert - whether we are reverting a previous change of the default
                 * search engine by the study extension.
                 */
                async changeSearchEngine(searchEngineName, revert) {
                    if(revert) {
                        Services.prefs.clearUserPref(ORIGINAL_ENGINE_PREF);
                    } else {
                        const originalSearchEngine = await this.getSearchEngine();
                        Services.prefs.setCharPref(ORIGINAL_ENGINE_PREF, originalSearchEngine);
                    }

                    const searchEngineDetailsObject = {
                        Google: {
                            name: "Google",
                            search_url: encodeURI("https://www.google.com/search?q={searchTerms}"),
                            suggest_url: encodeURI("http://suggestqueries.google.com/complete/search"),
                            suggest_url_get_params: "output=firefox&q={searchTerms}",
                            favicon_url: "https://www.google.com/favicon.ico",
                            keyword: "@google",
                        },
                        Bing: {
                            name: "Bing",
                            search_url: encodeURI("http://www.bing.com/search?q={searchTerms}"),
                            suggest_url: encodeURI("http://api.bing.com/osjson.aspx"),
                            suggest_url_get_params: "query={searchTerms}&language={language}&form=OSDJAS",
                            favicon_url: "https://www.bing.com/favicon.ico",
                            keyword: "@bing",
                        },
                        Yahoo: {
                            name: "Yahoo!",
                            search_url: encodeURI("https://search.yahoo.com/search?p={searchTerms}"),
                            suggest_url: encodeURI("https://search.yahoo.com/sugg/os"),
                            suggest_url_get_params: "command={searchTerms}&output=fxjson&fr=opensearch",
                            favicon_url: "https://www.yahoo.com/favicon.ico",
                            keyword: "@yahoo",
                        },
                        DuckDuckGo: {
                            name: "DuckDuckGo",
                            search_url: encodeURI("https://duckduckgo.com/?q={searchTerms}"),
                            suggest_url: encodeURI("https://duckduckgo.com/ac"),
                            suggest_url_get_params: "q={searchTerms}&type=list",
                            favicon_url: "https://duckduckgo.com/favicon.ico",
                            keyword: "@duckduckgo",
                        },
                        Ecosia: {
                            name: "Ecosia",
                            search_url: encodeURI("https://www.ecosia.org/search?q={searchTerms}"),
                            suggest_url: encodeURI("https://ac.ecosia.org/autocomplete"),
                            suggest_url_get_params: "q={searchTerms}&type=list",
                            favicon_url: "https://cdn.ecosia.org/assets/images/ico/favicon.ico",
                            keyword: "@ecosia",
                        },
                        Brave: {
                            name: "Brave",
                            search_url: encodeURI("https://search.brave.com/search?q={searchTerms}"),
                            suggest_url: encodeURI("https://search.brave.com/api/suggest"),
                            suggest_url_get_params: "q={searchTerms}",
                            favicon_url: "https://cdn.search.brave.com/serp/v1/static/brand/eebf5f2ce06b0b0ee6bbd72d7e18621d4618b9663471d42463c692d019068072-brave-lion-favicon.png",
                            keyword: "@brave",
                        },
                        Baidu: {
                            name: "Baidu",
                            search_url: encodeURI("https://www.baidu.com/s?wd={searchTerms}"),
                            suggest_url: encodeURI("https://suggestion.baidu.com/su"),
                            suggest_url_get_params: "wd={searchTerms}&action=opensearch",
                            favicon_url: "https://www.baidu.com/favicon.ico",
                            keyword: "@baidu",
                        },
                        Ask: {
                            name: "Ask.com",
                            search_url: encodeURI("https://www.ask.com/web?q={searchTerms}"),
                            suggest_url: encodeURI("https://amg-ss.ask.com/query"),
                            suggest_url_get_params: "q={searchTerms}",
                            favicon_url: "https://www.ask.com/logo.png",
                            keyword: "@ask",
                        },
                    };

                    // Wait for the search service to initialize and un-hide all the default engines
                    await Services.search.init();
                    Services.search.restoreDefaultEngines();

                    let searchEngine = null;

                    // Retrieves the engine we are attempting to make default
                    // from the list of installed engines
                    const installedSearchEngines = await Services.search.getEngines();
                    for(const installedSearchEngine of installedSearchEngines) {
                        if(installedSearchEngine.name.toLowerCase().includes(searchEngineName.toLowerCase())) {
                            searchEngine = installedSearchEngine;
                            break;
                        }
                    }

                    // If the engine we are attempting to make default is not
                    // already installed, we manually add the search engine.
                    if(!searchEngine) {
                        if(searchEngineName in searchEngineDetailsObject) {
                            const searchEngineDetails = searchEngineDetailsObject[ searchEngineName ];

                            searchEngine = await Services.search.wrappedJSObject._createAndAddEngine({
                                extensionID: "search-engine-usage@rally.mozilla.org",
                                extensionBaseURI: "",
                                isAppProvided: false,
                                manifest: {
                                    chrome_settings_overrides: {
                                        search_provider: {
                                            name: searchEngineDetails.name,
                                            search_url: searchEngineDetails.search_url,
                                            suggest_url: searchEngineDetails.suggest_url,
                                            suggest_url_get_params: searchEngineDetails.suggest_url_get_params,
                                            keyword: searchEngineDetails.keyword,
                                            favicon_url: searchEngineDetails.favicon_url,
                                        },
                                    },
                                    description: `${searchEngineDetails.name} Search`,
                                },
                            });
                        } else {
                            return;
                        }


                    }

                    // Make sure the engine is not hidden, move it to the top of the list of options, and make it the default
                    searchEngine.hidden = false;
                    Services.search.moveEngine(searchEngine, 0);
                    Services.search.defaultEngine = searchEngine;
                },
                /**
                 * @returns {Promise<string>} A promise for the participant's current default search engine in the browser.
                 */
                async getSearchEngine() {
                    await Services.search.init();
                    const defaultEngine = await Services.search.getDefault();
                    return defaultEngine ? defaultEngine.name : "";
                },
                /**
                 * Changes the participant's current homepage in the browser.
                 * @param {string} homepage - The URL that the homepage should be changed to.
                 */
                changeHomepage(homepage) {
                    if(homepage == "about:home") {
                        Services.prefs.setCharPref(ORIGINAL_HOMEPAGE_PREF, Services.prefs.getCharPref("browser.startup.homepage"));
                    }

                    Services.prefs.setCharPref("browser.startup.homepage", homepage);
                },
                /**
                 * @returns {Promise<string>} A promise for the participant's current "|" separated homepage URLs.
                 */
                async getHomepage() {
                    return Services.prefs.getCharPref("browser.startup.homepage");
                }
            }
        }
    }

    onShutdown() {
        try {
            let searchEngine = null;
            const searchEngineName = Services.prefs.getCharPref(ORIGINAL_ENGINE_PREF);
            if(searchEngineName) {
                // Retrieves the engine we are attempting to make default
                // from the list of installed engines
                Services.search.getEngines().then(installedSearchEngines => {
                    for(const installedSearchEngine of installedSearchEngines) {
                        if(installedSearchEngine.name.toLowerCase().includes(searchEngineName.toLowerCase())) {
                            searchEngine = installedSearchEngine;
                            break;
                        }
                    }

                    // Make sure the engine is not hidden, move it to the top of the list of options, and make it the default
                    searchEngine.hidden = false;
                    Services.search.moveEngine(searchEngine, 0);
                    Services.search.defaultEngine = searchEngine;
                });
            }
            Services.prefs.clearUserPref(ORIGINAL_ENGINE_PREF);
        } catch(error) {
            Services.search.resetToOriginalDefaultEngine();
        }

        try {
            const homepage = Services.prefs.getCharPref(ORIGINAL_HOMEPAGE_PREF);
            if(homepage) {
                Services.prefs.setCharPref("browser.startup.homepage", homepage);
            }
            Services.prefs.clearUserPref(ORIGINAL_HOMEPAGE_PREF);
        } catch(error) {
            // Do nothing
        }
    }
}