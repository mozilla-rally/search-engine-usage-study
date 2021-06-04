/**
 * This module measures user interaction on Google Search Engine Result Pages
 *
 * @module WebScience.Measurements.SearchBallot
 */
import * as Intervention from "./Intervention.js"
import * as SerpVisitCollection from "./SerpVisitCollection.js"
import * as DailyCollection from "./DailyCollection.js"
import * as WebNavigation from "./WebNavigation.js"
import * as Initial from "./Initial.js"
import * as webScience from "@mozilla/web-science";
import * as Survey from "./Survey.js"
import * as Modal from "./Modal.js"
import * as SearchEngineUtils from "./SearchEngineUtils.js"

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
  await webScience.pageManager.initialize();
  WebNavigation.registerWebNavigationTracking();
  SearchEngineUtils.initialize();

  let initialDataReported = await storage.get("InitialDataReported")

  // Report initial data if we have not done so already
  if (!initialDataReported) {
    Initial.reportInitialData(storage);
  }

  Initial.reportInitialData(storage);

  let interventionComplete = await storage.get("InterventionComplete")

  // If intervention is complete, start recording SERP data.
  // Otherwise, run intervention.
  if (interventionComplete) {
    postInterventionFunctionality();
  }
  else {
    Intervention.runIntervention(storage);
  }
}

export async function postInterventionFunctionality() {
  console.log("Intervention Complete functionality")

  Modal.startModalIntervention(storage);

  Survey.runSurvey(storage);

  SerpVisitCollection.startCollection();
  DailyCollection.startCollection(storage);
}

