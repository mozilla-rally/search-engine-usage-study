/**
 * This file contains functions related to reporting results that need to be accessible to content scripts and thus must be loaded prior
 */

// An array of registered search engines
const registeredSearchEngines: string[] = []

// A callback executed just before reporting
let preReportCallback = null

/**
 * Called by individual search engine modules to register themselves.
 * @param {string} searchEngineName - The search engine of the registering module
 * @param {callback} preReportCallbackIn - A function to call immediately before reporting
 */
function registerModule(searchEngineName: string, preReportCallbackIn: () => void = null) {
  console.log("Registering " + searchEngineName)

  preReportCallback = preReportCallbackIn
  registeredSearchEngines.push(searchEngineName)
}

/**
 * Reports SERP visit data to the background script
 */
function reportResults() {
  if (registeredSearchEngines.length === 0) {
    console.log("No registered search engines")
    return
  } else if (registeredSearchEngines.length > 1) {
    console.log("More than one search engine registered!")
    return
  }

  const searchEngine = registeredSearchEngines[0]

  if (preReportCallback) preReportCallback();

  // If pageIsCorrect is false, we do not report
  if (!pageIsCorrect) {
    console.log(
      "Loaded module " + searchEngine + " is not passing page correctness test"
    )
    return
  }

  const serpVisitData = {
    SearchEngine: searchEngine,
    AttentionTime: getAttentionTime(),
    PageNum: pageNum,
    Attribution: attribution,
    AttributionID: attributionID,
    OrganicDetails: organicDetails,
    OrganicClickDetails: organicClicks,
    NumAdResults: numAdResults,
    NumAdClicks: numAdClicks,
    NumInternalClicks: numInternalClicks,
    SearchAreaTopHeight: searchAreaTopHeight,
    SearchAreaBottomHeight: searchAreaBottomHeight,
    Time: timestamp,
    TimeOffset: new Date().getTimezoneOffset(),
  }

  // Send data to background page
  browser.runtime.sendMessage({
    type: "SerpVisitData",
    data: serpVisitData,
  })
}

