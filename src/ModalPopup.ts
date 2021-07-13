/**
 * This module provides functionality for conducting the modal popup stage of modal interventions.
 * 
 * @module Modal
 */

import * as Privileged from "./Privileged.js"
import * as webScience from "@mozilla/web-science";

/**
 * A persistent key-value storage object for the study
 * @type {Object}
 */
let storage;

/**
 * The name of the engine that was the participant's default prior to their choice ballot selection.
 * @type {string}
 */
let engineChangedFrom;

/**
 * The name of the engine that the participant selected on the choice ballot and had their default changed to.
 * @type {string}
 */
let engineChangedTo;

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
    if (details.transitionType === "generated" && currentEngine === engineChangedTo) {
        // Gets the number of times the modal dialog has been displayed
        const modalAttemptsCounter = await webScience.storage.createCounter("ModalAttempts");
        const modalAttempts = await modalAttemptsCounter.incrementAndGet();

        // Remove this listener, the modal dialog should only be displayed a maximum of one time per
        // browser session.
        browser.webNavigation.onCommitted.removeListener(webNavigationOnCommittedListener);

        // Display the modal dialog and get the participant's selection.
        const revertChosen = await browser.experimental.createPopup(engineChangedFrom, engineChangedTo, modalPrimaryRevert);

        // If the participant chooses to revert, then change their search engine back to the engine that the choice ballot
        // stage of the intervention changed it from.
        if (revertChosen) {
            Privileged.changeSearchEngine(engineChangedFrom);
        }

        // Set the completion status of the modal intervention to true.
        storage.set("ModalInterventionCompleted", true);

        // Report modal intervention data.
        const modalInterventionData = {
            ModalAttempts: modalAttempts,
            Revert: revertChosen
        };

        console.log(modalInterventionData);
    }
}

/**
 * Initialize modal dialog functionality
 * @param {Object} storageArg - A persistent key-value storage object for the study
 * @async
 **/
export async function initializeModalIntervention(interventionType, storageArg) {
    storage = storageArg;

    const modalInterventionCompleted = await storage.get("ModalInterventionCompleted");
    engineChangedFrom = await storage.get("EngineChangedFrom");
    engineChangedTo = await storage.get("EngineChangedTo");
    modalPrimaryRevert = interventionType === "ModalPrimaryRevert";

    // Modal functionality should only run if:
    //  1. This intervention has not already been completed.
    //  2. The participant's intervention group is one of the two modal intervention groups
    //  3. The choice ballot stage of the modal intervention was completed successfully (engineChangedFrom
    //     and engineChangedTo will only be set if the participant selected an option on the choice ballot).
    //  4. The engine that the participant chose on the choice ballot is different from their
    //     their original engine. It does not make sense to popup the modal dialog if the participant's
    //     default was originally Google and they proceeded to select Google on the choice ballot.
    if (!modalInterventionCompleted &&
        (interventionType === "ModalPrimaryRevert" || interventionType === "ModalSecondaryRevert") &&
        engineChangedFrom && engineChangedTo &&
        !engineChangedTo.toLowerCase().includes(engineChangedFrom.toLowerCase()) &&
        !engineChangedFrom.toLowerCase().includes(engineChangedTo.toLowerCase())) {
        browser.webNavigation.onCommitted.addListener(webNavigationOnCommittedListener);
    }
}