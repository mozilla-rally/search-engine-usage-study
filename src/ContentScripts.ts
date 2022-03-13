import { serpScripts, googleRemoveScript, googleReplaceScript, googleDefaultScript } from "./ContentScriptsImport.js"
import * as webScience from "@mozilla/web-science";
import { setExtendedTimeout } from "./Utils.js";

let registeredGoogleScript = null;

/**
 * Register the SERP content scripts and the messaging to tabs for onCreatedNavigationTarget
 * so that a content script can know if a link was opened in a new tab from its page
 * @param {number} treatmentStartTime - The start time of the treatment.
 * @async
 */
export async function registerContentScripts(conditionType, treatmentStartTime) {
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

  await registerGoogleScript(conditionType, treatmentStartTime);
}

async function registerGoogleScript(conditionType, treatmentStartTime): Promise<void> {

  if (conditionType !== "SelfPreferencedRemoval" && conditionType !== "SelfPreferencedReplacement") {
    registerGoogleDefaultScript();
    return;
  }

  const currentTime = webScience.timing.now();

  // We stop modifying self preferenced results after 50 days
  // (50 days * 24 hours * 60 minutes * 60 seconds * 1000 milliseconds)
  const treatmentEndTime = treatmentStartTime + (50 * 24 * 60 * 60 * 1000);

  if (currentTime < treatmentStartTime) {
    registerGoogleDefaultScript();

    setExtendedTimeout(() => {
      registerGoogleModificationScript(conditionType, treatmentEndTime);
    }, treatmentStartTime - currentTime);

  } else if (currentTime < treatmentEndTime) {
    registerGoogleModificationScript(conditionType, treatmentEndTime);
  } else {
    registerGoogleDefaultScript();
  }
}

async function registerGoogleDefaultScript() {
  if (registeredGoogleScript) {
    registeredGoogleScript.unregister();
    registeredGoogleScript = null;
  }

  googleDefaultScript.args["runAt"] = "document_start";
  registeredGoogleScript = await browser.contentScripts.register(googleDefaultScript.args);
}

async function registerGoogleModificationScript(conditionType, treatmentEndTime) {
  if (registeredGoogleScript) {
    registeredGoogleScript.unregister();
    registeredGoogleScript = null;
  }

  if (conditionType === "SelfPreferencedRemoval") {
    googleRemoveScript.args["runAt"] = "document_start";
    registeredGoogleScript = await browser.contentScripts.register(googleRemoveScript.args);
  } else if (conditionType === "SelfPreferencedReplacement") {
    googleReplaceScript.args["runAt"] = "document_start";
    registeredGoogleScript = await browser.contentScripts.register(googleReplaceScript.args);
  }


  const delay = treatmentEndTime - webScience.timing.now();
  setExtendedTimeout(registerGoogleDefaultScript, delay);
}
