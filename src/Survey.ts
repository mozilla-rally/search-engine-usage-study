/**
 * This module enables survey functionality for the study. There are two surveys in this study.
 * The initial survey starts upon installation of the study and the followup survey occurs 20 days
 * after the start of the treatment condition.
 * 
 * @module Survey
 */

import * as webScience from "@mozilla/web-science";

const millisecondsPerSecond = 1000;
const secondsPerDay = 86400;
const secondsPerMinute = 60;

/**
 * How often, in days, to wait before reminding the user with a
 * notification to participate in the survey.
 * @type {number}
 * @private
 */
const surveyRemindPeriodDays = 3;

/**
 * How many days to wait after the start of the treatment before
 * starting the followup survey.
 * @type {number}
 * @private
 */
const daysUntilFollowupSurvey = 20;

/**
 * An object describing the survey options for the initial and followup surveys.
 * @type {Object}
 */
const surveyConfigData = {
  Initial: {
    surveyName: "Initial",
    popupNoPromptMessage: "You are currently participating in the Search Engine Usage and Result Quality study. If you would like to hide this icon, right click and select \"Remove from Toolbar\".",
    popupPromptMessage: "You are currently participating in the Search Engine Usage and Result Quality study. Please answer a few survey questions for the study.",
    popupIcon: "icons/PrincetonShieldLarge.png",
    reminderIcon: "",
    reminderInterval: surveyRemindPeriodDays * secondsPerDay,
    reminderMessage: "A survey is available for your Rally study. Click the Search icon in the toolbar to continue.",
    reminderTitle: "Rally survey available",
    surveyCompletionUrl: "https://rally-search-study-survey.princeton.edu/",
    surveyUrl: "https://princetonsurvey.az1.qualtrics.com/jfe/form/SV_ey5oC7XNZ7B3c3A/",
  },
  Followup: {
    surveyName: "Followup",
    popupNoPromptMessage: "You are currently participating in the Search Engine Usage and Result Quality study. If you would like to hide this icon, right click and select \"Remove from Toolbar\".",
    popupPromptMessage: "You are currently participating in the Search Engine Usage and Result Quality study. Please answer a few survey questions for the study.",
    popupIcon: "icons/PrincetonShieldLarge.png",
    reminderIcon: "",
    reminderInterval: surveyRemindPeriodDays * secondsPerDay,
    reminderMessage: "A survey is available for your Rally study. Click the Search icon in the toolbar to continue.",
    reminderTitle: "Rally survey available",
    surveyCompletionUrl: "https://rally-search-study-survey.princeton.edu/",
    surveyUrl: "https://princetonsurvey.az1.qualtrics.com/jfe/form/SV_eJagJBzv5u2quWO/",
  }
};

/**
 * Ends the initial survey and starts the followup survey
 * @async
 **/
async function startFollowupSurvey() {
  await webScience.userSurvey.endSurvey();
  webScience.userSurvey.setSurvey(surveyConfigData.Followup);
}

/**
 * Starts user survey functionality
 * @param {number} treatmentStartTime - The start time of the treatment.
 * @async
 **/
export async function initializeSurvey(treatmentStartTime): Promise<void> {

  const currentTime = webScience.timing.now();

  // Get the start time of the followup survey
  const followupSurveyStartTime = treatmentStartTime + (millisecondsPerSecond * secondsPerDay * daysUntilFollowupSurvey);

  const currentSurvey = await webScience.userSurvey.getSurveyName();
  if (!currentSurvey ||
    (currentSurvey === surveyConfigData.Initial.surveyName && currentTime <= followupSurveyStartTime)) {
    // If there is no current survey or the current survey is the initial survey
    // and the current time is before the time to start the followup survey, we set
    // the current survey to be the initial survey and set a timeout to start the followup survey.
    webScience.userSurvey.setSurvey(surveyConfigData.Initial);


    const followupSurveyAlarmName = "FollowupSurveyAlarmName";
    browser.alarms.create(followupSurveyAlarmName, {
      delayInMinutes: (followupSurveyStartTime - currentTime) / (millisecondsPerSecond * secondsPerMinute)
    });

    browser.alarms.onAlarm.addListener(function (alarm) {
      if (alarm.name == followupSurveyAlarmName) startFollowupSurvey();
    });
  } else if (currentSurvey === surveyConfigData.Initial.surveyName) {
    // If the current survey is the initial survey but the current time is after the start
    // time of the followup survey, we start the followup survey.
    startFollowupSurvey();
  } else {
    // Set the survey to the current survey.
    // We only reach here if the current survey is the followup survey.
    webScience.userSurvey.setSurvey(surveyConfigData[currentSurvey]);
  }
}
