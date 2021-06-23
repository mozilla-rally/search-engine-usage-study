/**
 * This module provides functionality for conducting the second stage of modal interventions.
 * The first stage of the modal intervention is the choice screen shown to the user and is handled
 * in the Intervention module. The second stage is the modal dialog that is displayed upon a search
 * with the newly selected engine from the choice screen.
 */

import * as Privileged from "./Privileged.js"
import * as webScience from "@mozilla/web-science";

/**
 * @type {Object}
 * A persistent key-value storage object for the study
 */
let storage;

/**
 * @type {string}
 * The name of the engine that was the participant's default prior to their choice screen selection.
 */
let engineChangedFrom;

/**
 * @type {string}
 * The name of the engine that the participant selected on the choice screen and had their default changed to.
 */
let engineChangedTo;

/**
 * @type {boolean}
 * Whether the revert button on the modal dialog will be the primary button.
 */
let modalPrimaryRevert;

/**
 * Callback for browser.webNavigation.onCommitted that displays a modal dialog upon
 * generated search with the engine that was chosen on the choice screen.
 * @async
 * @param {Object} details - Details about the navigation event.
 **/
async function listener(details) {
    // The modal dialog should be displayed on a generated search if the current engine is the same
    // as the engine that the participant selected on the choice screen.
    const currentEngine = await Privileged.getSearchEngine();
    if (details.transitionType === "generated" && currentEngine === engineChangedTo) {
        // Gets the number of times the modal dialog has been displayed
        const modalAttemptsCounter = await webScience.storage.createCounter("ModalAttempts");
        const modalAttempts = await modalAttemptsCounter.incrementAndGet();

        // Remove this listener, the modal dialog should only be displayed a maximum of one time per
        // browser session.
        browser.webNavigation.onCommitted.removeListener(listener);

        // Display the modal dialog and get the participant's selection.
        const revertChosen = await browser.experimental.createPopup(engineChangedFrom, engineChangedTo, modalPrimaryRevert);

        // If the participant chooses to revert, then change their search engine back to the engine that the choice screen
        // stage of the intervention changed it from.
        if (revertChosen) {
            Privileged.changeSearchEngine(engineChangedFrom);
        }

        // Set the completion status of the modal intervention to true.
        storage.set("ModalInterventionCompleted", true);

        // Report modal intervention data.
        const modalInterventionData = {
            modalAttempts: modalAttempts,
            revert: revertChosen
        };
        console.log(modalInterventionData)
    }
}

/**
 * Start modal dialog functionality
 * @async
 * @param {Object} storage - A persistent key-value storage object for the study
 **/
export async function start(storage_in) {
    storage = storage_in;

    const modalInterventionCompleted = await storage.get("ModalInterventionCompleted");
    const interventionType = await storage.get("InterventionType");
    engineChangedFrom = await storage.get("EngineChangedFrom");
    engineChangedTo = await storage.get("EngineChangedTo");
    modalPrimaryRevert = interventionType === "ModalPrimaryRevert";

    // Modal functionality should only run if:
    //  1. This intervention has not already been completed.
    //  2. The participant's intervention group is one of the two modal intervention groups
    //  3. The choice screen stage of the modal intervention was completed successfully (engineChangedFrom
    //     and engineChangedTo will only be set if the participant selected an option on the choice screen).
    //  4. The engine that the participant chose on the choice screen is different from their
    //     their original engine. It does not make sense to popup the modal dialog if the participant's
    //     default was originally Google and they proceeded to select Google on the choice screen.
    if (!modalInterventionCompleted &&
        (interventionType === "ModalPrimaryRevert" || interventionType === "ModalSecondaryRevert")) {
        if (engineChangedFrom && engineChangedTo) {
            if (!engineChangedTo.toLowerCase().includes(engineChangedFrom.toLowerCase()) &&
                !engineChangedFrom.toLowerCase().includes(engineChangedTo.toLowerCase())) {
                browser.webNavigation.onCommitted.addListener(listener);
            }
        }
    }
}