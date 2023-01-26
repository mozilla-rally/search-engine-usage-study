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
 * @param {string} conditionType - The participant's study condition.
 * @param {number} treatmentStartTime - The start time of the treatment.
 * @param {Object} storageArg - A persistent key-value storage object for the study
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
    // Regular expression to make sure there are no word characters before or after the
    // matching query. This prevents a SERP query of "shallowest" from matching with 
    // "lowes" and other similar false matches.
    const regExp = new RegExp(`(?<!\\w)(${navigationalQueryMatchTerms.map(webScience.matching.escapeRegExpString).join("|")})(?!\\w)`);

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

  const normalizedQuery = Utils.normalizeQuery(pageVisitData.query);


  // The last time the query was made to the search engine, Number.MAX_SAFE_INTEGER if it has not previously been made.
  let timeSinceSameQuery = Number.MAX_SAFE_INTEGER;
  if (normalizedQuery && pageVisitData.searchEngine in searchEngineQueryTimes) {
    // If the query was made to the search engine before, get the time since it was last made.
    if (normalizedQuery in searchEngineQueryTimes[pageVisitData.searchEngine]) {
      const timeOfLastQuery = searchEngineQueryTimes[pageVisitData.searchEngine][normalizedQuery];
      timeSinceSameQuery = pageVisitData.pageVisitStartTime - timeOfLastQuery;
    }

    // Update searchEngineQueryTimes with the time the query was made to the engine and update the corresponding engine's object in storage.
    searchEngineQueryTimes[pageVisitData.searchEngine][normalizedQuery] = pageVisitData.pageVisitStartTime;
    storage.set(pageVisitData.searchEngine, searchEngineQueryTimes[pageVisitData.searchEngine]);
  }


  let numGoogleResults: number = null
  try {
    if (pageVisitData.searchEngine == "Google") {
      numGoogleResults = pageVisitData.numResults;
    } else if (pageVisitData.query) {
      const response = await fetch(`https://www.google.com/search?q=${pageVisitData.query}`, { cache: "no-store" });
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      numGoogleResults = Utils.getNumResultsGoogle(doc);
    }
  } catch (error) {
    // Do nothing
  }

  serpVisitMetrics.attentionDuration.set(Utils.getPositiveInteger(pageVisitData.attentionDuration));
  serpVisitMetrics.attribution.set(attributionDetailsEngineMatches ? attributionDetails.attribution : "");
  serpVisitMetrics.attributionId.set(attributionDetailsEngineMatches ? attributionDetails.attributionID : "");
  serpVisitMetrics.currentDefaultEngine.set(await Privileged.getSearchEngine());
  serpVisitMetrics.dwellTime.set(Utils.getPositiveInteger(pageVisitData.dwellTime));
  serpVisitMetrics.googleResultsNum.set(Utils.getPositiveInteger(numGoogleResults));
  serpVisitMetrics.modificationType.set(pageVisitData.selfPreferencingType ? pageVisitData.selfPreferencingType : "None");
  serpVisitMetrics.navigationalQuery.set(getNavigationalQueryType(normalizedQuery))
  serpVisitMetrics.numAdClicks.set(Utils.getPositiveInteger(pageVisitData.numAdClicks));
  serpVisitMetrics.numAds.set(Utils.getPositiveInteger(pageVisitData.numAdResults));
  serpVisitMetrics.numInternalClicks.set(Utils.getPositiveInteger(pageVisitData.numInternalClicks));
  serpVisitMetrics.numSelfPreferencedClicks.set(Utils.getPositiveInteger(pageVisitData.numSelfPreferencedClicks));
  serpVisitMetrics.pageLoaded.set(pageVisitData.pageLoaded);
  serpVisitMetrics.pageNumber.set(Utils.getPositiveInteger(pageVisitData.pageNum));
  serpVisitMetrics.pageVisitStartTime.set(new Date(pageVisitData.pageVisitStartTime));
  serpVisitMetrics.pingTime.set();
  serpVisitMetrics.queryHash.set(await Utils.getQueryHash(normalizedQuery, storage));
  serpVisitMetrics.queryVertical.set(pageVisitData.queryVertical ? pageVisitData.queryVertical : "");
  serpVisitMetrics.resultsNum.set(Utils.getPositiveInteger(pageVisitData.numResults));
  serpVisitMetrics.searchAreaBottomHeight.set(Utils.getPositiveInteger(pageVisitData.searchAreaBottomHeight));
  serpVisitMetrics.searchAreaTopHeight.set(Utils.getPositiveInteger(pageVisitData.searchAreaTopHeight));
  serpVisitMetrics.searchEngine.set(pageVisitData.searchEngine ? pageVisitData.searchEngine : "");
  serpVisitMetrics.timeSinceSameQuery.set(timeSinceSameQuery);
  serpVisitMetrics.transition.set(attributionDetailsEngineMatches ? attributionDetails.transition : "");

  for (const organicClick of (pageVisitData.organicClicks as OrganicClick[])) {
    serpVisitMetrics.organicClicks.record({
      result_ranking: Utils.getPositiveInteger(organicClick.ranking),
      attention_duration_upon_click: Utils.getPositiveInteger(organicClick.attentionDuration),
      page_loaded_upon_selection: organicClick.pageLoaded
    });
  }

  for (const organicResultDetails of (pageVisitData.organicDetails as OrganicDetail[])) {
    serpVisitMetrics.organicDetails.record({
      result_top_height: Utils.getPositiveInteger(organicResultDetails.topHeight),
      result_bottom_height: Utils.getPositiveInteger(organicResultDetails.bottomHeight),
      result_page_num: Utils.getPositiveInteger(organicResultDetails.pageNum),
      result_online_service: organicResultDetails.onlineService ? organicResultDetails.onlineService : "",

    });
  }

  for (const selfPreferencedResultDetails of (pageVisitData.selfPreferencedDetails as SelfPreferencedDetail[])) {
    serpVisitMetrics.selfPreferencedDetails.record({
      result_top_height: Utils.getPositiveInteger(selfPreferencedResultDetails.topHeight),
      result_bottom_height: Utils.getPositiveInteger(selfPreferencedResultDetails.bottomHeight),
      self_preferenced_result_type: selfPreferencedResultDetails.type ? selfPreferencedResultDetails.type : "",
    });
  }

  searchUsagePings.serpVisit.submit();

  if (__ENABLE_DEVELOPER_MODE__) {
    const serpVisitData = {
      SearchEngine: pageVisitData.searchEngine,
      QueryHash: await Utils.getQueryHash(normalizedQuery, storage),
      NumResults: pageVisitData.numResults,
      QueryVertical: pageVisitData.queryVertical,
      AttentionDuration: pageVisitData.attentionDuration,
      DwellTime: pageVisitData.dwellTime,
      PageNum: pageVisitData.pageNum,
      Attribution: attributionDetailsEngineMatches ? attributionDetails.attribution : null,
      AttributionID: attributionDetailsEngineMatches ? attributionDetails.attributionID : null,
      GoogleResultsNum: Utils.getPositiveInteger(numGoogleResults),
      Transition: attributionDetailsEngineMatches ? attributionDetails.transition : null,
      OrganicDetails: pageVisitData.organicDetails,
      OrganicClicks: pageVisitData.organicClicks,
      NumAds: pageVisitData.numAdResults,
      NumAdClicks: pageVisitData.numAdClicks,
      NumInternalClicks: pageVisitData.numInternalClicks,
      SelfPreferencedDetails: pageVisitData.selfPreferencedDetails,
      NumSelfPreferencedClicks: pageVisitData.numSelfPreferencedClicks,
      SearchAreaTopHeight: pageVisitData.searchAreaTopHeight,
      SearchAreaBottomHeight: pageVisitData.searchAreaBottomHeight,
      TimeSinceSameQuery: timeSinceSameQuery,
      PageVisitStartTime: pageVisitData.pageVisitStartTime,
      CurrentDefaultEngine: await Privileged.getSearchEngine(),
      NavigationalQuery: getNavigationalQueryType(normalizedQuery),
      PageLoaded: pageVisitData.pageLoaded,
      PingTime: webScience.timing.now(),
      ModificationType: pageVisitData.selfPreferencingType ? pageVisitData.selfPreferencingType : "None"
    }

    console.log(serpVisitData);
  }
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