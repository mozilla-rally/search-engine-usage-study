import * as Utils from "./Utils.js"

let storage;

let engineChangedFrom;
let engineChangedTo;
let modalPrimaryRevert;

async function listener(details) {
    if (details.transitionType === "generated") {
        let currentEngine = await Utils.getSearchEngine();
        if (currentEngine === engineChangedTo) {
            const modalAttemptsFromStorage = await storage.get("ModalAttempts");
            let modalAttempts = modalAttemptsFromStorage ? modalAttemptsFromStorage + 1 : 1;
            storage.set("ModalAttempts", modalAttempts);

            browser.webNavigation.onCommitted.removeListener(listener);
            let choice = await browser.experimental.createPopup(engineChangedFrom, engineChangedTo, modalPrimaryRevert);

            console.log(`MODAL CHOICE: ${choice}`)
            if (choice) {
                Utils.changeSearchEngine(engineChangedFrom);
            }
            storage.set("ModalInterventionCompleted", true);

            const modalInterventionData = {
                modalAttempts: modalAttempts,
                revert: choice
            }
            console.log(modalInterventionData)
        }
    }
}

export async function startModalIntervention(storage_in) {
    storage = storage_in;
    let interventionType = await storage.get("InterventionType");
    console.log(`Module output intervention type: ${interventionType}`)
    if (interventionType === "ModalPrimaryRevert" || interventionType === "ModalSecondaryRevert") {
        let modalInterventionCompleted = await storage.get("ModalInterventionCompleted")
        engineChangedFrom = await storage.get("EngineChangedFrom");
        engineChangedTo = await storage.get("EngineChangedTo");
        modalPrimaryRevert = interventionType === "ModalPrimaryRevert";

        console.log(`Module output modalInterventionCompleted: ${modalInterventionCompleted}`)
        console.log(`Module output engineChangedFrom: ${engineChangedFrom}`)
        console.log(`Module output engineChangedTo: ${engineChangedTo}`)
        if (!modalInterventionCompleted && engineChangedFrom && engineChangedTo) {
            if (!engineChangedTo.toLowerCase().includes(engineChangedFrom.toLowerCase()) &&
                !engineChangedFrom.toLowerCase().includes(engineChangedTo.toLowerCase())) {
                browser.webNavigation.onCommitted.addListener(listener);
            }
        }
    }
}