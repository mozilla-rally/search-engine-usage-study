/**
 * This module enables collection of data that will occur once upon
 * initial startup of the study.
 */

import * as webScience from "@mozilla/web-science";
import * as Privileged from "./Privileged.js"
import * as Utils from "./Utils.js"

/**
 * Run initial collection
 * @async
 **/
export async function run(storage) {
  const date30DaysAgo = (new Date(new Date().setDate(new Date().getDate() - 30))).valueOf();
  const initialData = {
    SurveyId: await webScience.userSurvey.getSurveyId(),
    Engine: await Privileged.getSearchEngine(),
    HistoryQueries: await Utils.getHistoryData(date30DaysAgo),
    Time: Date.now(),
    TimeOffset: new Date().getTimezoneOffset()
  };

  console.log(initialData);

  storage.set("InitialDataReported", true);
}
