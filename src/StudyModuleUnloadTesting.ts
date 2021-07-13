/**
 * Starts the search engine usage study.
 * 
 * @module StudyModule
 */
import * as webScience from "@mozilla/web-science";

/**
 * A persistent key-value storage object for the study
 * @type {Object}
 */
let storage;


/**
 * Start a search engine usage study
 * @param {Object} rally - Rally study object, used for sending data pings.
 * @async
 **/
export async function startStudy(_rallyArg): Promise<void> {
  storage = await webScience.storage.createKeyValueStorage("WebScience.Studies.SearchEngineUsage");



  let incrementValue = await storage.get("Increment");

  console.log(`Background script increment values: ${incrementValue}`)

  browser.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    if (message.type === "Increment") {
      incrementValue = incrementValue ? incrementValue + 1 : 1
      storage.set("Increment", incrementValue);
      console.log(`Background script increment values: ${incrementValue}`)
    }
  });
  return;

}
