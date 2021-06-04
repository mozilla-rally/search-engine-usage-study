import * as webScience from "@mozilla/web-science";
import { preLoadScripts, serpScripts } from "./content-scripts-import.js"

export async function startCollection(): Promise<void> {
  registerSerpVisitDataListener();
  registerContentScripts();
}

/**
 * Register the SERP content scripts and the listeners to store SERP queries and get page attribution details
 */
async function registerContentScripts() {
  const siteScripts = [...serpScripts]

  for (const siteScript of siteScripts) {
    if (!siteScript.enabled) {
      continue
    }

    siteScript.args.js = [
      ...preLoadScripts,
      ...siteScript.args.js,
    ]

    siteScript.args["runAt"] = "document_start"
    await browser.contentScripts.register(siteScript.args)
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