/**
 * This module enables survey functionality for the study. There are two surveys in this study.
 * The initial survey starts upon installation of the study and the followup survey occurs 20 days
 * after the start of the treatment condition.
 * 
 * @module Survey
 */

import * as webScience from "@mozilla/web-science";

const secondsPerDay = 86400;

/**
 * How often, in days, to wait before reminding the user with a
 * notification to participate in the survey.
 * @type {number}
 * @private
 */
const surveyRemindPeriodDays = 3;


/**
 * An object describing the survey options for the initial and followup surveys.
 * @type {Object}
 */
const surveyConfigData = {
  initial: {
    surveyName: "Initial",
    popupNoPromptMessage: "You are currently participating in the Search Engine Usage and Result Quality study. If you would like to hide this icon, right click and select \"Remove from Toolbar\".",
    popupPromptMessage: "You are currently participating in the Search Engine Usage and Result Quality study. Please answer a few survey questions for the study.",
    popupIcon: "icons/PrincetonShieldLarge.png",
    reminderIcon: "",
    reminderInterval: surveyRemindPeriodDays * secondsPerDay,
    reminderMessage: "A survey is available for your Rally study. Click the Search icon in the toolbar to continue.",
    reminderTitle: "Rally survey available",
    surveyCompletionUrl: "https://rally-search-study-survey.com/",
    surveyUrl: "https://princetonsurvey.az1.qualtrics.com/jfe/form/SV_4UVzt0GInkrNazc/",
  },
  followup: {
    surveyName: "Followup",
    popupNoPromptMessage: "You are currently participating in the Search Engine Usage and Result Quality study. If you would like to hide this icon, right click and select \"Remove from Toolbar\".",
    popupPromptMessage: "You are currently participating in the Search Engine Usage and Result Quality study. Please answer a few survey questions for the study.",
    popupIcon: "icons/PrincetonShieldLarge.png",
    reminderIcon: "",
    reminderInterval: surveyRemindPeriodDays * secondsPerDay,
    reminderMessage: "A survey is available for your Rally study. Click the Search icon in the toolbar to continue.",
    reminderTitle: "Rally survey available",
    surveyCompletionUrl: "https://rally-search-study-survey.com/",
    surveyUrl: "https://princetonsurvey.az1.qualtrics.com/jfe/form/SV_eJagJBzv5u2quWO/",
  }
};

/**
 * Starts user survey functionality
 * @param {Object} treatmentStartTime - The start time of the treatment
 * @async
 **/
export async function initializeSurvey(): Promise<void> {
  webScience.userSurvey.setSurvey(surveyConfigData.initial);
}
