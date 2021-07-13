/**
 * Module for tracking if SERP pages are removed from browser history.
 * @module HistoryRemovalTracking
 */

import * as Utils from "./Utils.js"

function onHistoryVisitRemovedListener(removed) {
  let allHistoryRemoved = false;
  const serpPagesRemoved: string[] = [];
  if (removed.allHistory) {
    allHistoryRemoved = true;
  } else if (removed.urls.length) {
    const engines = Utils.getAllSearchEngineNames();
    for (const url of removed.urls) {
      for (const engine of engines) {
        const engineMetadata = Utils.searchEnginesMetadata[engine];
        if (engineMetadata.getIsSerpPage(url)) {
          serpPagesRemoved.push(engine);
        }
      }
    }
  }

  const HistoryRemovedData = {
    AllHistoryRemoved: allHistoryRemoved,
    SerpPagesRemoved: serpPagesRemoved
  }

  console.log(HistoryRemovedData);
}

/**
 * Adds listener to track if SERP pages are removed from history.
 * @async
 **/
export async function run(): Promise<void> {
  browser.history.onVisitRemoved.addListener(onHistoryVisitRemovedListener);
}
