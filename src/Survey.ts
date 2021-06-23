/**
 * This module enables survey functionality for the study. There are two surveys in this study.
 * The initial survey starts immediately after completion of the Intervention module functionality
 * and the second survey starts 20 days after that.
 */

import * as webScience from "@mozilla/web-science";

const millisecondsPerSecond = 1000;
const secondsPerDay = 86400;
const surveyRemindPeriodDays = 3;
const daysUntilFinalSurvey = 20;


// TODO: update this object
/**
 * @type {Object}
 * An object describing the survey options for the initial and final surveys.
 */
const surveyConfigData = {
  initial: {
    surveyName: "initial",
    popupNoPromptMessage: "There are currently no available surveys for the study.",
    popupPromptMessage: "Please complete the following survey for Political & COVID-19 News Information.",
    popupIcon: "icons/PrincetonShieldLarge.png",
    reminderIcon: "icons/PrincetonShieldLarge.png",
    reminderInterval: surveyRemindPeriodDays * secondsPerDay,
    reminderMessage: "reminderMessage 1",
    reminderTitle: "reminderTitle 1",
    surveyCompletionUrl: "https://citpsearch.cs.princeton.edu/searchengine/initial/thankyou",
    surveyUrl: "surveyUrl initial",
  },
  final: {
    surveyName: "final",
    popupNoPromptMessage: "There are currently no available surveys for the study.",
    popupPromptMessage: "Please complete the following survey for Political & COVID-19 News Information.",
    popupIcon: "icons/PrincetonShieldLarge.png",
    reminderIcon: "icons/PrincetonShieldLarge.png",
    reminderInterval: surveyRemindPeriodDays * secondsPerDay,
    reminderMessage: "reminderMessage 2",
    reminderTitle: "reminderTitle 2",
    surveyCompletionUrl: "https://citpsearch.cs.princeton.edu/searchengine/final/thankyou",
    surveyUrl: "surveyUrl final",
  }
};

/**
 * @type {Object}
 * A persistent key-value storage object for the study
 */
let storage;

/**
 * Ends the initial survey and starts the final survey
 * @async
 **/
async function startFinalSurvey() {
  await webScience.userSurvey.endSurvey();
  webScience.userSurvey.setSurvey(surveyConfigData.final);
}

/**
 * Starts user survey functionality
 * @async
 * @param {Object} storage - A persistent key-value storage object for the study
 **/
export async function start(storageIn): Promise<void> {
  storage = storageIn;

  const currentTime = webScience.timing.now();

  // Get the start time of the initial survey from storage.
  // If the value does not exist in storage, then this is the the start time of the 
  // initial survey and we set the value in storage.
  let initialSurveyStartTime = await storage.get("InitialSurveyStartTime");
  if (!initialSurveyStartTime) {
    initialSurveyStartTime = webScience.timing.now();
    storage.set("InitialSurveyStartTime", initialSurveyStartTime);
  }

  // Get the start time of the final survey
  const finalSurveyStartTime = initialSurveyStartTime + (millisecondsPerSecond * secondsPerDay * daysUntilFinalSurvey);

  const currentSurvey = await webScience.userSurvey.getSurveyName();
  if (!currentSurvey ||
    (currentSurvey === surveyConfigData.initial.surveyName && currentTime <= finalSurveyStartTime)) {
    // If there is no current survey or the current survey is the initial survey
    // and the current time is before the time to start the final survey, we set
    // the current survey to be the initial survey and set a timeout to start the final survey.
    webScience.userSurvey.setSurvey(surveyConfigData.initial);
    setTimeout(startFinalSurvey, finalSurveyStartTime - currentTime);
  } else if (currentSurvey === surveyConfigData.initial.surveyName) {
    // If the current survey is the initial survey but the current time is after the start
    // time of the final survey, we start the final survey.
    startFinalSurvey();
  } else {
    // Set the survey to the current survey.
    // We only reach here if the current survey is the final survey.
    webScience.userSurvey.setSurvey(surveyConfigData[currentSurvey]);
  }
}
