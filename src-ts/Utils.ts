/**
 * Return the default search engine
 * @returns {Promise} Promise object represents the name of the default search engine
 */
export async function getSearchEngine(): Promise<string> {
  try {
    return await browser.experimental.getSearchEngine();
  } catch (error) {
    return "ERROR"
  }
}

let originalHomepage = null;
let originalEngine = null;

/**
 * Revert changes from call to changeSearchEngine.
 */
export async function revertSearchEngine(): Promise<void> {
  try {
    if (originalHomepage) {
      browser.experimental.changeHomepage(originalHomepage);
    }
  } catch (error) {
    console.error(error);
  }

  try {
    if (originalEngine) {
      await browser.experimental.changeSearchEngine(originalEngine);
    }
  } catch (error) {
    console.error(error);
  }
}


/**
 * Change the default search engine.
 * @param {string} searchEngine - the search engine that the default will be changed to.
 * Should be either Google, DuckDuckGo, Yahoo, Bing, Ecosia, Yandex, Baidu, or Ask
 */
export async function changeSearchEngine(searchEngine: string): Promise<void> {
  try {
    const homepage = await browser.experimental.getHomepage();

    // If the current home page is a search engine page, change it to the default Firefox homepage
    const homepageLowercase = homepage.toLowerCase()
    if (homepageLowercase.includes("google") || homepageLowercase.includes("bing") ||
      homepageLowercase.includes("yahoo") || homepageLowercase.includes("duckduckgo") ||
      homepageLowercase.includes("ecosia") || homepageLowercase.includes("ask") ||
      homepageLowercase.includes("baidu") || homepageLowercase.includes("yandex")) {
      originalHomepage = homepage;
      browser.experimental.changeHomepage("about:home");
    }
  } catch (error) {
    console.error(error);
  }

  try {
    originalEngine = await getSearchEngine();
    await browser.experimental.changeSearchEngine(searchEngine);
  } catch (error) {
    console.error(error)
  }
}
