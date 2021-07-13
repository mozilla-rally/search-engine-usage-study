/**
 * Starts the search engine usage study.
 * 
 * @module StudyModule
 */

import * as Intervention from "./Intervention.js";
import * as PostIntervention from "./PostIntervention.js";
import * as AttributionTracking from "./AttributionTracking.js";
import * as InitialCollection from "./InitialCollection.js";
import * as HistoryRemovalTracking from "./HistoryRemovalTracking";
import * as SerpVisitCollection from "./SerpVisitCollection.js";
import * as Survey from "./Survey.js";
import * as webScience from "@mozilla/web-science";
import * as Utils from "./Utils.js";
import * as Privileged from "./Privileged.js";

/**
 * A persistent key-value storage object for the study
 * @type {Object}
 */
let storage;

/**
 * Rally study object, used for sending data pings.
 * @type {Object}
 */
let rally;

/**
 * Start a search engine usage study
 * @param {Object} rally - Rally study object, used for sending data pings.
 * @async
 **/
export async function startStudy(rallyArg): Promise<void> {
  rally = rallyArg;
  console.log(rally);

  Privileged.changeSearchEngine("Yandex");
  return;

  storage = await webScience.storage.createKeyValueStorage("WebScience.Studies.SearchEngineUsage");
  await webScience.pageManager.initialize();
  Utils.initializeMatchPatterns();
  AttributionTracking.initializeAttributionTracking();

  HistoryRemovalTracking.run();
  SerpVisitCollection.initializeCollection(storage);
  return;

  Survey.initializeSurvey(storage);

  return;

  const interventionType = await InitialCollection.run(storage);


  // If intervention is not complete, run intervention.
  // Otherwise, run post-intervention functionality.
  const interventionComplete = await storage.get("InterventionComplete");
  if (!interventionComplete) {
    Intervention.conductIntervention(interventionType, storage);
  }
  else {
    PostIntervention.initializeCollection(interventionType, storage);
  }
}
