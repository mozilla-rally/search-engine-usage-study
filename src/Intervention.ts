import * as webScience from "@mozilla/web-science";
import * as StudyModule from "./StudyModule.js"
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

async function shouldHomepageChange() {
  const homepage = await Utils.getHomepage();
  const homepageLowercase = homepage.toLowerCase()

  const enginesLowercase = ["google", "bing", "yahoo", "duckduckgo", "ecosia", "ask", "baidu", "yandex"]

  if (enginesLowercase.some(engineLowercase => homepageLowercase.includes(engineLowercase))) {
    return true;
  }
  return false;
}

async function changeEngineAndHomepage(newEngine) {
  Utils.changeSearchEngine(newEngine);

  // If the current home page is a search engine page, change it to the default Firefox homepage
  if (await shouldHomepageChange()) {
    Utils.changeHomepage("about:home")
    return true;
  }
  return false;
}

/**
 * Conduct one of the two notice interventions. The participant's default search engine will be changed
 * and they will be presented a notice notifying them of the change
 * @param {number} noticeType - Specifies the notice style that will be shown to the participant
 * Should be either 2 or 3.
 */
async function noticeIntervention(noticeType: number) {
  let noticeShown = await storage.get("NoticeShown");
  if (noticeShown) {
    completeIntervention();
    return;
  }

  // Determine the participant's original search engine and homepage
  const originalEngine = await Utils.getSearchEngine();
  const originalHomepage = await Utils.getHomepage();

  // Creates a list of options for a new default search engine (excluding the original default)
  let newSearchEngineOptions = ["Google", "DuckDuckGo", "Yahoo", "Bing"]
  newSearchEngineOptions = newSearchEngineOptions.filter(engineOption => {
    return !originalEngine.toLowerCase().includes(engineOption.toLowerCase())
  })

  // Change the participant's default engine to a random selection from the list of options for a new default
  const newEngine = newSearchEngineOptions[Math.floor(Math.random() * newSearchEngineOptions.length)];
  const homepageChange = await changeEngineAndHomepage(newEngine);

  storage.set("EngineChangedFrom", originalEngine);
  storage.set("EngineChangedTo", newEngine);

  // Register a listener that will send a response to the notice page with details of the original engine and new engine
  // This allows the notice to notify the participant of their original engine and their new engine
  webScience.messaging.onMessage.addListener((_message, _sender, sendResponse) => {
    sendResponse({ originalEngine, newEngine, homepageChange })
  }, {
    type: "NoticeDetails",
    schema: {}
  });

  // Register a listener that will be sent a message when the notice page unloads
  webScience.messaging.onMessage.addListener((message) => {
    // If the participant clicked on the button to revert the change, we restore their original default search engine and homepage
    if (message.revert) {
      Utils.changeHomepage(originalHomepage);
      Utils.changeSearchEngine(originalEngine);
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

  storage.set("NoticeShown", true)
}


/**
 * Conduct one of the four ballot interventions. A search engine ballot will be displayed to the participant
 * and their default search engine will be changed to their selection
 * @param {boolean} ballotDesign - Specifies the ballot style that will be shown to the participant.
 * Should be either 4, 5, 6, or 7. 
 */
async function ballotIntervention(ballotDesign: number) {
  let ballotAttemptsFromStorage = await storage.get("BallotAttempts");

  if (ballotAttemptsFromStorage >= 3) {
    completeIntervention();
    return;
  }

  const homepageChange = await shouldHomepageChange();
  const engines_ordering = await storage.get("BallotEngineOrdering");

  webScience.messaging.onMessage.addListener((_message, _sender, sendResponse) => {
    sendResponse({ homepageChange, engines_ordering })
  }, {
    type: "BallotDetails",
    schema: {}
  });

  webScience.messaging.onMessage.addListener(message => {
    console.log(message)
    storage.set("BallotEngineOrdering", message.engines_ordering);
  }, {
    type: "BallotEngineOrdering",
    schema: {
      engines_ordering: "object"
    }
  });

  webScience.messaging.onMessage.addListener(async (message) => {
    storage.set("EngineChangedFrom", await Utils.getSearchEngine());
    storage.set("EngineChangedTo", message.engine);

    // Modify the participant's default search engine to their ballot response and mark the intervention as complete
    changeEngineAndHomepage(message.engine);

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
    type: "BallotResponse",
    schema: {
      engine: "string",
      attentionTime: "number",
      see_more_clicked: "boolean",
      engines_ordering: "object",
      details_expanded: "object",
    }
  });

  // Creates a browser tab displaying the search engine ballot to the participant
  browser.tabs.create({ url: `/pages/ballot_${ballotDesign}.html` });

  const ballotAttempts = ballotAttemptsFromStorage ? ballotAttemptsFromStorage + 1 : 1
  storage.set("BallotAttempts", ballotAttempts)
}

/**
 * Called when an intervention is complete. Sets the value of InterventionComplete to true
 * in storage and starts the regular data collection stage of the study.
 */
function completeIntervention() {
  storage.set("InterventionComplete", true);
  StudyModule.postInterventionFunctionality();
}