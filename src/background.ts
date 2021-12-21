// Import the WebExtensions polyfill, for cross-browser compatibility.
// Note that Rally and WebScience currently only support Firefox.
import { Rally, runStates } from "@mozilla/rally";
import { startStudy } from "./StudyModule.js";

async function stateChangeCallback(newState: string) {
    console.debug("newState", newState);
    if (newState === "resume") {
        console.log("The study can run.");
        // Initialize the study and start it.
        startStudy(rally);
        await browser.storage.local.set({ "state": runStates.RUNNING });
    } else {
        console.log("The study must stop.");
        await browser.storage.local.set({ "state": runStates.PAUSED });
    }
}

// Initialize the Rally API.
const rally = new Rally();
rally.initialize(
    // A sample key id used for encrypting data.
    "sample-invalid-key-id",
    // A sample *valid* JWK object for the encryption.
    {
        "kty": "EC",
        "crv": "P-256",
        "x": "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
        "y": "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0",
        "kid": "Public key used in JWS spec Appendix A.3 example"
    },
    // The following constant is automatically provided by
    // the build system.
    __ENABLE_DEVELOPER_MODE__,
    stateChangeCallback,
).then(_resolve => {
    // The Rally API has been initialized.
    // When in developer mode, open the options page with the playtest controls.
    if (__ENABLE_DEVELOPER_MODE__) {
        browser.runtime.onMessage.addListener((m, s) => {
            console.debug(m, s);
            if (!("type" in m && m.type.startsWith("rally-sdk"))) {
                // Only listen for messages from the rally-sdk.
                return;
            }
            if (m.data.state === "resume") {
                stateChangeCallback("resume")
            } else if (m.data.state === "pause") {
                stateChangeCallback("pause")
            } else {
                throw new Error(`Unknown state: ${m.data.state}`);
            }
        });

        browser.storage.local.set({ "state": runStates.PAUSED }).then(() =>
            browser.storage.local.set({ "initialized": true }).then(() =>
                browser.runtime.openOptionsPage()
            )
        );
    }
}, _reject => {
    // Do not start the study in this case. Something
    // went wrong.
});