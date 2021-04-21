import * as webScience from "@mozilla/web-science";

const millisecondsPerSecond = 1000;
const secondsPerDay = 86400;
const surveyRemindPeriodDays = 3;
const secondSurveyStartDay = 30;

const surveyData = {
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
  second: {
    surveyName: "second",
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
  secondPlus: {
    surveyName: "secondPlus",
    popupNoPromptMessage: "No survey prompt message 3",
    popupPromptMessage: "popupPromptMessage 3",
    popupIcon: "icons/PrincetonShieldLarge.png",
    reminderIcon: "icons/PrincetonShieldLarge.png",
    reminderInterval: surveyRemindPeriodDays * secondsPerDay,
    reminderMessage: "reminderMessage 3",
    reminderTitle: "reminderTitle 3",
    surveyCompletionUrl: "https://citpsearch.cs.princeton.edu/searchengine/final/thankyou",
    surveyUrl: "https://duckduckgo.com/",
  },
}

let storage;

async function startSecondSurvey() {
  // We get the status of the initial survey before ending the survey and 
  // starting one of the initial surveys.
  const initialSurveyCompleted = await webScience.userSurvey.getSurveyStatus();
  await webScience.userSurvey.endSurvey();
  if (initialSurveyCompleted === "completed") {
    // If the initial survey was completed, we set the current survey to be
    // the default second survey.
    webScience.userSurvey.setSurvey(surveyData.second);
  } else {
    // If the initial survey was not completed, we set the current survey to be
    // the second survey with demographic questions from the initial survey
    webScience.userSurvey.setSurvey(surveyData.secondPlus);
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

  let secondSurveyStartTime = initialSurveyStartTime + (millisecondsPerSecond * secondsPerDay * secondSurveyStartDay);

  let currentSurvey = await webScience.userSurvey.getSurveyName();
  console.log("SURVEY 1")

  if (!currentSurvey ||
    (currentSurvey === surveyData.initial.surveyName && Date.now() <= secondSurveyStartTime)) {
    // If there is no current survey or the current survey is the initial survey
    // and the current time is before the time to start the second survey, we set
    // the current survey to be the initial survey and set a timeout to start the second survey.
    webScience.userSurvey.setSurvey(surveyData.initial);
    console.log(secondSurveyStartTime - Date.now())
    setTimeout(() => {
      startSecondSurvey();
    }, 10000);
  } else if (currentSurvey === surveyData.initial.surveyName) {
    // If the current survey is the initial survey, we start the second survey.
    // We only reach here if the current time is after the second survey start time.
    startSecondSurvey();
  } else {
    // Set the survey to the current survey.
    // We only reach here if the current survey is one of the second surveys.
    webScience.userSurvey.setSurvey(surveyData[currentSurvey]);
  }
}