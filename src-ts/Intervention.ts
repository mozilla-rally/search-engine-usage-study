import * as webScience from "@mozilla/web-science";
import * as RegularCollection from "./RegularCollection.js"
import * as Utils from "./Utils.js"

let storage;

/** 
 * Select an intervention, save the intervention name to storage, and
 * conduct the intervention.
 */
export async function runIntervention(storageIn): Promise<void> {
  storage = storageIn

  const interventionType = await webScience.randomization.selectCondition({
    name: "InterventionSelection",
    conditions: [
      {
        name: "NoIntervention",
        weight: 10,
      },
      {
        name: "NoticeDefault",
        weight: 20
      },
      {
        name: "NoticeRevert",
        weight: 20
      },
      {
        name: "BallotDefault",
        weight: 10
      },
      {
        name: "BallotHidden",
        weight: 10
      },
      {
        name: "BallotDescriptions",
        weight: 10
      },
      {
        name: "BallotExtended",
        weight: 20
      },
      {
        name: "ModalPrimaryRevert",
        weight: 10
      },
      {
        name: "ModalSecondaryRevert",
        weight: 10
      },
    ]
  }
  );

  storage.set("InterventionType", interventionType);

  if (interventionType === "NoticeDefault") {
    noticeIntervention(2);
  } else if (interventionType === "NoticeRevert") {
    noticeIntervention(3);
  } else if (interventionType === "BallotDefault") {
    ballotIntervention(4);
  } else if (interventionType === "BallotHidden") {
    ballotIntervention(5);
  } else if (interventionType === "BallotDescriptions") {
    ballotIntervention(6);
  } else if (interventionType === "BallotExtended") {
    ballotIntervention(7);
  } else if (interventionType === "ModalPrimaryRevert") {
    ballotIntervention(6);
  } else if (interventionType === "ModalSecondaryRevert") {
    ballotIntervention(6);
  } else {
    completeIntervention();
  }
}

/**
 * Conduct one of the two notice interventions. The participant's default search engine will be changed
 * and they will be presented a notice notifying them of the change
 * @param {number} noticeType - Specifies the notice style that will be shown to the participant
 * Should be either 2 or 3.
 */
async function noticeIntervention(noticeType: number) {
  // Determine the participant's default search engine
  const originalEngine = await Utils.getSearchEngine();

  // Creates a list of options for a new default search engine (excluding the original default)
  let newSearchEngineOptions = ["Google", "DuckDuckGo", "Yahoo", "Bing"]
  newSearchEngineOptions = newSearchEngineOptions.filter(engineOption => {
    return !originalEngine.toLowerCase().includes(engineOption.toLowerCase())
  })

  // Change the participant's default engine to a random selection from the list of options for a new default
  const newEngine = newSearchEngineOptions[Math.floor(Math.random() * newSearchEngineOptions.length)];
  Utils.changeSearchEngine(newEngine);

  // Register a listener that will send a response to the notice page with details of the original engine and new engine
  // This allows the notice to notify the participant of their original engine and their new engine
  webScience.messaging.onMessage.addListener((_message, _sender, sendResponse) => {
    sendResponse({ previous: originalEngine, current: newEngine })
  }, {
    type: "SearchEngineNotice",
    schema: {}
  });

  storage.set("NoticeNewEngine", newEngine)

  // Register a listener that will be sent a message when the notice page unloads
  webScience.messaging.onMessage.addListener((message) => {
    // If the participant clicked on the button to revert the change, we restore their original default search engine
    if (message.revert) {
      Utils.revertSearchEngine();
    }

    storage.set("NoticeInterventionData", {
      Revert: message.revert,
      AttentionTime: message.attentionTime
    })

    // At this point, the intervention is complete
    completeIntervention();
  }, {
    type: "NoticeResponse",
    schema: {
      attentionTime: "number",
      revert: "boolean"
    }
  });

  // Creates a browser tab displaying the notice to the participant
  browser.tabs.create({ url: `/pages/notice_${noticeType}.html` });

  completeInterventionOnExtensionRestart();
}


/**
 * Conduct one of the four ballot interventions. A search engine ballot will be displayed to the participant
 * and their default search engine will be changed to their selection
 * @param {boolean} ballotDesign - Specifies the ballot style that will be shown to the participant.
 * Should be either 4, 5, 6, or 7. 
 */
function ballotIntervention(ballotDesign: number) {
  storage.get("BallotAttempts").then(ballotAttempts => {
    const newBallotAttempts = ballotAttempts ? ballotAttempts + 1 : 1
    storage.set("BallotAttempts", newBallotAttempts)

    if (newBallotAttempts >= 3) {
      completeInterventionOnExtensionRestart();
    }
  })


  webScience.messaging.onMessage.addListener((message) => {
    // Modify the participant's default search engine to their ballot response and mark the intervention as complete
    Utils.changeSearchEngine(message.engine);

    storage.set("BallotInterventionData", {
      SelectedEngine: message.engine,
      AttentionTime: message.attentionTime,
      SeeMoreSelected: message.see_more_clicked,
      Ordering: message.engines_ordering,
      DetailsExpanded: message.details_expanded
    })

    // At this point, the intervention is complete
    completeIntervention();
  }, {
    type: "SearchBallotResponse",
    schema: {
      engine: "string",
      attentionTime: "number",
      see_more_clicked: "boolean",
      engines_ordering: "object",
      details_expanded: "object",
    }
  });

  // Creates a browser tab displaying the search engine ballot to the participant
  browser.tabs.create({ url: `/pages/search_ballot_${ballotDesign}.html` });
}

/**
 * Called when an intervention is complete. Sets the value of InterventionComplete to true
 * in storage and starts the regular data collection stage of the study.
 */
function completeIntervention() {
  storage.set("InterventionComplete", true);
  RegularCollection.startDataCollection(storage);
}

/**
 * Called when an intervention will be complete upon the next restart of the extension. Sets
 * the value of InterventionComplete to true so that regular data collection will start upon
 * restart of the extension.
 */
function completeInterventionOnExtensionRestart() {
  storage.set("InterventionComplete", true);
}