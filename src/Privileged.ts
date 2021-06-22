/**
 * This module provides access to privileged functionality for getting/setting
 * the browser's default search engine and homepage.
 */

/**
 * @async
 * @return {Promise<string>} The name of the current default search engine.
 */
export async function getSearchEngine(): Promise<string> {
  try {
    return await browser.experimental.getSearchEngine();
  } catch (error) {
    console.error(error);
    return "";
  }
}

/**
 * @async
 * @return {Promise<string>} The url of the current homepage.
 */
export async function getHomepage(): Promise<string> {
  try {
    return await browser.experimental.getHomepage();
  } catch (error) {
    console.error(error);
    return "";
  }
}

/**
 * Changes the current default search engine.
 * @async
 * @param {string} searchEngine - the search engine that the default will be changed to.
 * Should be either Google, DuckDuckGo, Yahoo, Bing, Ecosia, Yandex, Baidu, or Ask
 */
export async function changeSearchEngine(searchEngine: string): Promise<void> {
  try {
    await browser.experimental.changeSearchEngine(searchEngine);
  } catch (error) {
    console.error(error);
  }
}

/**
 * Changes the current homepage.
 * @async
 * @param {string} homepage - the url that the homepage should be changed to.
 */
export async function changeHomepage(homepage: string): Promise<void> {
  try {
    await browser.experimental.changeHomepage(homepage);
  } catch (error) {
    console.error(error);
  }
}