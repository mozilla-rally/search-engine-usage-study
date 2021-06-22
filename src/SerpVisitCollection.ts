/**
 * This module enables registering SERP content scripts and collecting 
 * data for SERP visits.
 */

import * as webScience from "@mozilla/web-science";
import { serpScripts } from "./content-scripts-import.js"
import * as AttributionTracking from "./AttributionTracking.js"

/**
 * Start SERP visit collection
 * @async
 **/
export async function start(): Promise<void> {
  registerSerpVisitDataListener();
  registerContentScripts();
}

/**
 * Register the SERP content scripts and the messaging to tabs for onCreatedNavigationTarget
 * so that a content script can know if a link was opened in a new tab from its page
 * @async
 */
async function registerContentScripts() {
  webScience.messaging.registerSchema("CreatedNavigationTargetMessage", {
    details: "object"
  });

  browser.webNavigation.onCreatedNavigationTarget.addListener((details) => {
    webScience.messaging.sendMessageToTab(details.sourceTabId, {
      type: "CreatedNavigationTargetMessage",
      details
    });
  });

  for (const serpScript of serpScripts) {
    if (!serpScript.enabled) {
      continue;
    }
    serpScript.args["runAt"] = "document_start";
    await browser.contentScripts.register(serpScript.args);
  }
}

async function reportSerpVisitData(pageVisitData): Promise<void> {
  const attributionDetails = AttributionTracking.getAttributionForPageId(pageVisitData.pageId);
  const attributionDetailsEngineMatches = attributionDetails && attributionDetails.engine === pageVisitData.searchEngine;
  const data = {
    SearchEngine: pageVisitData.searchEngine,
    AttentionDuration: pageVisitData.attentionDuration,
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
    Time: pageVisitData.searchEngine,
    TimeOffset: pageVisitData.searchEngine,
  }
  console.log(data);
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
