/**
 * This module measures user interaction on Google Search Engine Result Pages
 *
 * @module WebScience.Measurements.SearchEngineUsage
 */
import * as Intervention from "./Intervention.js"
import * as PostIntervention from "./PostIntervention.js"
import * as WebNavigation from "./WebNavigation.js"
import * as Initial from "./Initial.js"
import * as webScience from "@mozilla/web-science";
import * as SearchEngineUtils from "./SearchEngineUtils.js"

/**
 * @type {webScience.storage.KeyValueStorage}
 * A persistent storage space for study data.
 */
let storage = null

let rally;

/**
 * Start a search engine usage study
 **/
export async function startStudy(rallyArg): Promise<void> {
  rally = rallyArg;
  console.debug(rally);

  storage = await webScience.storage.createKeyValueStorage("WebScience.Studies.SearchEngineUsage");
  await webScience.pageManager.initialize();
  SearchEngineUtils.initialize();
  WebNavigation.registerWebNavigationTracking();

  // Report initial data if we have not done so already
  const initialDataReported = await storage.get("InitialDataReported");
  if (!initialDataReported) {
    Initial.reportInitialData(storage);
  }

  // If intervention is complete, start recording SERP data.
  // Otherwise, run intervention.
  if (await storage.get("InterventionComplete")) {
    PostIntervention.run(storage);
  }
  else {
    Intervention.runIntervention(storage);
  }
}
