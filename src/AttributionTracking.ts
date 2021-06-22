/**
 * This module enables tracking attribution information for search engine page visits.
 */

import * as webScience from "@mozilla/web-science";
import * as Utils from "./Utils.js"

/**
 * @type {Object} An object that maps page IDs to attribution details.
 */
const pageIdToAttributionData: {
  [pageId: string]:
  {
    // How the participant originally navigated to the search engine
    attribution: string;
    // An ID common to all page visits that can be attributed to the same navigation
    attributionID: string;
    // The engine that the page is of
    engine: string;
    // The transition that brought participant to this page
    transition: string;
  }
} = {};

/**
 * @type {Object}
 * An object that, for each tab, maps URLs to IDs of pages visited in the tab.
 * Used to determine the sequence a page visit belongs to if the user navigates with forward/back.
 */
const tabHistoryPageIds: {
  [tabId: number]: {
    [normalizedUrl: string]: string
  }
} = {};

export function getAttributionForPageId(pageId: string) {
  return pageId ? pageIdToAttributionData[pageId] : null;
}

/**
 * Initializes tracking of attribution details for page visits.
 */
export function initializeAttributionTracking(): void {
  const allEngineMatchPatterns = Utils.getTrackedEnginesMatchPatterns()
  webScience.pageTransition.onPageTransitionData.addListener(pageTransitionDataEvent => {
    const pageUrl = pageTransitionDataEvent.url;
    const pageId = pageTransitionDataEvent.pageId;

    // Gets the engine of the page from the url. If the url is not for one of the tracked engines,
    // we do not need to track attribution information for the page.
    const engine = Utils.getEngineFromURL(pageTransitionDataEvent.url);
    if (!engine) {
      return;
    }

    // Create a new attribution ID that can be used if the page is part of a new attribution sequence.
    const newAttributionID = webScience.id.generateId();

    // Get the attribution info for a source page if it exists
    const sourcePageAttributionInfo =
      pageTransitionDataEvent.tabSourcePageId && pageTransitionDataEvent.tabSourcePageId in pageIdToAttributionData ?
        pageIdToAttributionData[pageTransitionDataEvent.tabSourcePageId] :
        null;

    if (pageTransitionDataEvent.transitionQualifiers.includes("forward_back")) {
      // If the forward/back navigation creates a new tab, than we copy the history data from the opening tab.
      if (pageTransitionDataEvent.isOpenedTab) {
        tabHistoryPageIds[pageTransitionDataEvent.tabId] = { ...tabHistoryPageIds[pageTransitionDataEvent.openerTabId] };
      }

      // If the user used the forward or back button to trigger the navigation, then we continue the attribution from the
      // most recent visit to the normalized URL in the tab if possible.
      if (pageUrl && pageTransitionDataEvent.tabId in tabHistoryPageIds &&
        pageUrl in tabHistoryPageIds[pageTransitionDataEvent.tabId] &&
        tabHistoryPageIds[pageTransitionDataEvent.tabId][pageUrl] in pageIdToAttributionData) {

        const historyPageId = tabHistoryPageIds[pageTransitionDataEvent.tabId][pageUrl];
        const historyPageAttributionData = pageIdToAttributionData[historyPageId];
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
      if (sourcePageAttributionInfo && sourcePageAttributionInfo.engine === engine) {
        // If the transition was due to a reload or a url change with the History API, then we continue the attribution
        // of the source page as long as the engine of the source page matches the engine of the current page. If it does not,
        // then the attribution of the page is unknown (this shouldn't happen)
        pageIdToAttributionData[pageId] = {
          attribution: sourcePageAttributionInfo.attribution,
          attributionID: sourcePageAttributionInfo.attributionID,
          engine: engine,
          transition: pageTransitionDataEvent.transitionType === "reload" ? "reload" : "historyChange"
        };
      } else {
        pageIdToAttributionData[pageId] = {
          attribution: "unknown",
          attributionID: newAttributionID,
          engine: engine,
          transition: pageTransitionDataEvent.transitionType === "reload" ? "reload" : "historyChange"
        };
      }
    } else if (pageTransitionDataEvent.transitionType === "form_submit" || (pageTransitionDataEvent.transitionType === "link" && pageTransitionDataEvent.tabSourceClick)) {
      // If the transition was due to a form submit or link click, then we copy the attribution information from the source
      // page as long as the engine of the source page matches the engine of the current page. If it does not, then the
      // attribution is from a link click or form submit from an external site.
      if (sourcePageAttributionInfo && sourcePageAttributionInfo.engine === engine) {
        pageIdToAttributionData[pageId] = {
          attribution: sourcePageAttributionInfo.attribution,
          attributionID: sourcePageAttributionInfo.attributionID,
          engine: engine,
          transition: pageTransitionDataEvent.transitionType
        };
      } else {
        pageIdToAttributionData[pageId] = {
          attribution: pageTransitionDataEvent.transitionType,
          attributionID: newAttributionID,
          engine: engine,
          transition: pageTransitionDataEvent.transitionType
        };
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
      };
    } else if (pageTransitionDataEvent.transitionQualifiers.includes("from_address_bar")) {
      // If the transition is from the address bar, this is a new attribution because the transition was not from
      // a link click or form submit.
      pageIdToAttributionData[pageId] = {
        attribution: "from_address_bar",
        attributionID: newAttributionID,
        engine: engine,
        transition: "from_address_bar"
      };
    } else {
      // If we reach here, then pageTransitionDataEvent.transitionType is "link" but
      // pageTransitionDataEvent.tabSourceClick is false so we assume the transition
      // was not actually due to a link click.
      pageIdToAttributionData[pageId] = {
        attribution: "unknown",
        attributionID: newAttributionID,
        engine: engine,
        transition: "unknown"
      };
    }

    if (!tabHistoryPageIds[pageTransitionDataEvent.tabId]) tabHistoryPageIds[pageTransitionDataEvent.tabId] = {}
    tabHistoryPageIds[pageTransitionDataEvent.tabId][pageUrl] = pageId;
  },
    {
      matchPatterns: allEngineMatchPatterns,
    }
  );
}
