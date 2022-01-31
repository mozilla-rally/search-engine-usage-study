/**
 * @file Implementation for experimental API. This API implements the functionality for getting/setting 
 * the browser's default search engine and homepage and also for popping up a modal dialog. This experimental
 * component is needed because the functionality described requires full chrome privileges which are not available from
 * the environment that a WebExtension runs in.
 */

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

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
                 * Should be either "Google", "DuckDuckGo", "Yahoo", "Bing", "Ecosia", "Yandex", "Baidu", or "Ask".
                 */
                async changeSearchEngine(searchEngineName) {
                    const searchEngineDetailsObject = {
                        Google: {
                            iconURL: "https://www.google.com/favicon.ico",
                            alias: "@google",
                        },
                        Bing: {
                            iconURL: "https://www.bing.com/favicon.ico",
                            alias: "@bing",
                        },
                        Yahoo: {
                            iconURL: "https://www.yahoo.com/favicon.ico",
                            alias: "@yahoo",
                        },
                        DuckDuckGo: {
                            iconURL: "https://duckduckgo.com/favicon.ico",
                            alias: "@duckduckgo",
                        },
                        Ecosia: {
                            iconURL: "https://cdn.ecosia.org/assets/images/ico/favicon.ico",
                            alias: "@ecosia",
                        },
                        Yandex: {
                            iconURL: "https://yastatic.net/iconostasis/_/KKii9ECKxo3QZnchF7ayZhbzOT8.png",
                            alias: "@yandex",
                        },
                        Baidu: {
                            iconURL: "https://www.baidu.com/favicon.ico",
                            alias: "@baidu",
                        },
                        Ask: {
                            iconURL: "https://www.ask.com/logo.png",
                            alias: "@ask",
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
                    // already installed, we add it through an OpenSearch xml file
                    // served through AWS S3 + Cloudfront. We have all logging for the S3
                    // bucket and the Cloudfront distribution turned off to protect participant privacy.
                    if(!searchEngine) {
                        searchEngine = await Services.search.addOpenSearchEngine(`https://d1p7omvsla1afa.cloudfront.net/${searchEngineName}.xml`, searchEngineDetailsObject[ searchEngineName ].iconURL);
                        searchEngine.alias = searchEngineDetailsObject[ searchEngineName ].alias;
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
                 * Changes the participant's current homepages in the browser.
                 * @param {string} homepages - a "|" separated string of the URLs that the homepages should be changed to.
                 */
                changeHomepage(homepages) {
                    Services.prefs.setCharPref("browser.startup.homepage", homepages);
                },
                /**
                 * @returns {Promise<string>} A promise for the participant's current "|" separated homepage URLs.
                 */
                async getHomepage() {
                    return Services.prefs.getCharPref("browser.startup.homepage");
                },


            }
        }
    }
}