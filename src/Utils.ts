import * as SearchEngineUtils from "./SearchEngineUtils.js"

/**
 * Return the default search engine
 * @returns {Promise} Promise object represents the name of the default search engine
 */
export async function getSearchEngine(): Promise<string> {
  try {
    return await browser.experimental.getSearchEngine();
  } catch (error) {
    console.error(error)
    return ""
  }
}

export async function getHomepage(): Promise<string> {
  try {
    const homepage = await browser.experimental.getHomepage();
    return SearchEngineUtils.getEngineFromURL(homepage);
  } catch (error) {
    console.error(error)
    return null;
  }
}

/**
 * Change the default search engine.
 * @param {string} searchEngine - the search engine that the default will be changed to.
 * Should be either Google, DuckDuckGo, Yahoo, Bing, Ecosia, Yandex, Baidu, or Ask
 */
export async function changeSearchEngine(searchEngine: string): Promise<void> {
  try {
    await browser.experimental.changeSearchEngine(searchEngine);
  } catch (error) {
    console.error(error)
  }
}

export async function changeHomepage(homepage: string): Promise<void> {
  try {
    await browser.experimental.changeHomepage(homepage);
  } catch (error) {
    console.error(error)
  }
}