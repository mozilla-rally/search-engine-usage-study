// Import the WebExtensions polyfill, for cross-browser compatibility.
// Note that Rally and WebScience currently only support Firefox.
import { Rally, runStates } from "@mozilla/rally";
import { startStudy } from "./StudyModule.js";

import * as webScience from "@mozilla/web-science";

import Glean from "@mozilla/glean/webext";
import PingEncryptionPlugin from "@mozilla/glean/plugins/encryption";
import { Uploader, UploadResult, UploadResultStatus } from "@mozilla/glean/uploader";

import * as rallyManagementMetrics from "../src/generated/rally";
import * as searchUsagePings from "../src/generated/pings";

const publicKey = {
    "kty": "EC",
    "crv": "P-256",
    "x": "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
    "y": "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0",
    "kid": "Public key used in JWS spec Appendix A.3 example"
};

async function stateChangeCallback(newState: string) {
    if (newState === "resume") {
        console.log("The study can run.");
        // The all-0 Rally ID indicates developer mode, in case data is accidentally sent.
        let rallyId = __ENABLE_DEVELOPER_MODE__ ? "00000000-0000-0000-0000-000000000000" : rally._rallyId;

        // The all-1 Rally ID means that there was an error with the Rally ID.
        if (!rallyId) {
            rallyId = "11111111-1111-1111-1111-111111111111";
        }
        console.info(`Study running with Rally ID: ${rallyId}`);

        const storage = await browser.storage.local.get("enrolled");
        if (storage.enrolled !== true) {
            console.info("Recording enrollment.");
            rallyManagementMetrics.id.set(rallyId);
            searchUsagePings.studyEnrollment.submit();

            browser.storage.local.set({
                enrolled: true,
            });
        }
        // Initialize the study and start it.
        startStudy(rally);
        await browser.storage.local.set({ "state": runStates.RUNNING });
    } else {
        console.log("The study must stop.");
        await browser.storage.local.set({ "state": runStates.PAUSED });
    }
}

// TODO move to dynamic import, and only load in dev mode.
import pako from "pako";

class GetPingsUploader extends Uploader {
    async post(url: string, body: string | Uint8Array): Promise<UploadResult> {
        const ping = new TextDecoder().decode(pako.inflate(body));

        console.debug("Dev mode, storing glean ping instead of sending:", ping, url);

        const urlSplit = url.split("/");

        // Use a random suffix, so each ping is stored under its own local storage key.
        const key = `${urlSplit[urlSplit.length - 3]}-ping_${webScience.id.generateId()}`;
        await browser.storage.local.set({ [key]: ping });

        // Tell Glean upload went fine. Glean will then clear the ping from storage.
        return {
            status: 200,
            result: UploadResultStatus.Success
        };
    }
}

if (__ENABLE_DEVELOPER_MODE__) {
    Glean.initialize("my-app-id", true, {
        debug: { logPings: true },
        httpClient: new GetPingsUploader(),
    });
} else {
    Glean.initialize("my-app-id", true, {
        plugins: [
            new PingEncryptionPlugin(publicKey)
        ],
    });
}

// Initialize the Rally API.
const rally = new Rally();
rally.initialize(
    // A sample key id used for encrypting data.
    "sample-invalid-key-id",
    // A sample *valid* JWK object for the encryption.
    publicKey,
    // The following constant is automatically provided by
    // the build system.
    __ENABLE_DEVELOPER_MODE__,
    stateChangeCallback,
).then(_resolve => {
    // The Rally API has been initialized.
    // When in developer mode, open the options page with the playtest controls.
    if (__ENABLE_DEVELOPER_MODE__) {
        browser.runtime.onMessage.addListener((message, sender) => {
            console.debug(message, sender);
            if (!("type" in message && message.type.startsWith("rally-sdk") && sender.id === browser.runtime.id)) {
                // Only listen for messages from the rally-sdk.
                return;
            }
            if (["resume", "pause"].includes(message.data.state)) {
                stateChangeCallback(message.data.state)
            } else {
                throw new Error(`Unknown state: ${message.data.state}`);
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
