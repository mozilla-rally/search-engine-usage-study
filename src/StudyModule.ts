/**
 * Starts the Search Engine Usage and Result Quality study.
 * 
 * @module StudyModule
 */

import * as Intervention from "./Intervention.js";
import * as AttributionTracking from "./AttributionTracking.js";
import * as InitialCollection from "./InitialCollection.js";
import * as webScience from "@mozilla/web-science";
import * as Utils from "./Utils.js";
import * as Survey from "./Survey.js"
import * as SerpVisitCollection from "./SerpVisitCollection.js"
import * as OnlineServiceVisitCollection from "./OnlineServiceVisitCollection.js"

const millisecondsPerSecond = 1000;
const secondsPerDay = 86400;
const daysUntilTreatment = 10;

/**
 * The set of study conditions and their relative weights.
 * @type {ConditionSet}
 */
const conditionSet = {
  name: "ConditionSelection",
  conditions: [
    { name: "NoTreatment", weight: 10 },
    { name: "NoticeDefault", weight: 20 },
    { name: "NoticeRevert", weight: 20 },
    { name: "ChoiceBallotDefault", weight: 10 },
    { name: "ChoiceBallotHidden", weight: 10 },
    { name: "ChoiceBallotDescriptions", weight: 10 },
    { name: "ChoiceBallotExtended", weight: 20 },
    { name: "ModalPrimaryRevert", weight: 10 },
    { name: "ModalSecondaryRevert", weight: 10 },
    { name: "SelfPreferencedRemoval", weight: 10 },
    { name: "SelfPreferencedReplacement", weight: 10 },
  ]
};

/**
 * Start the Search Engine Usage and Result Quality study
 * @param {Object} rally - Rally study object, used for sending data pings.
 * @async
 **/
export async function startStudy(rally): Promise<void> {
  // Printing because this variable is currently unused
  console.log(rally);

  const currentTime = webScience.timing.now();

  /**
   * A persistent key-value storage object for the study
   * @type {Object}
   */
  const storage = await webScience.storage.createKeyValueStorage("WebScience.Studies.SearchEngineUsage");
  await webScience.pageManager.initialize();
  Utils.initializeMatchPatterns();
  AttributionTracking.initializeAttributionTracking();

  const conditionType = await webScience.randomization.selectCondition(conditionSet);

  SerpVisitCollection.initializeCollection(conditionType, storage);
  OnlineServiceVisitCollection.initializeCollection(storage);

  // Get the start time of the initial survey from storage, which is also the time the study
  // first loaded in participant's browser regardless of if they joined in phase 1 or phase 2.
  // If the value does not exist in storage, then this is the start time of the 
  // initial survey and we set the value in storage.
  let initialSurveyStartTime = await storage.get("InitialSurveyStartTime");
  if (!initialSurveyStartTime) {
    initialSurveyStartTime = currentTime;
    storage.set("InitialSurveyStartTime", initialSurveyStartTime);
  }

  // If there is no treatmentStartTime in storage, this means the treatment has not started yet
  // and we determine when it should start. If this is the case, we do not set the value in storage
  // because this is just the lower bound on when the treatment should start. If the participant's browser
  // is not open when this lower bound time is reached, treatment will only start upon the next load of 
  // the extension. We want to know when treatment started, not just the lower bound, because the
  // start time of the followup survey relies on this.
  let treatmentStartTime: number = await storage.get("TreatmentStartTime");
  if (!treatmentStartTime) {
    treatmentStartTime = initialSurveyStartTime + (millisecondsPerSecond * secondsPerDay * daysUntilTreatment);
  }

  Survey.initializeSurvey(treatmentStartTime);

  // We pass in the initialSurveyStartTime because this is the same as the enrollment time
  // regardless of if participant joined during v1 or v2 of the study
  InitialCollection.run(initialSurveyStartTime, conditionType, storage);

  // If current time is before the treatment start time, set timer to start intervention functionality.
  // Otherwise, start intervention functionality now.
  if (currentTime < treatmentStartTime) {
    setTimeout(() => {
      Intervention.conductIntervention(conditionType, storage);
    }, treatmentStartTime - currentTime);
  } else {
    Intervention.conductIntervention(conditionType, storage);
  }
}
