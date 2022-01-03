/**
 * Starts the Search Engine Usage and Result Quality study.
 * 
 * @module StudyModule
 */

import * as webScience from "@mozilla/web-science";
import * as Survey from "./Survey.js"

/**
 * Start the Search Engine Usage and Result Quality study
 * @param {Object} rally - Rally study object, used for sending data pings.
 * @async
 **/
export async function startStudy(rally): Promise<void> {
  // Printing because this variable is currently unused
  console.log(rally);

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

  Survey.initializeSurvey();
}
