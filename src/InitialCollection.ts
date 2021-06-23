import * as webScience from "@mozilla/web-science";
import * as Privileged from "./Privileged.js"
import * as Utils from "./Utils.js"

/**
 * Run initial data collection
 * @async
 **/
export async function run(storage) {
  // Gets a timeStamp from 30 days ago
  // Current timeStamp - (30 days * 24 hours * 60 minutes * 60 seconds * 1000 milliseconds)
  const timeStamp30DaysAgo = webScience.timing.now() - (30 * 24 * 60 * 60 * 1000);

  const initialData = {
    SurveyId: await webScience.userSurvey.getSurveyId(),
    Engine: await Privileged.getSearchEngine(),
    HistoryQueries: await Utils.getHistoryData(timeStamp30DaysAgo),
    Time: webScience.timing.now(),
    TimeOffset: new Date().getTimezoneOffset()
  };

  console.log(initialData);

  storage.set("InitialDataReported", true);
}
