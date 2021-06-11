import * as webScience from "@mozilla/web-science";
import * as Utils from "./Utils.js"
import * as SearchEngineUtils from "./SearchEngineUtils.js"

/**
 * Run initial collection
 * @async
 **/
export async function run(storage) {
  const date30DaysAgo = (new Date(new Date().setDate(new Date().getDate() - 30))).valueOf();
  const initialData = {
    SurveyId: await webScience.userSurvey.getSurveyId(),
    Engine: await Utils.getSearchEngine(),
    HistoryQueries: await SearchEngineUtils.getHistoryData(date30DaysAgo),
    Time: Date.now(),
    TimeOffset: new Date().getTimezoneOffset()
  };

  console.log(initialData);

  storage.set("InitialDataReported", true);
}
