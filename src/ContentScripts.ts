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

  // Register all of the non-Google SERP scripts
  for (const serpScript of serpScripts) {
    serpScript.args["runAt"] = "document_start";
    await browser.contentScripts.register(serpScript.args);
  }

  await registerGoogleScript(conditionType, treatmentStartTime);
}

async function registerGoogleScript(conditionType, treatmentStartTime): Promise<void> {

  // If the participant is not in the self preferenced result removal or replacement group,
  // we register the default Google SERP script.
  if (conditionType !== "SelfPreferencedRemoval" && conditionType !== "SelfPreferencedReplacement") {
    registerGoogleDefaultScript();
    return;
  }

  const currentTime = webScience.timing.now();

  // We stop modifying self preferenced results 50 days after the treatment start time.
  // (50 days * 24 hours * 60 minutes * 60 seconds * 1000 milliseconds)
  const treatmentEndTime = treatmentStartTime + (50 * 24 * 60 * 60 * 1000);

  if (currentTime < treatmentStartTime) {
    // If the current time is less than the treatment start time, we register the default Google SERP script
    // and then set a timer to register the modification Google SERP script at the treatment start time.
    registerGoogleDefaultScript();

    setExtendedTimeout(() => {
      registerGoogleModificationScript(conditionType, treatmentEndTime);
    }, treatmentStartTime - currentTime);

  } else if (currentTime < treatmentEndTime) {
    // If the current time is less than the treatment end time (and greater than the treatment start time because)
    // of the preceding if-statement, we register the modification Google SERP script.
    registerGoogleModificationScript(conditionType, treatmentEndTime);
  } else {
    // Otherwise (if the current time is past the treatment end time), we register the default Google SERP script.
    registerGoogleDefaultScript();
  }
}

async function registerGoogleDefaultScript() {
  // Unregister any registered Google script.
  if (registeredGoogleScript) {
    registeredGoogleScript.unregister();
    registeredGoogleScript = null;
  }

  // Register the default Google SERP script.
  googleDefaultScript.args["runAt"] = "document_start";
  registeredGoogleScript = await browser.contentScripts.register(googleDefaultScript.args);
}

async function registerGoogleModificationScript(conditionType, treatmentEndTime) {
  // Unregister any registered Google script.
  if (registeredGoogleScript) {
    registeredGoogleScript.unregister();
    registeredGoogleScript = null;
  }

  // Register the modification Google SERP script for the participant based on their assigned
  // condition.
  if (conditionType === "SelfPreferencedRemoval") {
    googleRemoveScript.args["runAt"] = "document_start";
    registeredGoogleScript = await browser.contentScripts.register(googleRemoveScript.args);
  } else if (conditionType === "SelfPreferencedReplacement") {
    googleReplaceScript.args["runAt"] = "document_start";
    registeredGoogleScript = await browser.contentScripts.register(googleReplaceScript.args);
  }


  // Set a timer to register the default Google serp script upon treatment end time.
  const delay = treatmentEndTime - webScience.timing.now();
  setExtendedTimeout(registerGoogleDefaultScript, delay);
}
