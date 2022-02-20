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
import { navigationalQueryData } from "./OnlineServiceData.js";

import * as serpVisitMetrics from "../src/generated/serpVisit";
import * as searchUsagePings from "../src/generated/pings";

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

let navigationalQueryRegExps: {
  name: string;
  regExp: RegExp;
}[] = null;

/**
 * Start SERP visit collection
 * @param {number} treatmentStartTime - The start time of the treatment.
 * @async
 **/
export async function initializeCollection(conditionType, treatmentStartTime, storageArg): Promise<void> {
  storage = storageArg;

  navigationalQueryRegExps = getNavigationalQueryRegExps();
  await initializeQuerySetsFromStorage();
  registerSerpVisitDataListener();
  await ContentScripts.registerContentScripts(conditionType, treatmentStartTime);
}

/**
 * @returns {Array} An array where each element is an object with the name of a navigational query type
 * and a regular expression of match terms for that navigational query type.
 **/
function getNavigationalQueryRegExps() {
  const navigationalQueryRegExpsArray = []
  for (const navigationalQueryDataElement of navigationalQueryData) {
    const navigationalQueryMatchTerms = navigationalQueryDataElement.matchTerms;

    const regExp = new RegExp(navigationalQueryMatchTerms.map(webScience.matching.escapeRegExpString).join("|"));

    navigationalQueryRegExpsArray.push({
      name: navigationalQueryDataElement.name,
      regExp: regExp,
    })
  }

  return navigationalQueryRegExpsArray;
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
  let timeSinceSameQuery = Number.MAX_SAFE_INTEGER;
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
    QueryVertical: pageVisitData.queryVertical,
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
    SelfPreferencedDetails: pageVisitData.selfPreferencedDetails,
    NumSelfPreferencedClicks: pageVisitData.numSelfPreferencedClicks,
    SearchAreaTopHeight: pageVisitData.searchAreaTopHeight,
    SearchAreaBottomHeight: pageVisitData.searchAreaBottomHeight,
    TimeSinceSameQuery: timeSinceSameQuery,
    PageVisitStartTime: Utils.getCoarsenedTimeStamp(pageVisitData.pageVisitStartTime),
    CurrentDefaultEngine: await Privileged.getSearchEngine(),
    NavigationalQuery: getNavigationalQueryType(pageVisitData.query),
    PageLoaded: pageVisitData.pageLoaded,
    PingTime: webScience.timing.now(),
    SelfPreferencingType: pageVisitData.selfPreferencingType
  }

  serpVisitMetrics.attentionDuration.set(pageVisitData.attentionDuration)
  serpVisitMetrics.attribution.set(attributionDetailsEngineMatches ? attributionDetails.attribution : "")
  serpVisitMetrics.attributionId.set(attributionDetailsEngineMatches ? attributionDetails.attributionID : "")
  serpVisitMetrics.currentDefaultEngine.set(await Privileged.getSearchEngine())
  serpVisitMetrics.dwellTime.set(pageVisitData.dwellTime)
  serpVisitMetrics.modificationType.set(pageVisitData.selfPreferencingType ? pageVisitData.selfPreferencingType : "None")
  serpVisitMetrics.navigationalQuery.set(getNavigationalQueryType(pageVisitData.query))
  serpVisitMetrics.numAdClicks.set(pageVisitData.numAdClicks)
  serpVisitMetrics.numAds.set(pageVisitData.numAdResults)
  serpVisitMetrics.numInternalClicks.set(pageVisitData.numInternalClicks)
  serpVisitMetrics.numSelfPreferencedClicks.set(pageVisitData.numSelfPreferencedClicks)
  serpVisitMetrics.pageLoaded.set(pageVisitData.pageLoaded)
  serpVisitMetrics.pageNumber.set(pageVisitData.pageNum)
  serpVisitMetrics.pageVisitStartTime.set(new Date(pageVisitData.pageVisitStartTime))
  serpVisitMetrics.pingTime.set()
  serpVisitMetrics.queryVertical.set(pageVisitData.queryVertical)
  serpVisitMetrics.searchAreaBottomHeight.set(Math.round(pageVisitData.searchAreaBottomHeight))
  serpVisitMetrics.searchAreaTopHeight.set(Math.round(pageVisitData.searchAreaTopHeight))
  serpVisitMetrics.searchEngine.set(pageVisitData.searchEngine)
  serpVisitMetrics.timeSinceSameQuery.set(timeSinceSameQuery)
  serpVisitMetrics.transition.set(attributionDetailsEngineMatches ? attributionDetails.transition : "")

  for (const organicClick of (pageVisitData.organicClicks as OrganicClick[])) {
    serpVisitMetrics.organicClicks.record({
      result_ranking: organicClick.ranking,
      attention_duration_upon_click: organicClick.attentionDuration,
      page_loaded_upon_selection: organicClick.pageLoaded
    });
  }

  for (const organicResultDetails of (pageVisitData.organicDetails as OrganicDetail[])) {
    serpVisitMetrics.organicDetails.record({
      result_top_height: Math.round(organicResultDetails.topHeight),
      result_bottom_height: Math.round(organicResultDetails.bottomHeight),
      result_page_num: organicResultDetails.pageNum ? organicResultDetails.pageNum : pageVisitData.pageNum,
      result_online_service: organicResultDetails.onlineService,

    });
  }

  for (const selfPreferencedResultDetails of (pageVisitData.selfPreferencedDetails as SelfPreferencedDetail[])) {
    serpVisitMetrics.selfPreferencedDetails.record({
      result_top_height: Math.round(selfPreferencedResultDetails.topHeight),
      result_bottom_height: Math.round(selfPreferencedResultDetails.bottomHeight),
      self_preferenced_result_type: selfPreferencedResultDetails.type,
    });
  }

  console.log(serpVisitData);
  searchUsagePings.serpVisit.submit();
}

/** 
 * If the search query was a navigational query to one of the tracked online services or Google services,
 * then this will be the category of service it was (Airlines, Hotels, Other Travel, Restaurant and Business,
 * Lyrics, Weather, or Google). If not, this will be an empty string.
 */
function getNavigationalQueryType(query: string): string {

  for (const navigationalQueryRegExp of navigationalQueryRegExps) {
    if (navigationalQueryRegExp.regExp.test(query)) {
      return navigationalQueryRegExp.name;
    }
  }

  return ""
}

/** 
 * Registers the listener that gets SERP visit data from content scripts
 */
function registerSerpVisitDataListener(): void {
  // Listen for new SERP visit data from content scripts
  webScience.messaging.onMessage.addListener((message) => {
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