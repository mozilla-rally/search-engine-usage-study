import * as webScience from "@mozilla/web-science";
import * as Utils from "./Utils.js"
import * as SearchEngineUtils from "./SearchEngineUtils.js"

export async function reportInitialData(storage) {
  const initialData = {
    SurveyId: await webScience.userSurvey.getSurveyId(),
    Engine: await Utils.getSearchEngine(),

    Time: Date.now(),
    TimeOffset: new Date().getTimezoneOffset(),
    HistoryQueries: await SearchEngineUtils.getHistoryData((new Date(new Date().setDate(new Date().getDate() - 30))).valueOf())
  }

  console.log(initialData);

  storage.set("InitialDataReported", true);
}
