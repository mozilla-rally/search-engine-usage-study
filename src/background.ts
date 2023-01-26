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
    "crv": "P-256",
    "kid": "rally-citp-search-engine-usage",
    "kty": "EC",
    "x": "GT9k6e_o9Mmg8rzpODDHubvW9vnn2YX-6jvs7XiyLxc",
    "y": "shZ66v0JgXOH5U3yJ4B07Hqooi12KD9nSe9466o5vLY"
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
        startStudy();
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
    Glean.initialize("rally-citp-search-engine-usage", true, {
        debug: { logPings: true },
        httpClient: new GetPingsUploader(),
    });
} else {
    Glean.initialize("rally-citp-search-engine-usage", true, {
        plugins: [
            new PingEncryptionPlugin(publicKey)
        ],
    });
}

// Initialize the Rally API.
const rally = new Rally();
rally.initialize(
    // The schemaNamespace for this study.
    "rally-citp-search-engine-usage",
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
    } else {
        stateChangeCallback("resume").then(() => console.debug("Data collection start"));
    }
}).catch(err => {
    // Do not start the study in this case. Something
    // went wrong.
    console.error(err);
});

browser.runtime.onInstalled.addListener(() => {
    console.log(
        "Search engine study has been decommissioned. Uninstalling self..."
    );
    browser.management.uninstallSelf();
});
