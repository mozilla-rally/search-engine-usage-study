import * as webScience from "@mozilla/web-science";

const millisecondsPerSecond = 1000;
const secondsPerDay = 86400;
const surveyRemindPeriodDays = 3;
const daysUntilSecondSurvey = 30;


// TDOD: update these
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
    surveyUrl: "https://kartikeyakandula.com/",
  },
  final: {
    surveyName: "final",
    popupNoPromptMessage: "No survey prompt message 2",
    popupPromptMessage: "popupPromptMessage 2",
    popupIcon: "icons/PrincetonShieldLarge.png",
    reminderIcon: "icons/PrincetonShieldLarge.png",
    reminderInterval: surveyRemindPeriodDays * secondsPerDay,
    reminderMessage: "reminderMessage 2",
    reminderTitle: "reminderTitle 2",
    surveyCompletionUrl: "https://citpsearch.cs.princeton.edu/searchengine/final/thankyou",
    surveyUrl: "https://www.google.com/",
  },
}

let storage;

async function startFinalSurvey() {
  await webScience.userSurvey.endSurvey();
  webScience.userSurvey.setSurvey(surveyConfigData.final);
}

// Max timeout for setTimeout is 0x7FFFFFFF milliseconds (slightly less than 24.9 days)
// so this is needed for a longer timeout
function setFinalSurveyTimeout(delay) {
  if (delay > 0x7FFFFFFF) {
    setTimeout(function () { setFinalSurveyTimeout(delay - 0x7FFFFFFF) }, 0x7FFFFFFF);
  } else {
    setTimeout(() => {
      startFinalSurvey();
    }, delay);
  }
}

export async function runSurvey(storageIn): Promise<void> {
  storage = storageIn;

  // Get the start time of the initial survey from storage.
  // If the value does not exist in storage, set the initial start
  // time to the current time.
  let initialSurveyStartTime = await storage.get("InitialSurveyStartTime");
  if (!initialSurveyStartTime) {
    initialSurveyStartTime = Date.now();
    storage.set("InitialSurveyStartTime", initialSurveyStartTime);
  }

  let finalSurveyStartTime = initialSurveyStartTime + (millisecondsPerSecond * secondsPerDay * daysUntilSecondSurvey);

  let currentSurvey = await webScience.userSurvey.getSurveyName();

  if (!currentSurvey ||
    (currentSurvey === surveyConfigData.initial.surveyName && Date.now() <= finalSurveyStartTime)) {
    // If there is no current survey or the current survey is the initial survey
    // and the current time is before the time to start the final survey, we set
    // the current survey to be the initial survey and set a timeout to start the final survey.
    webScience.userSurvey.setSurvey(surveyConfigData.initial);
    setFinalSurveyTimeout(finalSurveyStartTime - Date.now());
  } else if (currentSurvey === surveyConfigData.initial.surveyName) {
    // If the current survey is the initial survey, we start the final survey.
    // We only reach here if the current time is after the final survey start time.
    startFinalSurvey();
  } else {
    // Set the survey to the current survey.
    // We only reach here if the current survey is the final survey.
    webScience.userSurvey.setSurvey(surveyConfigData[currentSurvey]);
  }
}