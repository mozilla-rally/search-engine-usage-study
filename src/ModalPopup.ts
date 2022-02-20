/**
 * This module provides functionality for conducting the modal popup stage of modal popup treatment.
 * 
 * @module ModalPopup
 */
import * as Privileged from "./Privileged.js"
import * as webScience from "@mozilla/web-science";
import * as modalInteractionMetrics from "../src/generated/modalInteraction";
import * as studyPings from "../src/generated/pings";

/**
 * A persistent key-value storage object for the study
 * @type {Object}
 */
let storage;

/**
 * The name of the engine that was the participant's default prior to their choice ballot selection.
 * @type {string}
 */
let oldEngine;

/**
 * The name of the engine that the participant selected on the choice ballot and had their default changed to.
 * @type {string}
 */
let newEngine;

/**
 * Whether the revert button on the modal dialog will be the primary button.
 * @type {boolean}
 */
let modalPrimaryRevert;

/**
 * Callback for browser.webNavigation.onCommitted that displays a modal dialog upon
 * generated search with the engine that was chosen on the choice ballot.
 * @param {Object} details - Details about the navigation event.
 * @async
 **/
async function webNavigationOnCommittedListener(details) {
    // The modal dialog should be displayed on a generated search if the current engine is the same
    // as the engine that the participant selected on the choice ballot.
    const currentEngine = await Privileged.getSearchEngine();
    if (details.transitionType === "generated" && currentEngine === newEngine) {
        // Remove this listener, the modal dialog should only be displayed one time.
        browser.webNavigation.onCommitted.removeListener(webNavigationOnCommittedListener);

        // Set the completion status of the modal treatment to true so that it won't be shown again.
        storage.set("ModalTreatmentCompleted", true);

        const treatmentStartTime = webScience.timing.now();

        modalInteractionMetrics.treatmentTime.set();

        // Display the modal dialog and get the participant's selection.
        const revertChosen = await browser.experimental.createPopup(oldEngine, newEngine, modalPrimaryRevert);

        // If the participant chooses to revert, then change their search engine back to the engine it was changed
        // from in the choice ballot treatment stage.
        if (revertChosen) {
            Privileged.changeSearchEngine(oldEngine);
        }

        modalInteractionMetrics.pingTime.set();
        modalInteractionMetrics.revertSelected.set(revertChosen);
        studyPings.modalInteraction.submit();


        // Report modal treatment data.
        const modalTreatmentData = {
            RevertSelected: revertChosen,
            TreatmentTime: treatmentStartTime,
            PingTime: webScience.timing.now(),
        };
        console.log(modalTreatmentData);
    }
}

/**
 * Initialize modal dialog functionality
 * @param {Object} storageArg - A persistent key-value storage object for the study
 * @async
 **/
export async function initializeModalPopup(conditionType, storageArg) {
    storage = storageArg;

    const modalTreatmentCompleted = await storage.get("ModalTreatmentCompleted");
    oldEngine = await storage.get("OldEngine");
    newEngine = await storage.get("NewEngine");
    modalPrimaryRevert = conditionType === "ModalPrimaryRevert";

    // Modal functionality should only run if:
    //  1. This treatment has not already been completed.
    //  2. The participant's treatment condition is one of the two modal treatment conditions.
    //  3. The choice ballot stage of the modal treatment was completed successfully (oldEngine
    //     and newEngine will only be set if the participant selected an option on the choice ballot).
    //  4. The engine that the participant chose on the choice ballot is different from their
    //     their original engine. It does not make sense to popup the modal dialog if the participant's
    //     default was originally Google and they proceeded to select Google on the choice ballot.
    if (!modalTreatmentCompleted &&
        (conditionType === "ModalPrimaryRevert" || conditionType === "ModalSecondaryRevert") &&
        oldEngine && newEngine &&
        !newEngine.toLowerCase().includes(oldEngine.toLowerCase()) &&
        !oldEngine.toLowerCase().includes(newEngine.toLowerCase())) {
        browser.webNavigation.onCommitted.addListener(webNavigationOnCommittedListener);
    }
}