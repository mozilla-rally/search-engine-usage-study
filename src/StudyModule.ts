/**
 * Starts the study
 */

import * as Intervention from "./Intervention.js";
import * as PostIntervention from "./PostIntervention.js";
import * as WebNavigation from "./AttributionTracking.js";
import * as InitialCollection from "./InitialCollection.js";
import * as webScience from "@mozilla/web-science";
import * as Utils from "./Utils.js";

/**
 * @type {Object}
 * A persistent key-value storage object for the study
 */
let storage;

/**
 * @type {Object}
 * Rally study object, used for sending data pings.
 */
let rally;

/**
 * Start a search engine usage study
 * @async
 * @param {Object} rally - Rally study object, used for sending data pings.
 **/
export async function startStudy(rallyArg): Promise<void> {
  rally = rallyArg;
  console.log(rally);

  storage = await webScience.storage.createKeyValueStorage("WebScience.Studies.SearchEngineUsage");
  await webScience.pageManager.initialize();
  Utils.initialize();
  WebNavigation.initializeAttributionTracking();

  // Report initial data if we have not done so already
  const initialDataReported = await storage.get("InitialDataReported");
  if (!initialDataReported) {
    InitialCollection.run(storage);
  }

  // If intervention is complete, start post-intervention collection.
  // Otherwise, run intervention.
  if (await storage.get("InterventionComplete")) {
    PostIntervention.start(storage);
  }
  else {
    Intervention.start(storage);
  }
}
