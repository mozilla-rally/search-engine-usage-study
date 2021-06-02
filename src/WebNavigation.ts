import * as webScience from "@mozilla/web-science";

// page ID to {attribution, attributionID, and engine}
let pageIdToAttributionData: {
  [pageId: string]:
  {
    attribution: string;
    attributionID: string;
    engine: string;
    transition: string;
  }
} = {}

/**
 * An object that, for each tab, maps URLs to IDs of pages visited in the tab.
 * Used to determine the sequence a page visit belongs to if the user navigates with forward/back.
 * @type {Object}
 * @private
 */
let tabHistoryPageIds: {
  [tabId: number]: {
    [normalizedUrl: string]: string
  }
} = {}

let searchEngineDomains = {
  Google: ["google.com"],
  DuckDuckGo: ["duckduckgo.com"],
  Bing: ["bing.com"],
  Yahoo: ["yahoo.com"],
  Ecosia: ["ecosia.org"],
  Ask: ["ask.com"],
  Baidu: ["baidu.com"],
  Yandex: ["yandex.com", "yandex.ru"],
}

let searchEngineToMatchPatternSet = {}

/**
 * Registers listeners for webNavigation events that keep track of page attribution details for SERP pages
 */
export function registerWebNavigationTracking(): void {
  let allEngineMatchPatterns = []
  for (let searchEngine in searchEngineDomains) {
    const matchPatternsForSearchEngine = webScience.matching.domainsToMatchPatterns(searchEngineDomains[searchEngine])
    searchEngineToMatchPatternSet[searchEngine] = webScience.matching.createMatchPatternSet(matchPatternsForSearchEngine)
    allEngineMatchPatterns = allEngineMatchPatterns.concat(matchPatternsForSearchEngine)
  }

  webScience.pageTransition.onPageTransitionData.addListener(pageTransitionDataEvent => {
    const engine = getEngineFromURL(pageTransitionDataEvent.url);
    const newAttributionID = webScience.id.generateId();
    if (!engine) {
      return;
    }

    let pageId = pageTransitionDataEvent.pageId;
    let normalizedUrl;
    try {
      normalizedUrl = webScience.matching.normalizeUrl(pageTransitionDataEvent.url);
    } catch (error) {
      normalizedUrl = null;
      console.error(error);
    }

    const sourcePageAttributionInfo =
      pageTransitionDataEvent.tabSourcePageId && pageTransitionDataEvent.tabSourcePageId in pageIdToAttributionData ?
        pageIdToAttributionData[pageTransitionDataEvent.tabSourcePageId] :
        null;

    if (pageTransitionDataEvent.transitionQualifiers.includes("forward_back")) {

      if (pageTransitionDataEvent.isOpenedTab) {
        // make deep copy
        tabHistoryPageIds[pageTransitionDataEvent.tabId] = { ...tabHistoryPageIds[pageTransitionDataEvent.openerTabId] }
      }

      // If the user used the forward or back button to trigger the navigation, then we continue the attribution from the
      // most recent visit to the normalized URL in the tab if possible.
      if (normalizedUrl && pageTransitionDataEvent.tabId in tabHistoryPageIds &&
        normalizedUrl in tabHistoryPageIds[pageTransitionDataEvent.tabId] &&
        tabHistoryPageIds[pageTransitionDataEvent.tabId][normalizedUrl] in pageIdToAttributionData) {

        let historyPageId = tabHistoryPageIds[pageTransitionDataEvent.tabId][normalizedUrl]
        const historyPageAttributionData = pageIdToAttributionData[historyPageId]
        pageIdToAttributionData[pageId] = {
          attribution: historyPageAttributionData.attribution,
          attributionID: historyPageAttributionData.attributionID,
          engine: historyPageAttributionData.engine,
          transition: "forward_back"
        };
      } else {
        pageIdToAttributionData[pageId] = {
          attribution: "forward_back",
          attributionID: newAttributionID,
          engine: engine,
          transition: "forward_back"
        };
      }
    } else if (pageTransitionDataEvent.transitionType === "reload" || pageTransitionDataEvent.isHistoryChange) {
      // If the transition was due to a form submit or link click, then we copy the attribution information from the source
      // page as long as the engine of the source page matches the engine of the current page. If it does not, then
      // we cannot determine the attribution.
      if (sourcePageAttributionInfo && sourcePageAttributionInfo.engine === engine) {
        pageIdToAttributionData[pageId] = {
          attribution: sourcePageAttributionInfo.attribution,
          attributionID: sourcePageAttributionInfo.attributionID,
          engine: engine,
          transition: pageTransitionDataEvent.transitionType === "reload" ? "reload" : "historyChange"
        }
      } else {
        pageIdToAttributionData[pageId] = {
          attribution: "unknown",
          attributionID: newAttributionID,
          engine: engine,
          transition: pageTransitionDataEvent.transitionType === "reload" ? "reload" : "historyChange"
        }
      }
    } else if (pageTransitionDataEvent.transitionType === "form_submit" || (pageTransitionDataEvent.transitionType === "link" && pageTransitionDataEvent.tabSourceClick)) {
      // If the transition was due to a form submit or link click, then we copy the attribution information from the source
      // page as long as the engine of the source page matches the engine of the current page. If it does not, then the
      // attribution is from link click or form submit from an external site.
      if (sourcePageAttributionInfo && sourcePageAttributionInfo.engine === engine) {
        pageIdToAttributionData[pageId] = {
          attribution: sourcePageAttributionInfo.attribution,
          attributionID: sourcePageAttributionInfo.attributionID,
          engine: engine,
          transition: pageTransitionDataEvent.transitionType
        }
      } else {
        pageIdToAttributionData[pageId] = {
          attribution: pageTransitionDataEvent.transitionType,
          attributionID: newAttributionID,
          engine: engine,
          transition: pageTransitionDataEvent.transitionType
        }
      }
    } else if (pageTransitionDataEvent.transitionType !== "link") {
      // If pageTransitionDataEvent.transitionType is not "link" (the fallback value for transitionType), 
      // we can rely on the pageTransitionDataEvent.transitionType value and know that this is a new
      // attribution because the transition was not due to a link click or form submit.
      pageIdToAttributionData[pageId] = {
        attribution: pageTransitionDataEvent.transitionType,
        attributionID: newAttributionID,
        engine: engine,
        transition: pageTransitionDataEvent.transitionType
      }
    } else if (pageTransitionDataEvent.transitionQualifiers.includes("from_address_bar")) {
      // If "from_address_bar" is in transitionQualifiers, this is a new attribution because we
      // know the transition was not due to a link click or form submit.
      pageIdToAttributionData[pageId] = {
        attribution: "from_address_bar",
        attributionID: newAttributionID,
        engine: engine,
        transition: "from_address_bar"
      }
    } else {
      // If we reach here, then pageTransitionDataEvent.transitionType is "link" but
      // pageTransitionDataEvent.tabSourceClick is false so we assume the transition
      // was not actually due to a link click.
      pageIdToAttributionData[pageId] = {
        attribution: "unknown",
        attributionID: newAttributionID,
        engine: engine,
        transition: "unknown"
      }
    }

    if (normalizedUrl) {
      if (!tabHistoryPageIds[pageTransitionDataEvent.tabId]) tabHistoryPageIds[pageTransitionDataEvent.tabId] = {}
      tabHistoryPageIds[pageTransitionDataEvent.tabId][normalizedUrl] = pageId;
    }
  },
    {
      matchPatterns: allEngineMatchPatterns,
    }
  );
}

/**
 * Returns the search engine that the URL matches
 * @param {string} url - the URL of the page that is being checked
 * @returns {string|null} The name of the search engine that the URL belongs to or
 * null if the URL does not belong to any of the tracked engines
 */
function getEngineFromURL(url: string): string {
  for (let searchEngine in searchEngineToMatchPatternSet) {
    const matchPatternSet = searchEngineToMatchPatternSet[searchEngine]
    if (matchPatternSet.matches(url)) {
      return searchEngine;
    }
  }
  return null;
}