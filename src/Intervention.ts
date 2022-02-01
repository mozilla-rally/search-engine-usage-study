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

let treatmentStartTimes: number[] = null;

/**
 * Conducts intervention functionality.
 * @param {Object} storage - A persistent key-value storage object for the study
 * @async
 **/
export async function conductIntervention(interventionTypeArg, storageArg): Promise<void> {
  storage = storageArg;
  interventionType = interventionTypeArg;

  const interventionComplete = await storage.get("InterventionComplete");
  if (interventionComplete) {
    ModalPopup.initializeModalIntervention(interventionType, storage);
    return;
  }

  treatmentStartTimes = await storage.get("TreatmentStartTimes");
  if (!treatmentStartTimes) {
    treatmentStartTimes = [webScience.timing.now()];
  }

  treatmentStartTimes.push(webScience.timing.now());
  storage.set("TreatmentStartTimes", treatmentStartTimes);

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
 * @param {number} dwellTime - How long the notice page was open.
 * @param {boolean} revertSelected - Whether the participant selected the option to revert the changes.
 * @param {string} oldEngine - The search engine that the participant's default was changed from.
 * @param {string} newEngine - The search engine that the participant's default was changed to.
 */
function reportNoticeData(attentionDuration: number, dwellTime: number, revertSelected: boolean, oldEngine: string, newEngine: string, treatmentCompletionTime: number) {
  const noticeInterventionData = {
    AttentionDuration: attentionDuration,
    DwellTime: dwellTime,
    RevertSelected: revertSelected,
    OldEngine: oldEngine,
    NewEngine: newEngine,
    TreatmentTime: treatmentStartTimes[0],
    TreatmentCompletionTime: treatmentCompletionTime,
    PingTime: webScience.timing.now()
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
    reportNoticeData(-1, -1, false, await storage.get("OldEngine"), await storage.get("NewEngine"), webScience.timing.now());
    return;
  }

  // Determine the participant's original search engine and homepage
  const oldEngine: string = await Privileged.getSearchEngine();
  const originalHomepage: string = await Privileged.getHomepage();

  // Creates a list of options for a new default search engine (excluding the participant's current default)
  let newSearchEngineOptions = Utils.getPrimarySearchEngineNames();
  if (oldEngine) {
    newSearchEngineOptions = newSearchEngineOptions.filter(engineOption => {
      return !oldEngine.toLowerCase().includes(engineOption.toLowerCase());
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

  storage.set("OldEngine", oldEngine);
  storage.set("NewEngine", newEngine);

  // Register a listener that will send a response to the notice page with the name of the new engine
  // and if their homepage was changed so that the participant can be notified of changes.
  webScience.messaging.onMessage.addListener((_message, _sender, sendResponse) => {
    sendResponse({ newEngine, homepageChange: homepageChange });
  }, {
    type: "NoticeDetails",
    schema: {}
  });

  // Register a listener that will be sent a message when the notice page unloads
  webScience.messaging.onMessage.addListener((message) => {
    // If the participant clicked on the button to revert the change, we restore their original default search engine and homepage
    if (message.revert) {
      Privileged.changeHomepage(originalHomepage);
      Privileged.changeSearchEngine(oldEngine);
    }

    reportNoticeData(message.attentionDuration, message.dwellTime, message.revert, oldEngine, newEngine, message.completionTime);
  }, {
    type: "NoticeResponse",
    schema: {
      attentionDuration: "number",
      dwellTime: "number",
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
 * @param {number} attentionDurationList - How long the notice page has had the participant's attention on each ballot attempt.
 * @param {number} dwellTimeList - How long the notice page was open on each ballot attempt.
 * @param {boolean} revertSelected - Whether the participant selected the option to revert the changes.
 * @param {string} OldEngine - The search engine that the participant's default was changed from.
 * @param {string} newEngine - The search engine that the participant's default was changed to.
 */
function reportChoiceBallotData(
  attentionDurationList: number[],
  dwellTimeList: number[],
  oldEngine: string,
  newEngine: string,
  seeMoreSelected: boolean,
  ordering: string[],
  detailsExpanded: string[],
  attempts: number,
  treatmentCompletionTime: number) {

  const choiceBallotInterventionData = {
    AttentionDurationList: attentionDurationList,
    DwellTimeList: dwellTimeList,
    OldEngine: oldEngine,
    NewEngine: newEngine,
    SeeMoreSelected: seeMoreSelected,
    Ordering: ordering,
    DetailsExpanded: detailsExpanded,
    Attempts: attempts,
    TreatmentTime: treatmentStartTimes,
    TreatmentCompletionTime: treatmentCompletionTime,
    PingTime: webScience.timing.now()
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

  // An array of the attention times for each attempt of the choice ballot
  let choiceBallotDwellTimeList: number[] = await storage.get("ChoiceBallotDwellTimeList");
  if (!choiceBallotDwellTimeList) {
    choiceBallotDwellTimeList = []
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
    reportChoiceBallotData(choiceBallotAttentionList, choiceBallotDwellTimeList, await Privileged.getSearchEngine(), "", false, enginesOrdering, null, 4, webScience.timing.now());
    return;
  }

  // Increment the number of choice ballot attempts
  choiceBallotAttempts = await choiceBallotAttemptsCounter.incrementAndGet();

  // Determine the participant's original search engine and homepage
  const oldEngine = await Privileged.getSearchEngine();
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

  // Register a listener that will get the ballot data upon unload.
  webScience.messaging.onMessage.addListener((message) => {
    choiceBallotAttentionList.push(message.attentionDuration);
    storage.set("ChoiceBallotAttentionList", choiceBallotAttentionList);

    choiceBallotDwellTimeList.push(message.dwellTime);
    storage.set("ChoiceBallotDwellTimeList", choiceBallotDwellTimeList);

    if (message.ballotCompleted) {
      storage.set("OldEngine", oldEngine);
      storage.set("NewEngine", message.newEngine);

      // Modify the participant's default search engine to their choice ballot response
      Privileged.changeSearchEngine(message.newEngine);

      // If the current home page is a search engine page, change it to the default Firefox homepage
      if (homepageChangeNeeded) {
        Utils.changeHomepageToDefault();
      }

      reportChoiceBallotData(choiceBallotAttentionList, choiceBallotDwellTimeList, oldEngine, message.newEngine, message.seeMoreClicked, message.enginesOrdering, message.detailsExpanded, choiceBallotAttempts, message.completionTime);
    }
  }, {
    type: "ChoiceBallotData",
    schema: {
      engine: "string",
      attentionDuration: "number",
      dwellTime: "number",
      detailsExpanded: "object",
      seeMoreClicked: "boolean",
      enginesOrdering: "object",
      ballotCompleted: "boolean"
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
 * in storage and starts the modal dialog treatment functionality.
 */
function completeIntervention() {
  storage.set("InterventionComplete", true);
  ModalPopup.initializeModalIntervention(interventionType, storage);
}