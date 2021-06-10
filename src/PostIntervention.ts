import * as Modal from "./Modal.js"
import * as Survey from "./Survey.js"
import * as SerpVisitCollection from "./SerpVisitCollection.js"
import * as DailyCollection from "./DailyCollection.js"

export async function run(storage) {
  Modal.startModalIntervention(storage);
  Survey.runSurvey(storage);
  SerpVisitCollection.startCollection();
  DailyCollection.startCollection(storage);
}