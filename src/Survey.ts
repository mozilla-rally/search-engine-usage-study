/**
 * This module enables survey functionality for the study. There are two surveys in this study.
 * The initial survey starts immediately after completion of the Intervention module functionality
 * and the second survey starts 20 days after that.
 * 
 * @module Survey
 */

import * as webScience from "@mozilla/web-science";

const millisecondsPerSecond = 1000;
const secondsPerDay = 86400;
const surveyRemindPeriodDays = 3;
const daysUntilFinalSurvey = 20;

/**
 * An object describing the survey options for the initial and final surveys.
 * @type {Object}
 */
const surveyConfigData = {
  initial: {
    surveyName: "Initial",
    popupNoPromptMessage: "You are currently participating in the Search Engine Usage Study. If you would like to hide this icon, right click and select \"Remove from Toolbar\".",
    popupPromptMessage: "You are currently participating in the Search Engine Usage Study. Please answer a few survey questions for the study.",
    popupIcon: "icons/PrincetonShieldLarge.png",
    reminderIcon: "",
    reminderInterval: surveyRemindPeriodDays * secondsPerDay,
    reminderMessage: "A survey is available for your Rally study. Click the Search icon in the toolbar to continue.",
    reminderTitle: "Rally survey available",
    surveyCompletionUrl: "http://initial-survey-thank-you.s3-website-us-east-1.amazonaws.com",
    surveyUrl: "https://princetonsurvey.az1.qualtrics.com/jfe/form/SV_daN8Y3MgSvl33BI/",
  },
  final: {
    surveyName: "Final",
    popupNoPromptMessage: "You are currently participating in the Search Engine Usage Study. If you would like to hide this icon, right click and select \"Remove from Toolbar\".",
    popupPromptMessage: "You are currently participating in the Search Engine Usage Study. Please answer a few survey questions for the study.",
    popupIcon: "icons/PrincetonShieldLarge.png",
    reminderIcon: "",
    reminderInterval: surveyRemindPeriodDays * secondsPerDay,
    reminderMessage: "A survey is available for your Rally study. Click the Search icon in the toolbar to continue.",
    reminderTitle: "Rally survey available",
    surveyCompletionUrl: "http://final-survey-thank-you.s3-website-us-east-1.amazonaws.com",
    surveyUrl: "https://princetonsurvey.az1.qualtrics.com/jfe/form/SV_eJagJBzv5u2quWO/",
  }
};

/**
 * A persistent key-value storage object for the study
 * @type {Object}
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
 * @param {Object} storage - A persistent key-value storage object for the study
 * @async
 **/
export async function initializeSurvey(storageArg): Promise<void> {
  storage = storageArg;

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
