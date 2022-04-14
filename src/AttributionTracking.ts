/**
 * This module enables tracking attribution information for search engine page visits.
 * 
 * @module AttributionTracking
 */

import * as webScience from "@mozilla/web-science";
import * as Utils from "./Utils.js"

/**
 * The minimum time, in milliseconds, to wait after a tab is removed before removing the history information
 * for that tab.
 * @constant {number}
 */
const tabRemovedExpiry = 10000;

/**
 * The minimum time, in milliseconds, to wait after a pageManager.onPageVisitStop event to remove the attribution information
 * for that page.
 * @constant {number}
 */
const pageVisitStopExpiry = 10000;

interface AttributionDetails {
  // The navigation that the visit to the search engine site can be attributed to (ie. through a generated result
  // in the address bar, a link on an external site). Page visits occurring from a link or action on a different
  // page of the search engine can be attributed to the navigation of the source page. Possible values are the
  // webNavigation.TransitionType values, "forward_back", "history_change", "from_address_bar", or "unknown".
  attribution: string;
  // An ID common to all page visits that can be attributed to the same navigation.
  attributionID: string;
  // The search engine that the page belongs to.
  engine: string;
  // The transition that brought participant to this page. Possible values are the
  // webNavigation.TransitionType values, "forward_back", "history_change", "from_address_bar", or "unknown".
  transition: string;
}

/**
 An object that maps page IDs to attribution details.
 * @type {Object}
 */
const pageIdToAttributionData: { [pageId: string]: AttributionDetails } = {};

/**
 * An object that, for each tab, maps URLs to attribution details of pages visited in the tab.
 * Used to determine the sequence a page visit belongs to if the participant navigates with forward/back.
 * @type {Object}
 */
const tabHistoryPageIds: {
  [tabId: number]: {
    [url: string]: AttributionDetails
  }
} = {};

/**
 * @param {string} pageId - The webScience.pageManager page ID of a page.
 * @returns {AttributionDetails|null} Attribution information for a page based on its page ID.
 * Returns null if attribution information for the given page ID cannot be found.
 */
export function getAttributionForPageId(pageId: string): AttributionDetails {
  return pageId in pageIdToAttributionData ? pageIdToAttributionData[pageId] : null;
}

/**
 * Initializes tracking of attribution details for page visits.
 */
export function initializeAttributionTracking(): void {
  // When tabs.onRemoved fires, set a timeout to remove the tab-based history information
  // for that tab.
  browser.tabs.onRemoved.addListener(tabId => {
    setTimeout(() => {
      delete tabHistoryPageIds[tabId];
    }, tabRemovedExpiry);
  });

  // When pageManager.onPageVisitStop fires, set a timeout to remove the attribution information
  // for that page.
  webScience.pageManager.onPageVisitStop.addListener(pageVisitStopDetails => {
    setTimeout(() => {
      delete pageIdToAttributionData[pageVisitStopDetails.pageId];
    }, pageVisitStopExpiry);
  });

  // Gets the match patterns for pages where the onPageTransitionData listener should be notified
  // of page transition data.
  const allEngineMatchPatterns = Utils.getTrackedEnginesMatchPatterns();

  webScience.pageTransition.onPageTransitionData.addListener(pageTransitionDataEvent => {
    const pageUrl: string = pageTransitionDataEvent.url;
    const pageId: string = pageTransitionDataEvent.pageId;

    // Gets the engine of the page from the url. If the url is not for one of the tracked engines,
    // we do not need to track attribution information for the page.
    const engine = Utils.getEngineFromURL(pageTransitionDataEvent.url);
    if (!engine) {
      return;
    }

    // Get the attribution info for a source page if it exists. If the page is loading in a new tab with an opener tab, this
    // is the attribution info for the source page in the opener tab.
    const sourcePageAttributionInfo =
      pageTransitionDataEvent.tabSourcePageId && pageTransitionDataEvent.tabSourcePageId in pageIdToAttributionData ?
        pageIdToAttributionData[pageTransitionDataEvent.tabSourcePageId] :
        null;

    if (pageTransitionDataEvent.transitionQualifiers.includes("forward_back") || pageTransitionDataEvent.transitionType === "reload") {
      // If the forward/back or reload navigation creates a new tab, then we copy the history data from the opening tab.
      // Opening a link in a new tab does not coy the history for the source tab, but opening a history item in a new tab
      // (ie. Ctrl+clicking on the forward/back button or a history item from right clicking on the forward/back button) 
      // or reloading in a new tab (ie. Ctrl+clicking on reload button) does copy the history of the opener tab to the new tab.
      if (pageTransitionDataEvent.isOpenedTab) {
        // Make a deep copy
        tabHistoryPageIds[pageTransitionDataEvent.tabId] = JSON.parse(JSON.stringify(tabHistoryPageIds[pageTransitionDataEvent.openerTabId]));
      }

      // If the participant used the forward or back button to trigger the navigation, then we continue the attribution 
      // from the most recent visit to the URL in the tab if possible. We are assuming that if a user navigates with forward/back
      // then they are navigating back to the most recent page with the same URL because we cannot determine which way in history
      // they are going or if they are skipping through history.
      if (pageTransitionDataEvent.tabId in tabHistoryPageIds &&
        pageUrl in tabHistoryPageIds[pageTransitionDataEvent.tabId]) {
        const historyPageAttributionData = tabHistoryPageIds[pageTransitionDataEvent.tabId][pageUrl];
        pageIdToAttributionData[pageId] = {
          attribution: historyPageAttributionData.attribution,
          attributionID: historyPageAttributionData.attributionID,
          engine: historyPageAttributionData.engine,
          transition: "forward_back"
        };
      } else {
        pageIdToAttributionData[pageId] = {
          attribution: "forward_back",
          attributionID: webScience.id.generateId(),
          engine: engine,
          transition: "forward_back"
        };
      }
    } else if (pageTransitionDataEvent.transitionType === "reload" || pageTransitionDataEvent.isHistoryChange
      || pageTransitionDataEvent.transitionQualifiers.includes("client_redirect") || pageTransitionDataEvent.transitionQualifiers.includes("server_redirect")) {

      let transition = null;
      if (pageTransitionDataEvent.transitionType === "reload") {
        transition = "reload";
      } else if (pageTransitionDataEvent.isHistoryChange) {
        transition = "history_change";
      } else if (pageTransitionDataEvent.transitionQualifiers.includes("client_redirect")) {
        transition = "client_redirect";
      } else {
        transition = "server_redirect";
      }

      if (sourcePageAttributionInfo && sourcePageAttributionInfo.engine === engine) {
        // If the transition was due to a reload, a url change with the History API, or a redirect 
        // and the source page engine is the same as the new page engine, then we continue the 
        // attribution of the source page.
        pageIdToAttributionData[pageId] = {
          attribution: sourcePageAttributionInfo.attribution,
          attributionID: sourcePageAttributionInfo.attributionID,
          engine: engine,
          transition: transition
        };
      } else {
        pageIdToAttributionData[pageId] = {
          attribution: "unknown",
          attributionID: webScience.id.generateId(),
          engine: engine,
          transition: transition
        };
      }
    } else if (pageTransitionDataEvent.transitionType !== "link" && pageTransitionDataEvent.transitionType !== "form_submit") {
      // We know that this is a new attribution because the transition was not due to an action on the source page
      // (a link click or a form submit).
      pageIdToAttributionData[pageId] = {
        attribution: pageTransitionDataEvent.transitionType,
        attributionID: webScience.id.generateId(),
        engine: engine,
        transition: pageTransitionDataEvent.transitionType
      };
    } else if (pageTransitionDataEvent.transitionQualifiers.includes("from_address_bar")) {
      // If the transition is from the address bar, this is a new attribution because the transition was not
      // from a link click or form submit. This condition is below the previous one because transitionType
      // values (ie. generated, typed, etc) are more specific than "from_address"bar and so I would prefer to
      // use those values. Because of bugs, however, the transitionType can be "link" even if the navigation is
      // from the address bar so we check if "from_address_bar" is in transitionQualifiers.
      pageIdToAttributionData[pageId] = {
        attribution: "from_address_bar",
        attributionID: webScience.id.generateId(),
        engine: engine,
        transition: "from_address_bar"
      };
    } else if (pageTransitionDataEvent.transitionType === "form_submit" || (pageTransitionDataEvent.transitionType === "link" && pageTransitionDataEvent.tabSourceClick)) {
      // If the transition was due to a form submit or link click and the source page engine is the same as the new page
      // engine, then we copy the attribution information from the source page. If the source page engine is not the 
      // same as the new page engine, the attribution is from a link click or form submit on an external site.
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
          attributionID: webScience.id.generateId(),
          engine: engine,
          transition: pageTransitionDataEvent.transitionType
        };
      }
    } else {
      // If we reach here, then pageTransitionDataEvent.transitionType is "link" (the fallback value for transitionType)
      // but pageTransitionDataEvent.tabSourceClick is false so we assume the transition was not actually due to a link click.
      pageIdToAttributionData[pageId] = {
        attribution: "unknown",
        attributionID: webScience.id.generateId(),
        engine: engine,
        transition: "unknown"
      };
    }

    // Store the page ID as the most recent page visit to this page URL on the respective tab.
    if (!tabHistoryPageIds[pageTransitionDataEvent.tabId]) tabHistoryPageIds[pageTransitionDataEvent.tabId] = {}
    tabHistoryPageIds[pageTransitionDataEvent.tabId][pageUrl] = pageIdToAttributionData[pageId];
  },
    {
      matchPatterns: allEngineMatchPatterns,
    }
  );
}
