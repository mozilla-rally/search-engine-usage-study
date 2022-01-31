/**
 * This module enables registering SERP content scripts and collecting 
 * data for SERP visits.
 * 
 * @module SerpVisitCollection
 */

import * as webScience from "@mozilla/web-science";
import * as AttributionTracking from "./AttributionTracking.js"
import * as Privileged from "./Privileged.js"
import * as Utils from "./Utils.js"
import * as ContentScripts from "./ContentScripts.js"

/**
 * For each of the search engines, maps queries to the last time the query was made on the engine.
 * @type {Object}
 */
const searchEngineQueryTimes: { [searchEngine: string]: { [query: string]: number } } = {}


/**
 * A persistent key-value storage object for the study
 * @type {Object}
 */
let storage;

/**
 * Start SERP visit collection
 * @async
 **/
export async function initializeCollection(conditionType, storageArg): Promise<void> {
  storage = storageArg;
  await initializeQuerySetsFromStorage();
  registerSerpVisitDataListener();
  await ContentScripts.registerContentScripts(conditionType);
}

/**
 * Report data for a SERP visit.
 * @async
 */
async function reportSerpVisitData(pageVisitData): Promise<void> {
  // Get attribution details from AttributionTracking
  const attributionDetails = AttributionTracking.getAttributionForPageId(pageVisitData.pageId);
  const attributionDetailsEngineMatches = attributionDetails && attributionDetails.engine === pageVisitData.searchEngine;


  // The last time the query was made to the search engine, -1 if it has not previously been made.
  let timeSinceSameQuery = -1;
  if (pageVisitData.query && pageVisitData.searchEngine in searchEngineQueryTimes) {
    // If the query was made to the search engine before, get the time since it was last made.
    if (pageVisitData.query in searchEngineQueryTimes[pageVisitData.searchEngine]) {
      const timeOfLastQuery = searchEngineQueryTimes[pageVisitData.searchEngine][pageVisitData.query];
      timeSinceSameQuery = pageVisitData.pageVisitStartTime - timeOfLastQuery;
    }

    // Update searchEngineQueryTimes with the time the query was made to the engine and update the corresponding engine's object in storage.
    searchEngineQueryTimes[pageVisitData.searchEngine][pageVisitData.query] = pageVisitData.pageVisitStartTime;
    storage.set(pageVisitData.searchEngine, searchEngineQueryTimes[pageVisitData.searchEngine]);
  }

  const serpVisitData = {
    SearchEngine: pageVisitData.searchEngine,
    AttentionDuration: pageVisitData.attentionDuration,
    DwellTime: pageVisitData.dwellTime,
    PageNum: pageVisitData.pageNum,
    Attribution: attributionDetailsEngineMatches ? attributionDetails.attribution : null,
    AttributionID: attributionDetailsEngineMatches ? attributionDetails.attributionID : null,
    Transition: attributionDetailsEngineMatches ? attributionDetails.transition : null,
    OrganicDetails: pageVisitData.organicDetails,
    OrganicClicks: pageVisitData.organicClicks,
    NumAdResults: pageVisitData.numAdResults,
    NumAdClicks: pageVisitData.numAdClicks,
    NumInternalClicks: pageVisitData.numInternalClicks,
    SearchAreaTopHeight: pageVisitData.searchAreaTopHeight,
    SearchAreaBottomHeight: pageVisitData.searchAreaBottomHeight,
    TimeSinceSameQuery: timeSinceSameQuery === -1 ? -1 : Utils.getCoarsenedTimeStamp(timeSinceSameQuery),
    PageVisitStartTime: Utils.getCoarsenedTimeStamp(pageVisitData.pageVisitStartTime),
    CurrentDefaultEngine: await Privileged.getSearchEngine(),
    NavigationalQuery: getIsNavigationalQuery(pageVisitData.query),
  }

  console.log(serpVisitData);
}

function getIsNavigationalQuery(query: string): string {
  return "";
}

/** 
 * Registers the listener that gets SERP visit data from content scripts
 */
function registerSerpVisitDataListener(): void {
  // Listen for new SERP visit data from content scripts
  webScience.messaging.onMessage.addListener((message) => {
    console.log(message.data)
    reportSerpVisitData(message.data);
  }, {
    type: "SerpVisitData",
    schema: {
      data: "object"
    }
  });
}


/**
 * Initializes object that stores the last time a query was made to each search engine.
 * @async
 */
async function initializeQuerySetsFromStorage(): Promise<void> {
  // Initialize searchEngineQuerySets from the stored unique query sets for each tracked search engines
  const searchEngines = Utils.getAllSearchEngineNames();
  for (const searchEngine of searchEngines) {
    // Each search engine name in storage maps to the list of unique queries made to that engine.
    const queryTimes = await storage.get(searchEngine);
    if (queryTimes) {
      searchEngineQueryTimes[searchEngine] = queryTimes;
    } else {
      searchEngineQueryTimes[searchEngine] = {};
    }
  }
}