import { initializeAttentionTracking, getAttentionDuration, getDwellTime } from "./pageScriptCommon.js";

// Randomly shuffles the input array in place.
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

window.addEventListener("DOMContentLoaded", async function () {
    initializeAttentionTracking();

    /**
     * Whether the "See More Engines" button was selected.
     * @type {boolean}
     */
    let seeMoreClicked = false;

    /**
     * The set of search engine names that have had their details expanded
     * (only relevant for ChoiceBallotHidden group).
     * @type {Set<string>}
     */
    const detailsExpandedSet = new Set();

    // Send a message to the background page to get information about the choice ballot page.
    const choiceBallotDetails = await browser.runtime.sendMessage({ type: "ChoiceBallotDetails" });

    // If the homepage was changed, display the element notifying the participant that their homepage was changed.
    if (choiceBallotDetails && choiceBallotDetails.homepageChange) {
        const homepageChangeNotification = document.getElementById("homepageChangeDescription");
        if (homepageChangeNotification) {
            homepageChangeNotification.classList.remove("hiding");
        }
        const noHomepageChangeNotification = document.getElementById("noHomepageChangeDescription");
        if (noHomepageChangeNotification) {
            noHomepageChangeNotification.classList.add("hiding");
        }
    }

    // List of the names of each search engine
    const engineNames = [];

    // Object mapping each engine name to the container element of that engine.
    const engineNameToElementDict = {};

    // Fill the engineNames array and engineNameToElementDict object
    const engineContainers = document.querySelectorAll(".engine-container");
    for (const engineContainer of engineContainers) {
        engineNames.push(engineContainer.id);
        engineNameToElementDict[engineContainer.id] = engineContainer;
    }

    // Get a randomized ordering that the engines will be displayed in.
    let enginesOrdering = []
    if (choiceBallotDetails && choiceBallotDetails.enginesOrdering) {
        // If the background provided an ordering, use that ordering.
        enginesOrdering = choiceBallotDetails.enginesOrdering;
    } else {
        // Otherwise, create a randomized ordering and send this ordering to the background for storage
        // so that if a choice ballot is loaded again, it can use the same ordering.
        shuffleArray(engineNames)
        enginesOrdering = engineNames;
        browser.runtime.sendMessage({ type: "ChoiceBallotEngineOrdering", enginesOrdering });
    }

    // Create an array of the elements for each of the search engines
    // in the randomized order.
    const randomizedOrderEngineElements = [];
    for (const engine of enginesOrdering) {
        if (engine in engineNameToElementDict) {
            randomizedOrderEngineElements.push(engineNameToElementDict[engine]);
        }
    }

    // Empty the search engines wrapper container and fill it with the first four of the
    // randomly ordered engines.
    const searchEnginesContainer = document.querySelector(".search-engines-wrapper");
    searchEnginesContainer.innerHTML = "";
    const initialEngineContainers = randomizedOrderEngineElements.slice(0, 4);
    for (const engine of initialEngineContainers) {
        searchEnginesContainer.append(engine);
    }

    // Fill the search-engines-more-wrapper container (that is initially hidden until the participant
    // clicks the 'See More Engines' button) with the next four engines.
    const moreEngineContainers = randomizedOrderEngineElements.slice(4);
    const moreSearchEnginesContainer = document.querySelector(".search-engines-more-wrapper");
    if (moreEngineContainers.length && moreSearchEnginesContainer) {
        for (const engine of moreEngineContainers) {
            moreSearchEnginesContainer.append(engine);
        }
    }

    // Enable the participant to continue. Should be called if a search engine option is selected.
    function enableContinue() {
        document.querySelector(".continue").removeAttribute("disabled");
    }

    // If a radio button is checked, then we enable the continue.
    // We do this check because if a participant selects an option and then reloads
    // the page, the option may be selected after the reload so we want to ensure that
    // the continue button is enabled in such a case.
    if (document.querySelector("input[name=engine-select]:checked")) {
        enableContinue();
    }

    // Add a click listener to the radio buttons that will enable the continue if any is selected.
    const radioInputButtons = document.querySelectorAll("input");
    for (const radioInputButton of radioInputButtons) {
        radioInputButton.addEventListener("click", () => {
            enableContinue();
        });
    }

    // Add a click listener to each of the chevron dropdown buttons.
    const chevronRotateButtons = document.querySelectorAll(".rotate");
    for (const chevronRotateButton of chevronRotateButtons) {
        chevronRotateButton.addEventListener("click", (event) => {
            // Toggle whether the chevron button is up/down.
            const targetElement = event.currentTarget as HTMLElement;
            targetElement.classList.toggle("down");

            // Toggle whether the description for the respective engine is showing/hiding.
            const textBox = targetElement.closest(".engine-container").querySelector("p");
            textBox.classList.toggle("hiding");

            // Record that the details were expanded for the respective engine.
            detailsExpandedSet.add(targetElement.closest(".engine-container").id);

        });
    }

    // If there is a 'See More Engines' button, add a click listener to it.
    const seeMoreButton = document.querySelector(".see-more");
    if (seeMoreButton) {
        seeMoreButton.addEventListener("click", () => {
            // Record that the 'See More Engines' button was clicked.
            seeMoreClicked = true;

            // Show the four hidden search engines.
            document.querySelector(".search-engines-more-wrapper").classList.remove("hiding");

            // Hide the button.
            document.querySelector(".see-more-container").classList.add("hiding");
        });
    }

    // Whether the ballot is completed.
    let ballotCompleted = false;

    // Add a click listener to the continue button that sends the ChoiceBallotResponse
    // message to the background page and closes the window.
    document.querySelector(".continue").addEventListener("click", () => {
        ballotCompleted = true;
        window.close();
    });

    window.addEventListener("unload", (event) => {
        const checkedRadio = document.querySelector("input[name=engine-select]:checked") as HTMLInputElement
        const selectedEngine = checkedRadio ? checkedRadio.value : "";
        browser.runtime.sendMessage({
            type: "ChoiceBallotData",
            engine: selectedEngine,
            attentionDuration: getAttentionDuration(),
            dwellTime: getDwellTime(event.timeStamp),
            detailsExpanded: Array.from(detailsExpandedSet),
            seeMoreClicked,
            enginesOrdering,
            ballotCompleted,
        });
    });
});
