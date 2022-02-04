/**
 * This module contains the functionality for initial data collection that should occur upon
 * the first start up of the study extension.
 * 
 * @module InitialCollection
 */

import * as webScience from "@mozilla/web-science";
import * as Privileged from "./Privileged.js"
import * as Utils from "./Utils.js"

/**
 * Run initial data collection.
 * @param {number} enrollmentTime - the time when the participant joined the study.
 * @param {string} conditionType - the selected condition for the participant.
 * @param {Object} storage - A persistent key-value storage object for the study
 * @async
 **/
export async function run(enrollmentTime, conditionType, storage): Promise<void> {

  const initialDataReported = await storage.get("InitialDataReported");
  if (!initialDataReported) {
    const currentTime = webScience.timing.now();

    // Gets a timeStamp from 30 days ago
    // Current timeStamp - (30 days * 24 hours * 60 minutes * 60 seconds * 1000 milliseconds)
    const timeStamp30DaysAgo = currentTime - (30 * 24 * 60 * 60 * 1000);

    const initialData = {
      ConditionType: conditionType,
      SurveyId: await webScience.userSurvey.getSurveyId(),
      DefaultSearchEngine: await Privileged.getSearchEngine(),
      HistoryQueryCount: await getHistoryQueryCount(timeStamp30DaysAgo),
      HistoryAge: await getHistoryAge(currentTime, timeStamp30DaysAgo),
      EnrollmentTime: enrollmentTime,
      PingTime: Utils.getCoarsenedTimeStamp(currentTime),
      TimeOffset: new Date().getTimezoneOffset()
    };

    console.log(initialData);

    storage.set("InitialDataReported", true);
  }
}


/**
 * Collects the query count for each of the tracked search engines since startTime from history.
 * @param {number} startTime - the earliest time from which to get history results.
 * @returns {Array} An array that, for each of the tracked search engines, has the query count for the
 * engine since the start time from history.
 */
async function getHistoryQueryCount(startTime: number): Promise<Array<{ SearchEngine: string, QueryCount: number }>> {
  const searchEngineQuerySets: {
    [searchEngine: string]: Set<string>;
  } = {}

  const engines = Utils.getAllSearchEngineNames();
  for (const engine of engines) {
    const engineMetadata = Utils.searchEnginesMetadata[engine];
    const querySet = new Set<string>();
    for (const domain of engineMetadata.domains) {
      const historyItems = await browser.history.search({ text: domain, startTime: startTime, maxResults: Number.MAX_SAFE_INTEGER });
      for (const historyItem of historyItems) {
        if (engineMetadata.getIsSerpPage(historyItem.url)) {
          const query = Utils.getSerpQuery(historyItem.url, engine);
          if (query) {
            querySet.add(query);
          }
        }
      }
    }
    searchEngineQuerySets[engine] = querySet;
  }

  return searchEngineQuerySetsToQueryCounts(searchEngineQuerySets);
}

/**
 * @param {Object} searchEngineQuerySets - an object that maps each of the tracked search engines
 * to the unique query set for the engine.
 * @returns {Array} An array where each item is the name of one of the tracked search engines
 * and the query count for the engine.
 */
function searchEngineQuerySetsToQueryCounts(searchEngineQuerySets:
  { [searchEngine: string]: Set<string> }): { SearchEngine: string; QueryCount: number; }[] {
  const searchEngineToQueryCount: { SearchEngine: string, QueryCount: number }[] = [];

  for (const [searchEngine, querySet] of Object.entries(searchEngineQuerySets)) {
    searchEngineToQueryCount.push({
      SearchEngine: searchEngine,
      QueryCount: querySet.size
    });
  }
  return searchEngineToQueryCount;
}

/**
 * @param {number} currentTime - The current time.
 * @param {number} timeStamp30DaysAgo - A timestamp, in milliseconds since the epoch.
 * @returns {number} If there are history items before timeStamp, returns the difference between currentTime and timeStamp.
 * If the earliest item in history is after timeStamp, returns the difference between currentTime and the visit time of 
 * the earliest item in history. If there are no history items, returns -1.
 */
async function getHistoryAge(currentTime: number, timeStamp30DaysAgo: number) {
  let earliestHistoryTime = Number.MAX_SAFE_INTEGER;

  // Search for a single result before the timeStamp. If such a result exists, return currentTime - timeStamp30DaysAgo.
  // This should be the the number of milliseconds in 30 days.
  let historyItems = await browser.history.search({ text: "", startTime: 0, endTime: timeStamp30DaysAgo, maxResults: 1 });
  if (historyItems.length) {
    return currentTime - timeStamp30DaysAgo;
  }

  // Iterate through each of this history items (going backwards because
  // history.search returns HistoryItems in reverse chronological order)
  historyItems = await browser.history.search({ text: "", startTime: 0, maxResults: Number.MAX_SAFE_INTEGER });
  for (let i = historyItems.length - 1; i >= 0; i--) {
    const historyItem = historyItems[i];

    // history.getVisits returns VisitItems in reverse chronological order
    const visitItems = await browser.history.getVisits({ url: historyItem.url });
    const earliestVisitItem = visitItems[visitItems.length - 1];
    if (earliestVisitItem.visitTime < earliestHistoryTime) {
      earliestHistoryTime = earliestVisitItem.visitTime;
      if (earliestHistoryTime <= timeStamp30DaysAgo) {
        return currentTime - timeStamp30DaysAgo;
      }
    }
  }

  // If earliestHistoryTime equals Number.MAX_SAFE_INTEGER, that means there were no items in history and we return -1.
  if (earliestHistoryTime === Number.MAX_SAFE_INTEGER) return -1;

  // Returns the difference between the current time and the visit time of the earliest item in history.
  return currentTime - earliestHistoryTime;
}