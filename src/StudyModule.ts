/**
 * Starts the Search Engine Usage and Result Quality study.
 * 
 * @module StudyModule
 */

import * as Intervention from "./Intervention.js";
import * as AttributionTracking from "./AttributionTracking.js";
import * as InitialCollection from "./InitialCollection.js";
import * as HistoryRemovalTracking from "./HistoryRemovalTracking.js";
import * as webScience from "@mozilla/web-science";
import * as Utils from "./Utils.js";
import * as Survey from "./Survey.js"
import * as SerpVisitCollection from "./SerpVisitCollection.js"
import * as ModalPopup from "./ModalPopup.js"

/**
 * Start the Search Engine Usage and Result Quality study
 * @param {Object} rally - Rally study object, used for sending data pings.
 * @async
 **/
export async function startStudy(rally): Promise<void> {
  // Printing because this variable is currently unused
  console.log(rally);

  // Whether the study is in the first phase where participants are only offered
  // the initial survey.
  const isPhaseOne = true;

  /**
   * A persistent key-value storage object for the study
   * @type {Object}
   */
  const storage = await webScience.storage.createKeyValueStorage("WebScience.Studies.SearchEngineUsage");

  // Get the start time of the initial survey from storage.
  // If the value does not exist in storage, then this is the start time of the 
  // initial survey and we set the value in storage.
  let initialSurveyStartTime = await storage.get("InitialSurveyStartTime");
  if (!initialSurveyStartTime) {
    initialSurveyStartTime = webScience.timing.now();
    storage.set("InitialSurveyStartTime", initialSurveyStartTime);
  }

  // Get the start time of the treatment to pass to survey module.
  const treatmentStartTime = await storage.get("TreatmentStartTime");
  Survey.initializeSurvey(treatmentStartTime);


  if (!isPhaseOne) {
    SerpVisitCollection.initializeCollection(storage);

    await webScience.pageManager.initialize();
    Utils.initializeMatchPatterns();
    AttributionTracking.initializeAttributionTracking();
    HistoryRemovalTracking.startHistoryRemovalTracking();

    const interventionType = await InitialCollection.run(storage);

    // If intervention is not complete, run intervention.
    // Otherwise, run modal dialog treatment functionality.
    const interventionComplete = await storage.get("InterventionComplete");
    if (!interventionComplete) {
      Intervention.conductIntervention(interventionType, storage);
    }
    else {
      ModalPopup.initializeModalIntervention(interventionType, storage);
    }
  }


}
