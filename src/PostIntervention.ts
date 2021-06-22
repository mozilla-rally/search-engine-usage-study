/**
 * This module enables starting all functionality that should occur after
 * Intervention module functionality has been completed
 */

import * as Modal from "./Modal.js"
import * as Survey from "./Survey.js"
import * as SerpVisitCollection from "./SerpVisitCollection.js"
import * as RegularCollection from "./RegularCollection.js"

/**
 * Start post-intervention collection
 * @async
 **/
export async function start(storage) {
  Modal.start(storage);
  Survey.start(storage);
  SerpVisitCollection.start();
  RegularCollection.start(storage);
}