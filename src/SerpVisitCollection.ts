import * as webScience from "@mozilla/web-science";
import { serpScripts } from "./content-scripts-import.js"

/**
 * Start SERP visit collection
 * @async
 **/
export async function start(): Promise<void> {
  registerSerpVisitDataListener();
  registerContentScripts();
}

/**
 * Register the SERP content scripts
 * @async
 */
async function registerContentScripts() {
  for (const serpScript of serpScripts) {
    if (!serpScript.enabled) {
      continue;
    }
    serpScript.args["runAt"] = "document_start";
    await browser.contentScripts.register(serpScript.args);
  }
}

/** 
 * Registers the listener that gets SERP visit data from content scripts
 */
function registerSerpVisitDataListener(): void {
  // Listen for new SERP visit data from content scripts
  webScience.messaging.onMessage.addListener((message) => {
    console.log(message);
  }, {
    type: "SerpVisitData",
    schema: {
      data: "object",
    }
  });
}