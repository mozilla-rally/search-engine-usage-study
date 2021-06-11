import * as webScience from "@mozilla/web-science";
import * as Utils from "./Utils.js"
import * as SearchEngineUtils from "./SearchEngineUtils.js"

/**
 * @type {Array}
 * An array of the tracked search engine names
 */
const searchEngines = ["Google", "DuckDuckGo", "Bing", "Yahoo", "Ecosia", "Yandex", "Ask", "Baidu"]

/**
 * @type {Object}
 * An object that maps each of the tracked search engines to a set of queries made on the engine
 */
const searchEngineToQuerySetObject: { [engine: string]: Set<string> } = {}

/**
 * @type {Object}
 * A persistent key-value storage object for the study
 */
let storage;

/**
 * @type {number}
 * The milliseconds since epoch when daily collection started.
 */
let initialDailyCollectionStartTime;

/**
 * Start daily collection
 * @async
 **/
export async function start(storageIn: any): Promise<void> {
  storage = storageIn;

  // Get the initial start time of daily collection from storage.
  // If the value does not exist in storage, then this is the the intiial start time
  // of daily collection and we set the value in storage
  initialDailyCollectionStartTime = await storage.get("InitialDailyCollectionStartTime");
  if (!initialDailyCollectionStartTime) {
    initialDailyCollectionStartTime = Date.now();
    storage.set("InitialDailyCollectionStartTime", initialDailyCollectionStartTime);
  }

  await initializeQueryTracking();
  webScience.scheduling.onIdleDaily.addListener(reportDailyData);
}

/**
 * Callback for onIdleDaily.
 * Reports daily collection data.
 * Not spawning off worker because we are not doing significant data aggregation.
 * @async
 */
async function reportDailyData() {
  // Create object mapping each engine to the number of unique queries made to that engine
  // since the start of daily collection.
  const searchEngineToNumQueries: Array<{ SearchEngine: string, Queries: number }> = [];
  for (const searchEngine of searchEngines) {
    searchEngineToNumQueries.push({
      SearchEngine: searchEngine,
      Queries: searchEngineToQuerySetObject[searchEngine].size
    });
  }

  const regularTelemetrySubmission = {
    CurrentEngine: await Utils.getSearchEngine(),
    SerpVisitQueries: searchEngineToNumQueries,
    HistoryQueries: await SearchEngineUtils.getHistoryData(initialDailyCollectionStartTime),
    Time: Date.now(),
    TimeOffset: new Date().getTimezoneOffset(),
  };

  console.log(regularTelemetrySubmission);
}

/** 
 * Register the listeners for data from content scripts messages and initializes the data to store content script responses
 *  1. Registers the listener that gets SERP queries from content scripts and initializes the SERP query set for
 *     each search engine from storage
 *  2. Registers the listener that gets SERP visit data from content scripts and initializes the SERP visit data
 *     array from storage
 * @async
 */
async function initializeQueryTracking(): Promise<void> {
  // Initialize serpQuerySets from the stored list of queries made for each tracked search engines
  for (const searchEngine of searchEngines) {
    const queries = await storage.get(`${searchEngine}Queries`);
    searchEngineToQuerySetObject[searchEngine] = new Set(queries);
  }

  // Upon each onPageVisitStart event, get the engine and query for the URL of the new page
  // if the page is a SERP for one of the tracked engines. Add the query to the set of queries
  // for the respective engine.
  webScience.pageManager.onPageVisitStart.addListener(pageVisitStartDetails => {
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