/**
 * This module enables conducting the selected choice architecture treatment.
 * @module ChoiceArchitectureTreatment
 */

import * as webScience from "@mozilla/web-science";
import * as Privileged from "./Privileged.js"
import * as ModalPopup from "./ModalPopup.js"
import * as Utils from "./Utils.js"
import * as noticeInteractionMetrics from "../src/generated/noticeInteraction";
import * as ballotInteractionMetrics from "../src/generated/ballotInteraction";
import * as studyPings from "../src/generated/pings";

interface ChoiceBallotAttemptDetails {
  attemptNumber: number,
  seeMoreSelected: boolean,
  detailsExpanded: string[],
  attentionDuration: number,
  treatmentTime: number,
  dwellTime: number,
}

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
 * The selected treatment condition
 * @type {string}
 */
let conditionType;

let treatmentStartTime: number = null;

/**
 * Conducts choice architecture treatment functionality.
 * @param {Object} conditionTypeArg - The randomly selected condition for the participant
 * @param {Object} storageArg - A persistent key-value storage object for the study
 * @async
 **/
export async function conductTreatment(conditionTypeArg, storageArg): Promise<void> {
  conditionType = conditionTypeArg;
  storage = storageArg;

  treatmentStartTime = await storage.get("TreatmentStartTime");
  if (!treatmentStartTime) {
    treatmentStartTime = webScience.timing.now();
    storage.set("TreatmentStartTime", treatmentStartTime);
  }

  const treatmentComplete = await storage.get("TreatmentComplete");
  if (treatmentComplete) {
    ModalPopup.initializeModalPopup(conditionType, storage);
    return;
  }

  // Conducts the randomly selected treatment.
  if (conditionType === "NoticeDefault") {
    noticeTreatment(NoticeType.Default);
  } else if (conditionType === "NoticeRevert") {
    noticeTreatment(NoticeType.Revert);
  } else if (conditionType === "ChoiceBallotDefault") {
    choiceBallotTreatment(ChoiceBallotType.Default);
  } else if (conditionType === "ChoiceBallotHidden") {
    choiceBallotTreatment(ChoiceBallotType.Hidden);
  } else if (conditionType === "ChoiceBallotDescriptions") {
    choiceBallotTreatment(ChoiceBallotType.Descriptions);
  } else if (conditionType === "ChoiceBallotExtended") {
    choiceBallotTreatment(ChoiceBallotType.Extended);
  } else if (conditionType === "ModalPrimaryRevert") {
    choiceBallotTreatment(ChoiceBallotType.Descriptions);
  } else if (conditionType === "ModalSecondaryRevert") {
    choiceBallotTreatment(ChoiceBallotType.Descriptions);
  } else {
    completeTreatment();
  }
}

/**
 * Report notice data and complete the notice treatment.
 * @param {number} attentionDuration - How long the notice page has had the participant's attention.
 * @param {number} dwellTime - How long the notice page was open.
 * @param {boolean} revertSelected - Whether the participant selected the option to revert the changes.
 * @param {string} oldEngine - The search engine that the participant's default was changed from.
 * @param {string} newEngine - The search engine that the participant's default was changed to.
 */
function reportNoticeData(attentionDuration: number, dwellTime: number, revertSelected: boolean, oldEngine: string, newEngine: string, treatmentCompletionTime: number) {
  const noticeTreatmentData = {
    AttentionDuration: attentionDuration,
    DwellTime: dwellTime,
    RevertSelected: revertSelected,
    OldEngine: oldEngine,
    NewEngine: newEngine,
    TreatmentTime: treatmentStartTime,
    TreatmentCompletionTime: treatmentCompletionTime,
    PingTime: webScience.timing.now()
  };

  noticeInteractionMetrics.attentionDuration.set(Utils.getPositiveInteger(attentionDuration));
  noticeInteractionMetrics.dwellTime.set(Utils.getPositiveInteger(dwellTime));
  noticeInteractionMetrics.newSearchEngine.set(oldEngine);
  noticeInteractionMetrics.oldSearchEngine.set(newEngine);
  noticeInteractionMetrics.pingTime.set();
  noticeInteractionMetrics.revertSelected.set(revertSelected);
  noticeInteractionMetrics.treatmentCompletionTime.set(new Date(treatmentCompletionTime));
  noticeInteractionMetrics.treatmentTime.set(new Date(treatmentStartTime));

  studyPings.noticeInteraction.submit();

  console.log(noticeTreatmentData);

  completeTreatment();
}

/**
 * Conduct one of the two notice treatments. The participant's default search engine will be changed
 * and they will be presented a notice notifying them of the change
 * @param {NoticeType} noticeType - Specifies the notice type that will be shown to the participant.
 * @async
 */
async function noticeTreatment(noticeType: NoticeType) {
  // If the notice has been shown already, then the treatment is complete.
  const noticeShown = await storage.get("NoticeShown");
  if (noticeShown) {
    reportNoticeData(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, false, await storage.get("OldEngine"), await storage.get("NewEngine"), webScience.timing.now());
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
      revert: "boolean",
      completionTime: "number"
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
 * Report notice data and complete the notice treatment.
 * @param {number} attentionDurationList - How long the notice page has had the participant's attention on each ballot attempt.
 * @param {number} dwellTimeList - How long the notice page was open on each ballot attempt.
 * @param {boolean} revertSelected - Whether the participant selected the option to revert the changes.
 * @param {string} oldEngine - The search engine that the participant's default was changed from.
 * @param {string} newEngine - The search engine that the participant's default was changed to.
 */
function reportChoiceBallotData(
  oldEngine: string,
  newEngine: string,
  ordering: string[],
  attempts: number,
  treatmentCompletionTime: number,
  choiceBallotAttemptDetailsList: ChoiceBallotAttemptDetails[]) {

  const choiceBallotTreatmentData = {
    OldEngine: oldEngine,
    NewEngine: newEngine,
    Ordering: ordering,
    Attempts: attempts,
    TreatmentCompletionTime: treatmentCompletionTime,
    PingTime: webScience.timing.now(),
    AttemptDetails: choiceBallotAttemptDetailsList
  };
  console.log(choiceBallotTreatmentData)

  ballotInteractionMetrics.ballotOrdering.set(ordering);
  ballotInteractionMetrics.newSearchEngine.set(newEngine);
  ballotInteractionMetrics.oldSearchEngine.set(oldEngine);
  ballotInteractionMetrics.attempts.set(Utils.getPositiveInteger(attempts));
  ballotInteractionMetrics.treatmentCompletionTime.set(new Date(treatmentCompletionTime));
  ballotInteractionMetrics.pingTime.set();

  for (const choiceBallotAttemptDetails of choiceBallotAttemptDetailsList) {
    ballotInteractionMetrics.attemptDetails.record({
      attempt_number: Utils.getPositiveInteger(choiceBallotAttemptDetails.attemptNumber),
      attention_duration: Utils.getPositiveInteger(choiceBallotAttemptDetails.attentionDuration),
      details_expanded: choiceBallotAttemptDetails.detailsExpanded.join(),
      dwell_time: Utils.getPositiveInteger(choiceBallotAttemptDetails.dwellTime),
      see_more_selected: choiceBallotAttemptDetails.seeMoreSelected,
      treatment_time: Utils.getPositiveInteger(choiceBallotAttemptDetails.treatmentTime),
    });
  }

  studyPings.ballotInteraction.submit();

  completeTreatment();
}


/**
 * Conduct one of the four choice ballot treatments. A search engine choice ballot will be displayed to the participant
 * and their default search engine will be changed to their selection.
 * @param {ChoiceBallotType} ChoiceBallotType - Specifies the choice ballot type that will be shown to the participant.
 * @async
 */
async function choiceBallotTreatment(choiceBallotType: ChoiceBallotType) {


  // If the choice ballot has previously been displayed, get the order the search engines
  // were displayed in.
  let enginesOrdering = await storage.get("ChoiceBallotEngineOrdering");

  let choiceBallotAttemptDetails: ChoiceBallotAttemptDetails[] = await storage.get("ChoiceBallotAttemptDetails");
  if (!choiceBallotAttemptDetails) {
    choiceBallotAttemptDetails = [];
  }

  // Get the number of times the choice ballot has been displayed to the participant.
  // If it has been shown three times already, we do not try again and mark the treatment
  // as completed.
  const choiceBallotAttemptsCounter = await webScience.storage.createCounter("ChoiceBallotAttempts");
  let choiceBallotAttempts = choiceBallotAttemptsCounter.get();
  if (choiceBallotAttempts >= 3) {
    reportChoiceBallotData(await Privileged.getSearchEngine(), "", enginesOrdering, 4, webScience.timing.now(), choiceBallotAttemptDetails);
    return;
  }

  // Increment the number of choice ballot attempts
  choiceBallotAttempts = await choiceBallotAttemptsCounter.incrementAndGet();

  choiceBallotAttemptDetails.push({
    attemptNumber: choiceBallotAttempts,
    seeMoreSelected: false,
    detailsExpanded: [],
    attentionDuration: Number.MAX_SAFE_INTEGER,
    treatmentTime: webScience.timing.now(),
    dwellTime: Number.MAX_SAFE_INTEGER
  });
  storage.set("ChoiceBallotAttemptDetails", choiceBallotAttemptDetails);

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


  // A listener that can be messaged by the choice ballot with the ordering of search engines on 
  // the choice ballot.
  webScience.messaging.onMessage.addListener(message => {
    choiceBallotAttemptDetails[choiceBallotAttemptDetails.length - 1].detailsExpanded = message.detailsExpanded;
    storage.set("ChoiceBallotAttemptDetails", choiceBallotAttemptDetails);
  }, {
    type: "ChoiceBallotDetailsExpanded",
    schema: {
      detailsExpanded: "object",
    }
  });

  // A listener that will be messaged by the choice ballot if the 'See More Engines' button is clicked.
  webScience.messaging.onMessage.addListener(_message => {
    choiceBallotAttemptDetails[choiceBallotAttemptDetails.length - 1].seeMoreSelected = true;
    storage.set("ChoiceBallotAttemptDetails", choiceBallotAttemptDetails);
  }, {
    type: "ChoiceBallotSeeMoreButtonClicked",
    schema: {}
  });

  // Register a listener that will get the ballot data upon unload.
  webScience.messaging.onMessage.addListener((message) => {
    choiceBallotAttemptDetails[choiceBallotAttemptDetails.length - 1].attentionDuration = message.attentionDuration;
    choiceBallotAttemptDetails[choiceBallotAttemptDetails.length - 1].dwellTime = message.dwellTime;
    storage.set("ChoiceBallotAttemptDetails", choiceBallotAttemptDetails);

    if (message.ballotCompleted) {
      storage.set("OldEngine", oldEngine);
      storage.set("NewEngine", message.newEngine);

      // Modify the participant's default search engine to their choice ballot response
      Privileged.changeSearchEngine(message.newEngine);

      // If the current home page is a search engine page, change it to the default Firefox homepage
      if (homepageChangeNeeded) {
        Utils.changeHomepageToDefault();
      }

      reportChoiceBallotData(oldEngine, message.newEngine, enginesOrdering, choiceBallotAttempts, message.completionTime, choiceBallotAttemptDetails);
    }
  }, {
    type: "ChoiceBallotData",
    schema: {
      newEngine: "string",
      attentionDuration: "number",
      dwellTime: "number",
      ballotCompleted: "boolean",
      completionTime: "number"
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
 * Called when a treatment is complete (excluding the modal popup stage of a modal treatment).
 * Sets the value of TreatmentComplete to true in storage and starts the modal dialog treatment functionality.
 */
function completeTreatment() {
  storage.set("TreatmentComplete", true);
  ModalPopup.initializeModalPopup(conditionType, storage);
}