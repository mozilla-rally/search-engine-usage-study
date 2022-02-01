import { serpScripts, googleRemoveScript, googleReplaceScript, googleDefaultScript } from "./contentScriptsImport.js"
import * as webScience from "@mozilla/web-science";


/**
 * Register the SERP content scripts and the messaging to tabs for onCreatedNavigationTarget
 * so that a content script can know if a link was opened in a new tab from its page
 * @async
 */
export async function registerContentScripts(conditionType) {
  webScience.messaging.registerSchema("CreatedNavigationTargetMessage", {
    details: "object"
  });

  // There's currently a regression in Firefox where this doesn't fire for new tabs triggered by
  // target="_blank" link clicks. This is okay for this study, however, because such clicks are
  // accounted for with click event listeners added to DOM elements by the content scripts.
  browser.webNavigation.onCreatedNavigationTarget.addListener((details) => {
    webScience.messaging.sendMessageToTab(details.sourceTabId, {
      type: "CreatedNavigationTargetMessage",
      details
    });
  });

  for (const serpScript of serpScripts) {
    serpScript.args["runAt"] = "document_start";
    await browser.contentScripts.register(serpScript.args);
  }

  await registerGoogleScript(conditionType);
}

async function registerGoogleScript(conditionType): Promise<void> {
  if (conditionType === "SelfPreferencedRemoval") {
    googleRemoveScript.args["runAt"] = "document_start";
    await browser.contentScripts.register(googleRemoveScript.args);
  } else if (conditionType === "SelfPreferencedReplacement") {
    googleReplaceScript.args["runAt"] = "document_start";
    await browser.contentScripts.register(googleReplaceScript.args);
  } else {
    googleDefaultScript.args["runAt"] = "document_start";
    await browser.contentScripts.register(googleDefaultScript.args);
  }
}


