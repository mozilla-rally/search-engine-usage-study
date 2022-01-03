/**
 * This module enables selecting an intervention group for the participant
 * and conducting the respective intervention. This does not, however, conduct the
 * second stage of modal interventions (the popping up of a modal dialog).
 * 
 * @module Intervention
 */

import * as webScience from "@mozilla/web-science";
import * as Privileged from "./Privileged.js"
import * as ModalPopup from "./ModalPopup.js"
import * as Utils from "./Utils.js"

enum NoticeType {
  Default = 1,
  Revert = 2
}

enum ChoiceBallotType {
  Default = 1,
  Hidden = 2,
  Descriptions = 3,
  Extended = 4
}

/**
 * A persistent key-value storage object for the study
 * @type {Object}
 */
let storage;

/**
 * The selected intervention type
 * @type {string}
 */
let interventionType;

/**
 * Conducts intervention functionality.
 * @param {Object} storage - A persistent key-value storage object for the study
 * @async
 **/
export async function conductIntervention(interventionTypeArg, storageArg): Promise<void> {
  storage = storageArg;
  interventionType = interventionTypeArg;

  // Conducts the randomly selected intervention.
  if (interventionType === "NoticeDefault") {
    noticeIntervention(NoticeType.Default);
  } else if (interventionType === "NoticeRevert") {
    noticeIntervention(NoticeType.Revert);
  } else if (interventionType === "ChoiceBallotDefault") {
    choiceBallotIntervention(ChoiceBallotType.Default);
  } else if (interventionType === "ChoiceBallotHidden") {
    choiceBallotIntervention(ChoiceBallotType.Hidden);
  } else if (interventionType === "ChoiceBallotDescriptions") {
    choiceBallotIntervention(ChoiceBallotType.Descriptions);
  } else if (interventionType === "ChoiceBallotExtended") {
    choiceBallotIntervention(ChoiceBallotType.Extended);
  } else if (interventionType === "ModalPrimaryRevert") {
    choiceBallotIntervention(ChoiceBallotType.Descriptions);
  } else if (interventionType === "ModalSecondaryRevert") {
    choiceBallotIntervention(ChoiceBallotType.Descriptions);
  } else {
    completeIntervention();
  }
}

/**
 * Report notice data and complete the notice intervention.
 * @param {number} attentionDuration - How long the notice page has had the participant's attention.
 * @param {boolean} revertSelected - Whether the participant selected the option to revert the changes.
 * @param {string} originalEngine - The search engine that the participant's default was changed from.
 * @param {string} newEngine - The search engine that the participant's default was changed to.
 */
function reportNoticeData(attentionDuration: number, revertSelected: boolean, originalEngine: string, newEngine: string) {
  const noticeInterventionData = {
    AttentionDuration: attentionDuration,
    RevertSelected: revertSelected,
    OriginalEngine: originalEngine,
    NewEngine: newEngine,
  };

  console.log(noticeInterventionData);

  completeIntervention();
}

/**
 * Conduct one of the two notice interventions. The participant's default search engine will be changed
 * and they will be presented a notice notifying them of the change
 * @param {NoticeType} noticeType - Specifies the notice type that will be shown to the participant.
 * @async
 */
async function noticeIntervention(noticeType: NoticeType) {
  // If the notice has been shown already, then the intervention is complete.
  const noticeShown = await storage.get("NoticeShown");
  if (noticeShown) {
    reportNoticeData(-1, false, await storage.get("EngineChangedFrom"), await storage.get("EngineChangedTo"));
    return;
  }

  // Determine the participant's original search engine and homepage
  const originalEngine: string = await Privileged.getSearchEngine();
  const originalHomepage: string = await Privileged.getHomepage();

  // Creates a list of options for a new default search engine (excluding the participant's current default)
  let newSearchEngineOptions = Utils.getPrimarySearchEngineNames();
  if (originalEngine) {
    newSearchEngineOptions = newSearchEngineOptions.filter(engineOption => {
      return !originalEngine.toLowerCase().includes(engineOption.toLowerCase());
    })
  }

  // Change the participant's default engine to a random selection from the list of options for a new default
  const newEngine = newSearchEngineOptions[Math.floor(Math.random() * newSearchEngineOptions.length)];
  Privileged.changeSearchEngine(newEngine);

  // If the current home page is a search engine page, change it to the default Firefox homepage
  const homepageChange = Utils.getHomepageChangeNeeded(originalHomepage);
  if (homepageChange) {
    Utils.changeHomepageToDefault();
  }

  storage.set("EngineChangedFrom", originalEngine);
  storage.set("EngineChangedTo", newEngine);

  // Register a listener that will send a response to the notice page with the name of the original engine, new engine,
  // and if their homepage was changed so that they can be notified of changes.
  webScience.messaging.onMessage.addListener((_message, _sender, sendResponse) => {
    sendResponse({ originalEngine, newEngine, homepageChange: homepageChange });
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

    reportNoticeData(message.attentionDuration, message.revert, originalEngine, newEngine);
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
  });

  storage.set("NoticeShown", true);
}

/**
 * Report notice data and complete the notice intervention.
 * @param {number} attentionDuration - How long the notice page has had the participant's attention.
 * @param {boolean} revertSelected - Whether the participant selected the option to revert the changes.
 * @param {string} originalEngine - The search engine that the participant's default was changed from.
 * @param {string} newEngine - The search engine that the participant's default was changed to.
 */
function reportChoiceBallotData(
  attentionDurationList: number[],
  originalEngine: string,
  newEngine: string,
  seeMoreSelected: boolean,
  ordering: string[],
  detailsExpanded: string[],
  attempts: number) {

  const choiceBallotInterventionData = {
    AttentionDurationList: attentionDurationList,
    OriginalEngine: originalEngine,
    NewEngine: newEngine,
    SeeMoreSelected: seeMoreSelected,
    Ordering: ordering,
    DetailsExpanded: detailsExpanded,
    Attempts: attempts
  };

  console.log(choiceBallotInterventionData);

  completeIntervention();
}


/**
 * Conduct one of the four choice ballot interventions. A search engine choice ballot will be displayed to the participant
 * and their default search engine will be changed to their selection.
 * @param {ChoiceBallotType} ChoiceBallotType - Specifies the choice ballot type that will be shown to the participant.
 * @async
 */
async function choiceBallotIntervention(choiceBallotType: ChoiceBallotType) {
  // An array of the attention times for each attempt of the choice ballot
  let choiceBallotAttentionList: number[] = await storage.get("ChoiceBallotAttentionList");
  if (!choiceBallotAttentionList) {
    choiceBallotAttentionList = []
  }

  // If the choice ballot has previously been displayed, get the order the search engines
  // were displayed in.
  let enginesOrdering = await storage.get("ChoiceBallotEngineOrdering");

  // Get the number of times the choice ballot has been displayed to the participant.
  // If it has been shown three times already, we do not try again and mark the intervention
  // as completed.
  const choiceBallotAttemptsCounter = await webScience.storage.createCounter("ChoiceBallotAttempts");
  let choiceBallotAttempts = choiceBallotAttemptsCounter.get();
  if (choiceBallotAttempts >= 3) {
    reportChoiceBallotData(choiceBallotAttentionList, await Privileged.getSearchEngine(), "", false, enginesOrdering, null, 4);
    return;
  }

  // Increment the number of choice ballot attempts
  choiceBallotAttempts = await choiceBallotAttemptsCounter.incrementAndGet();

  // Determine the participant's original search engine and homepage
  const originalEngine = await Privileged.getSearchEngine();
  const homepageChangeNeeded = Utils.getHomepageChangeNeeded(await Privileged.getHomepage());

  // A listener that will be messaged by the choice ballot and respond with whether the homepage
  // will be changed to the default upon selection on the choice ballot and the ordering of engines
  // on the ballot.
  webScience.messaging.onMessage.addListener((_message, _sender, sendResponse) => {
    sendResponse({ homepageChange: !!homepageChangeNeeded, enginesOrdering });
  }, {
    type: "ChoiceBallotDetails",
    schema: {}
  });

  // A listener that can be messaged by the choice ballot with the ordering of search engines on 
  // the choice ballot.
  webScience.messaging.onMessage.addListener(message => {
    storage.set("ChoiceBallotEngineOrdering", message.enginesOrdering);
    enginesOrdering = message.enginesOrdering;
  }, {
    type: "ChoiceBallotEngineOrdering",
    schema: {
      enginesOrdering: "object"
    }
  });

  // A listener that will be messaged by the choice ballot upon selection of an engine.
  webScience.messaging.onMessage.addListener(async (message) => {
    storage.set("EngineChangedFrom", originalEngine);
    storage.set("EngineChangedTo", message.engine);

    // Modify the participant's default search engine to their choice ballot response
    Privileged.changeSearchEngine(message.engine);

    // If the current home page is a search engine page, change it to the default Firefox homepage
    if (homepageChangeNeeded) {
      Utils.changeHomepageToDefault();
    }

    // Update the attention duration list
    choiceBallotAttentionList[choiceBallotAttentionList.length - 1] = message.attentionDuration;

    reportChoiceBallotData(choiceBallotAttentionList, originalEngine, message.engine, message.seeMoreClicked, message.enginesOrdering, message.detailsExpanded, choiceBallotAttempts);
  }, {
    type: "ChoiceBallotResponse",
    schema: {
      engine: "string",
      attentionDuration: "number",
      seeMoreClicked: "boolean",
      enginesOrdering: "object",
      detailsExpanded: "object",
    }
  });


  // Add an element to the attention duration list for the current attempt.
  choiceBallotAttentionList.push(-1);
  storage.set("ChoiceBallotAttentionList", choiceBallotAttentionList);

  // Register a listener that will get the attention duration of the current attempt upon unload.
  webScience.messaging.onMessage.addListener((message) => {
    choiceBallotAttentionList[choiceBallotAttentionList.length - 1] = message.attentionDuration;
    storage.set("ChoiceBallotAttentionList", choiceBallotAttentionList);
  }, {
    type: "ChoiceBallotAttention",
    schema: {
      attentionDuration: "number",
    }
  });

  // Creates a browser popup window displaying the search engine choice ballot to the participant
  browser.windows.create({
    allowScriptsToClose: true,
    type: "popup",
    url: `/dist/pages/choice_ballot_${choiceBallotType}.html`,
  });
}

/**
 * Called when an intervention is complete. Sets the value of InterventionComplete to true
 * in storage and starts the post-intervention data collection stage of the study.
 */
function completeIntervention() {
  storage.set("InterventionComplete", true);
  ModalPopup.initializeModalIntervention(interventionType, storage);
}