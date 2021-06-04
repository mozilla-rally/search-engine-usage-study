import * as webScience from "@mozilla/web-science";
import * as Utils from "./Utils.js"
import * as SearchEngineUtils from "./SearchEngineUtils.js"

/**
 * An array of the tracked search engine names
 * @type {Array}
 * @private
 */
const searchEngines = ["Google", "DuckDuckGo", "Bing", "Yahoo", "Ecosia", "Yandex", "Ask", "Baidu"]

/**
 * An object that maps each of the tracked search engines to a set of queries made on the engine
 * @type {Object}
 * @private
 */
const searchEngineToQuerySetObject: { [engine: string]: Set<string> } = {}

let storage;

export async function startCollection(storageIn): Promise<void> {
  storage = storageIn;

  await registerQueryListener();
  webScience.scheduling.onIdleDaily.addListener(reportDailyData);
}

/**
 * Send telemetry submissions with study data
 * Not spawning off worker because we are not doing any additional data aggregation
 */
async function reportDailyData() {
  // Create object mapping each engine to the number of unique queries on that engine
  const searchEngineToNumQueries: Array<{ SearchEngine: string, UniqueQueries: number }> = []
  for (const searchEngine of searchEngines) {
    searchEngineToNumQueries.push({
      SearchEngine: searchEngine,
      UniqueQueries: searchEngineToQuerySetObject[searchEngine].size
    })
  }

  // Report regular telemetry submission and clear the list of search page visits data
  const regularTelemetrySubmission = {
    CurrentEngine: await Utils.getSearchEngine(),
    SearchEngineQueries: searchEngineToNumQueries,
    Time: Date.now(),
    TimeOffset: new Date().getTimezoneOffset(),
  }

  console.log(regularTelemetrySubmission)
}

/** 
 * Register the listeners for data from content scripts messages and initializes the data to store content script responses
 *  1. Registers the listener that gets SERP queries from content scripts and initializes the SERP query set for
 *     each search engine from storage
 *  2. Registers the listener that gets SERP visit data from content scripts and initializes the SERP visit data
 *     array from storage
 */
async function registerQueryListener(): Promise<void> {
  // Initialize serpQuerySets from the stored list of queries made for each tracked search engines
  for (const searchEngine of searchEngines) {
    const queries = await storage.get(`${searchEngine}Queries`)
    searchEngineToQuerySetObject[searchEngine] = new Set(queries)
  }


  webScience.pageManager.onPageVisitStart.addListener(pageVisitStartDetails => {
    console.log(pageVisitStartDetails.url);

    const engineAndQuery = SearchEngineUtils.getEngineAndQueryFromUrl(pageVisitStartDetails.url);
    if (engineAndQuery) {
      const engine = engineAndQuery.engine;
      const query = engineAndQuery.query;

      // Add the query to the set and update the list in storage
      searchEngineToQuerySetObject[engine].add(query);
      storage.set(`${engine}Queries`, Array.from(searchEngineToQuerySetObject[engine]));
    }
  })
}