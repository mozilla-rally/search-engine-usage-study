/**
 * This module measures user interaction on Google Search Engine Result Pages
 *
 * @module WebScience.Measurements.SearchBallot
 */
import * as Intervention from "./Intervention.js"
import * as RegularCollection from "./RegularCollection.js"
import * as WebNavigation from "./WebNavigation.js"
import * as Initial from "./Initial.js"
import * as webScience from "@mozilla/web-science";

/**
 * @type {webScience.storage.KeyValueStorage}
 * A persistent storage space for study data.
 */
let storage = null

let rally;

/**
 * Start a ballot study
 **/
export async function startStudy(rallyArg): Promise<void> {
  rally = rallyArg
  console.debug(rally)

  storage = await webScience.storage.createKeyValueStorage("WebScience.Studies.SearchBallot")
  await webScience.pageManager.initialize()

  WebNavigation.initialize();

  let initialDataReported = await storage.get("InitialDataReported")
  if (!initialDataReported) {
    Initial.reportInitialData(storage);
  }



  let interventionComplete = await storage.get("InterventionComplete")

  // If intervention is complete, start recording SERP data.
  // Otherwise, conduct initial data collection and run intervention.
  if (interventionComplete) {
    RegularCollection.startDataCollection(storage);
  }
  else {
    Intervention.runIntervention(storage);
  }
}

