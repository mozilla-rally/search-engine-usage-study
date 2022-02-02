/**
 * This module provides access to privileged functionality for getting/setting
 * the browser's default search engine and homepage.
 * 
 * @module Privileged
 */

/**
 * @return {Promise<string>} The name of the current default search engine.
 * @async
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
 * @return {Promise<string>} a "|" separated string of the homepage URLs.
 * @async
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
 * @param {string} searchEngine - the search engine that the default will be changed to.
 * Should be either "Google", "DuckDuckGo", "Yahoo", "Bing", "Ecosia", "Yandex", "Baidu", or "Ask".
 * @async
 */
export async function changeSearchEngine(searchEngine: string): Promise<void> {
  try {
    await browser.experimental.changeSearchEngine(searchEngine);
  } catch (error) {
    console.error(error);
  }
}

/**
 * Changes the browser homepage.
 * @param {string} homepage - the URL that the homepage should be changed to.
 * @async
 */
export async function changeHomepage(homepage: string): Promise<void> {
  try {
    await browser.experimental.changeHomepage(homepage);
  } catch (error) {
    console.error(error);
  }
}