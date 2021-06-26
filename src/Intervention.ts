/**
 * This module enables selecting an intervention group for the participant
 * and conducting the respective intervention. This does not, however, conduct the
 * second stage of modal interventions (the popping up of a modal dialog)
 */

import * as webScience from "@mozilla/web-science";
import * as Privileged from "./Privileged.js"
import * as PostIntervention from "./PostIntervention.js"
import * as Utils from "./Utils.js"

/**
 * @type {Object}
 * A persistent key-value storage object for the study
 */
let storage;

/**
 * @type {ConditionSet}
 * The set of study interventions and their relative weights.
 */
const interventionSet = {
  name: "InterventionSelection",
  conditions: [
    { name: "NoIntervention", weight: 10 },
    { name: "NoticeDefault", weight: 20 },
    { name: "NoticeRevert", weight: 20 },
    { name: "ChoiceScreenDefault", weight: 10 },
    { name: "ChoiceScreenHidden", weight: 10 },
    { name: "ChoiceScreenDescriptions", weight: 10 },
    { name: "ChoiceScreenExtended", weight: 20 },
    { name: "ModalPrimaryRevert", weight: 10 },
    { name: "ModalSecondaryRevert", weight: 10 },
  ]
};

/**
 * Starts intervention functionality.
 * @async
 * @param {Object} storage - A persistent key-value storage object for the study
 **/
export async function start(storageIn): Promise<void> {
  storage = storageIn;

  // Get the intervention type from storage.
  // If the value does not exist in storage, then we randomly select
  // an intervention type and save the selection to storage.
  let interventionType = await storage.get("InterventionType");
  if (!interventionType) {
    interventionType = await webScience.randomization.selectCondition(interventionSet);
    storage.set("InterventionType", interventionType);
  }

  // Conducts the randomly selected intervention.
  if (interventionType === "NoticeDefault") {
    noticeIntervention(1);
  } else if (interventionType === "NoticeRevert") {
    noticeIntervention(2);
  } else if (interventionType === "ChoiceScreenDefault") {
    choiceScreenIntervention(1);
  } else if (interventionType === "ChoiceScreenHidden") {
    choiceScreenIntervention(2);
  } else if (interventionType === "ChoiceScreenDescriptions") {
    choiceScreenIntervention(3);
  } else if (interventionType === "ChoiceScreenExtended") {
    choiceScreenIntervention(4);
  } else if (interventionType === "ModalPrimaryRevert") {
    choiceScreenIntervention(3);
  } else if (interventionType === "ModalSecondaryRevert") {
    choiceScreenIntervention(3);
  } else {
    completeIntervention();
  }
}

/**
 * Conduct one of the two notice interventions. The participant's default search engine will be changed
 * and they will be presented a notice notifying them of the change
 * @async
 * @param {number} noticeType - Specifies the notice type that will be shown to the participant
 * Should be either 1 or 2.
 */
async function noticeIntervention(noticeType: number) {
  // If the notice has been shown already, then the intervention is complete.
  const noticeShown = await storage.get("NoticeShown");
  if (noticeShown) {
    const noticeInterventionData = {
      AttentionDuration: null,
      RevertSelected: null,
      OriginalEngine: await storage.get("EngineChangedFrom"),
      NewEngine: await storage.get("EngineChangedTo"),
    };
    console.log(noticeInterventionData);

    completeIntervention();
    return;
  }

  // Determine the participant's original search engine and homepage
  const originalEngine = await Privileged.getSearchEngine();
  const originalHomepage = await Privileged.getHomepage();
  const originalHomepageEngine = Utils.getEngineFromURL(originalHomepage);

  // Creates a list of options for a new default search engine (excluding the participant's current default)
  let newSearchEngineOptions = ["Google", "DuckDuckGo", "Yahoo", "Bing"];
  if (originalEngine) {
    newSearchEngineOptions = newSearchEngineOptions.filter(engineOption => {
      return !originalEngine.toLowerCase().includes(engineOption.toLowerCase());
    })
  }

  // Change the participant's default engine to a random selection from the list of options for a new default
  const newEngine = newSearchEngineOptions[Math.floor(Math.random() * newSearchEngineOptions.length)];
  Privileged.changeSearchEngine(newEngine);

  // If the current home page is a search engine page, change it to the default Firefox homepage
  let homepageChanged = false;
  if (originalHomepageEngine) {
    Privileged.changeHomepage("about:home");
    homepageChanged = true;
  }

  storage.set("EngineChangedFrom", originalEngine);
  storage.set("EngineChangedTo", newEngine);

  // Register a listener that will send a response to the notice page with the name of the original engine, new engine,
  // and if their homepage was changed so that they can be notified of changes.
  webScience.messaging.onMessage.addListener((_message, _sender, sendResponse) => {
    sendResponse({ originalEngine, newEngine, homepageChange: homepageChanged });
  }, {
    type: "NoticeDetails",
    schema: {}
  });

  // Register a listener that will be sent a message when the notice page unloads
  webScience.messaging.onMessage.addListener((message) => {
    // If the participant clicked on the button to revert the change, we restore their original default search engine and homepage
    if (message.revert) {
      Privileged.changeHomepage(originalHomepage);
      Privileged.changeSearchEngine(originalEngine);
    }

    const noticeInterventionData = {
      AttentionDuration: message.attentionDuration,
      RevertSelected: message.revert,
      OriginalEngine: originalEngine,
      NewEngine: newEngine,
    };
    console.log(noticeInterventionData);

    // At this point, the intervention is complete
    completeIntervention();
  }, {
    type: "NoticeResponse",
    schema: {
      attentionDuration: "number",
      revert: "boolean"
    }
  });

  // Creates a browser popup window displaying the notice to the participant
  browser.windows.create({
    allowScriptsToClose: true,
    type: "popup",
    url: `/dist/pages/notice_${noticeType}.html`,
    width: 1024,
    height: 768
  });

  storage.set("NoticeShown", true);
}


/**
 * Conduct one of the four choice screen interventions. A search engine choice screen will be displayed to the participant
 * and their default search engine will be changed to their selection.
 * @async
 * @param {boolean} choiceScreenDesign - Specifies the choice screen style that will be shown to the participant.
 * Should be either 1, 2, 3, or 4. 
 */
async function choiceScreenIntervention(choiceScreenDesign: number) {
  // Get the number of times the choice screen has been displayed to the participant.
  // If it has been shown three times already, we do not try again and mark the intervention
  // as completed.
  const choiceScreenAttemptsCounter = await webScience.storage.createCounter("ChoiceScreenAttempts");
  let choiceScreenAttempts = choiceScreenAttemptsCounter.get();
  if (choiceScreenAttempts >= 3) {
    const choiceScreenInterventionData = {
      AttentionDuration: null,
      OriginalEngine: await Privileged.getSearchEngine(),
      SelectedEngine: null,
      SeeMoreSelected: null,
      Ordering: null,
      DetailsExpanded: null,
      Attempts: 4
    };

    console.log(choiceScreenInterventionData);

    completeIntervention();
    return;
  }

  // Increment the number of choice screen attempts
  choiceScreenAttempts = await choiceScreenAttemptsCounter.incrementAndGet();

  // Determine the participant's original search engine and homepage
  const originalEngine = await Privileged.getSearchEngine();
  const originalHomepage = await Privileged.getHomepage();
  const originalHomepageEngine = Utils.getEngineFromURL(originalHomepage);

  // If the choice screen has previously been displayed, get the order the search engines
  // were displayed in.
  const engines_ordering = await storage.get("ChoiceScreenEngineOrdering");

  // A listener that will be messaged by the choice screen and respond with whether the homepage
  // will be changed to the default upon selection on the choice screen and the ordering of engines
  // on the ballot.
  webScience.messaging.onMessage.addListener((_message, _sender, sendResponse) => {
    sendResponse({ homepageChange: !!originalHomepageEngine, engines_ordering });
  }, {
    type: "ChoiceScreenDetails",
    schema: {}
  });

  // A listener that can be messaged by the choice screen with the ordering of search engines on 
  // the choice screen.
  webScience.messaging.onMessage.addListener(message => {
    storage.set("ChoiceScreenEngineOrdering", message.engines_ordering);
  }, {
    type: "ChoiceScreenEngineOrdering",
    schema: {
      engines_ordering: "object"
    }
  });

  // A listener that will be messaged by the choice screen upon selection of an engine.
  webScience.messaging.onMessage.addListener(async (message) => {
    storage.set("EngineChangedFrom", originalEngine);
    storage.set("EngineChangedTo", message.engine);

    // Modify the participant's default search engine to their choice screen response
    Privileged.changeSearchEngine(message.engine);

    // If the current home page is a search engine page, change it to the default Firefox homepage
    if (originalHomepageEngine) {
      Privileged.changeHomepage("about:home");
    }

    const choiceScreenInterventionData = {
      AttentionDuration: message.attentionDuration,
      OriginalEngine: originalEngine,
      SelectedEngine: message.engine,
      SeeMoreSelected: message.see_more_clicked,
      Ordering: message.engines_ordering,
      DetailsExpanded: message.details_expanded,
      Attempts: choiceScreenAttempts
    };

    console.log(choiceScreenInterventionData);

    completeIntervention();
  }, {
    type: "ChoiceScreenResponse",
    schema: {
      engine: "string",
      attentionDuration: "number",
      see_more_clicked: "boolean",
      engines_ordering: "object",
      details_expanded: "object",
    }
  });

  // Creates a browser popup window displaying the search engine choice screen to the participant
  browser.windows.create({
    allowScriptsToClose: true,
    type: "popup",
    url: `/dist/pages/choice_screen_${choiceScreenDesign}.html`,
    width: 1024,
    height: 768
  });
}

/**
 * Called when an intervention is complete. Sets the value of InterventionComplete to true
 * in storage and starts the post-intervention data collection stage of the study.
 */
function completeIntervention() {
  storage.set("InterventionComplete", true);
  PostIntervention.start(storage);
}