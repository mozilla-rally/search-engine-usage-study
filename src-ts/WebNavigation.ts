import * as webScience from "@mozilla/web-science";

/**
 * An array of the tracked search engine names
 * @type {Array}
 * @private
 */
const searchEngines = ["Google", "DuckDuckGo", "Bing", "Yahoo", "Ecosia", "Yandex", "Ask", "Baidu"]

/**
 * An object that maps each tab to its current page's engine and its current attribution ID
 * @type {Object}
 * @private
 */
const attributionForTab: { [tabIndex: number]: { currentPageEngine: string; attributionID: string } } = {}

/**
 * An object that maps each attribution ID to its search engine, attribution, and
 * whether the search engine sequence began on a SERP
 * @type {Object}
 * @private
 */
const attributionIdDetails: { [attributionId: string]: { engine: string; attribution: string; } } = {}

/**
 * An object that, for each tab, maps the URL of all the visited pages to the
 * attribution ID of the page. This is used for determining attribution ID when the user
 * navigates through history (ie. with the forward/back button)
 * @type {Object}
 * @private
 */
const tabHistoryAttribution: {
  [tabIndex: number]: {
    [url: string]: string
  }
} = {}

export function initialize() {
  registerNewTabNavigationListener();
  registerAttributionTrackingListeners();
  registerGetPageAttributionListener();
}


// When a new window or tab is opened from a navigation, sends a message with the URL of the
// opened page to the tab opening the page (used to determine if links are opened in new tabs
// on SERP content scripts)
function registerNewTabNavigationListener(): void {
  // TODO: Do I need this?
  webScience.messaging.registerSchema("NewTabURL", {
    url: "string"
  });

  browser.webNavigation.onCreatedNavigationTarget.addListener((details) => {
    webScience.messaging.sendMessageToTab(details.sourceTabId, {
      type: "NewTabURL",
      url: details.url
    });
  });
}

/**
 * Registers listeners for webNavigation events that keep track of page attribution details for SERP pages
 */
function registerAttributionTrackingListeners(): void {
  // TODO: should we be copying history attribution information here?
  // Copies the opening tab's attribution information and history attribution information
  // to the new tab
  browser.webNavigation.onCreatedNavigationTarget.addListener((details) => {
    // TODO: make sure these are deep copies
    if (details.sourceTabId in attributionForTab) {
      attributionForTab[details.tabId] = { ...attributionForTab[details.sourceTabId] }
    }
    if (details.sourceTabId in tabHistoryAttribution) {
      tabHistoryAttribution[details.tabId] = { ...tabHistoryAttribution[details.sourceTabId] }
    }
  });

  // When a page uses the History API to update the URL, update the tabs history attribution
  // information with the new URL
  browser.webNavigation.onHistoryStateUpdated.addListener((details => {
    const urlWithFragmentRemoved = details.url.split("#")[0]
    if (!(details.tabId in tabHistoryAttribution)) {
      tabHistoryAttribution[details.tabId] = {}
    }

    if (details.tabId in attributionForTab) {
      tabHistoryAttribution[details.tabId][urlWithFragmentRemoved] = attributionForTab[details.tabId].attributionID
    }
  }))

  // When a navigation is committed, updates attribution information and history attribution
  // information for the tab
  browser.webNavigation.onCommitted.addListener((details) => {
    const engine = getEngineFromURL(details.url);
    const newAttributionID = createAttributionID()

    // If the transition is for a subframe or is a reload, we do not need to update anything
    if (details.transitionType === "auto_subframe" || details.transitionType === "manual_subframe" || details.transitionType === "reload") {
      return
    }

    const urlWithFragmentRemoved = details.url.split("#")[0]

    // If the navigation occurred through the forward/back button, update the attribution information
    // through the history attribution information
    if (details.transitionQualifiers.includes("forward_back")) {
      if (details.tabId in tabHistoryAttribution && urlWithFragmentRemoved in tabHistoryAttribution[details.tabId]) {
        attributionForTab[details.tabId] = { currentPageEngine: engine, attributionID: tabHistoryAttribution[details.tabId][urlWithFragmentRemoved] }
      } else {
        attributionForTab[details.tabId] = { currentPageEngine: engine, attributionID: newAttributionID }
        attributionIdDetails[newAttributionID] = { engine: engine, attribution: "forward_back", }
      }
      return
    }

    let newAttribution: string = null

    // A visit to an engine page is from a new attribution if:
    //  1. The transitionType is any of the values associated with navigation from the address bar
    //  2. The transitionQualifiers array include "from_address_bar"
    //  3. There is not a previous attribution for the tab or the attribution is for a different engine than
    //     the navigation for the current page
    if (engine) {
      if (details.transitionType === "keyword_generated" || details.transitionType === "keyword" || details.transitionType === "start_page" || details.transitionType === "auto_bookmark" || details.transitionType === "generated" || details.transitionType === "typed") {
        newAttribution = details.transitionType
      } else if (details.transitionQualifiers.includes("from_address_bar")) {
        newAttribution = "from_address_bar"
      } else if (!(details.tabId in attributionForTab) || engine !== attributionForTab[details.tabId].currentPageEngine) {
        newAttribution = details.transitionType
      }
    }

    if (!(details.tabId in tabHistoryAttribution)) {
      tabHistoryAttribution[details.tabId] = {}
    }

    // Update the attribution information
    if (newAttribution || !(details.tabId in attributionForTab)) {
      // If there is a new attribution or if there is not previous attribution information for the tab, create a new attribution
      attributionForTab[details.tabId] = { currentPageEngine: engine, attributionID: newAttributionID }
      tabHistoryAttribution[details.tabId][urlWithFragmentRemoved] = newAttributionID
      if (newAttributionID) {
        attributionIdDetails[newAttributionID] = { engine: engine, attribution: newAttribution }
      }
    } else {
      // Otherwise, continue the current attribution
      attributionForTab[details.tabId].currentPageEngine = engine
      tabHistoryAttribution[details.tabId][urlWithFragmentRemoved] = attributionForTab[details.tabId].attributionID
    }
  });
}

/** 
 * Registers a listener for page attribution messages from content scripts that sends a response to the
 * messaging content scripts with the attribution ID, attribution, and if the sequence of searches
 * started on a SERP page (as opposed to a different page on the search engine)
 */
async function registerGetPageAttributionListener(): Promise<void> {
  webScience.messaging.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.tab.id in attributionForTab && attributionForTab[sender.tab.id].currentPageEngine === message.searchEngine) {
      const attributionID = attributionForTab[sender.tab.id].attributionID
      const attribution = attributionIdDetails[attributionID].attribution
      sendResponse({ attributionID: attributionID, attribution: attribution })
    } else {
      sendResponse({ attributionID: null, attribution: null })
    }
  }, {
    type: "GetPageAttribution",
    schema: {
      searchEngine: "string",
    }
  });
}


/**
 * Creates an attribution ID that will be shared by all SERP pages that can be attributed
 * to the same navigation
 * @returns {string} An attribution ID
 */
function createAttributionID() {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz".split("");

  let str = "";
  for (let i = 0; i < 10; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
}


/**
 * Returns the search engine that the URL page is part of
 * @param {string} stringUrl - the URL of the page that is being checked
 * @returns {string} The name of the search engine that the URL belongs to or
 * null if the URL does not belong to any of the tracked engines
 */
function getEngineFromURL(stringUrl: string) {
  let url: URL = null;
  try {
    url = new URL(stringUrl)
  } catch (error) {
    console.error(error)
    return null
  }

  if (url) {
    for (const searchEngine of searchEngines) {
      if (url.hostname.toLowerCase().includes(searchEngine.toLowerCase())) {
        return searchEngine
      }
    }
  }
  return null
}