/**
 * This module enables starting all functionality that should occur after
 * Intervention module functionality has been completed. This consists of the
 * modal functionality, survey functionality, collection of SERP visit data, and
 * daily collection.
 * 
 * @module PostIntervention
 */

import * as ModalPopup from "./ModalPopup.js"
import * as Survey from "./Survey.js"
import * as SerpVisitCollection from "./SerpVisitCollection.js"

/**
 * Start post-intervention collection
 * @async
 **/
export async function initializeCollection(interventionType, storage) {
  ModalPopup.initializeModalIntervention(interventionType, storage);
  Survey.initializeSurvey(storage);
  SerpVisitCollection.initializeCollection(storage);
}