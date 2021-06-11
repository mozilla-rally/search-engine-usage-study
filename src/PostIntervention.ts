import * as Modal from "./Modal.js"
import * as Survey from "./Survey.js"
import * as SerpVisitCollection from "./SerpVisitCollection.js"
import * as DailyCollection from "./DailyCollection.js"

/**
 * Start post-intervention collection
 * @async
 **/
export async function start(storage) {
  Modal.start(storage);
  Survey.start(storage);
  SerpVisitCollection.start();
  DailyCollection.start(storage);
}