/**
 * This module enables regular collection of the participant's default search engine
 * and the number of unique queries made to search engines.
 */

import * as webScience from "@mozilla/web-science";
import * as Privileged from "./Privileged.js"
import * as Utils from "./Utils.js"

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
 * The timestamp when regular reporting started
 */
let initialRegularCollectionStartTime;

/**
 * Start regular collection
 * @async
 **/
export async function start(storageIn: any): Promise<void> {
  storage = storageIn;

  // Get the initial start time of regular collection from storage.
  // If the value does not exist in storage, then this is the the initial start time
  // of regular collection and we set the value in storage
  initialRegularCollectionStartTime = await storage.get("InitialRegularCollectionStartTime");
  if (!initialRegularCollectionStartTime) {
    initialRegularCollectionStartTime = webScience.timing.now();
    storage.set("InitialRegularCollectionStartTime", initialRegularCollectionStartTime);
  }

  await initializeQueryTracking();
  webScience.scheduling.onIdleDaily.addListener(reportRegularData);
}

/**
 * Callback for onIdleDaily.
 * Reports regular collection data.
 * Not spawning off worker because we are not doing significant data aggregation.
 * @async
 */
async function reportRegularData() {
  // Create object mapping each engine to the number of unique queries made to that engine
  // since the start of regular collection.
  const searchEngineToNumQueries: Array<{ SearchEngine: string, Queries: number }> = [];
  for (const searchEngine of searchEngines) {
    searchEngineToNumQueries.push({
      SearchEngine: searchEngine,
      Queries: searchEngineToQuerySetObject[searchEngine].size
    });
  }

  const regularTelemetrySubmission = {
    CurrentEngine: await Privileged.getSearchEngine(),
    SerpVisitQueries: searchEngineToNumQueries,
    HistoryQueries: await Utils.getHistoryData(initialRegularCollectionStartTime),
    Time: webScience.timing.now(),
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
    const engineAndQuery = Utils.getEngineAndQueryFromUrl(pageVisitStartDetails.url);
    if (engineAndQuery) {
      const engine = engineAndQuery.engine;
      const query = engineAndQuery.query;

      // Add the query to the set and update the list in storage
      searchEngineToQuerySetObject[engine].add(query);
      storage.set(`${engine}Queries`, Array.from(searchEngineToQuerySetObject[engine]));
    }
  })
}