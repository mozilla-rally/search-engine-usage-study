import { initializeAttentionTracking, getAttentionDuration, getDwellTime } from "./pageScriptCommon.js";

/**
 * Description for each of the search engines that the participant's default can be changed to
 * as part of the notice intervention.
 * @type {Object}
 */
const engineDetails = {
    DuckDuckGo: {
        displayName: "DuckDuckGo",
        description: "DuckDuckGo doesn't store your personal information. Ever."
    },
    Google: {
        displayName: "Google",
        description: "Google is the world's most used search engine."
    },
    Bing: {
        displayName: "Bing",
        description: "Microsoft Bing helps you find trusted search results fast."
    },
    Yahoo: {
        displayName: "Yahoo!",
        description: "Yahoo! Search helps you find the information you need."
    }
};

window.addEventListener("DOMContentLoaded", async function () {
    initializeAttentionTracking();

    /**
     * Whether the revert button was selected.
     * @type {boolean}
     */
    let revert = false;

    // Add a click listener to the revert button if it exists that sets revert to true
    // and closes the window.
    const revertButton = document.getElementById("revert");
    if (revertButton) {
        revertButton.addEventListener("click", () => {
            revert = true;
            window.close();
        });
    }

    const closeButton = document.getElementById("close");
    if (closeButton) {
        closeButton.addEventListener("click", () => {
            window.close();
        });
    }

    // Send a message to the background page to get information about the notice page.
    const noticeDetails = await browser.runtime.sendMessage({ type: "NoticeDetails" });
    if (noticeDetails && noticeDetails.newEngine) {
        // Display what the participant's engine was changed to.
        document.getElementById("engineChange").textContent = `to ${engineDetails[noticeDetails.newEngine].displayName}`;

        if (noticeDetails.newEngine in engineDetails) {
            // Display the image and description for the engine that the participant's default was changed to.
            document.getElementById('engine-info').classList.remove("hiding");
            document.getElementById("engine-description").textContent = engineDetails[noticeDetails.newEngine].description;
            const logo = document.getElementById("notice-logo") as HTMLImageElement;
            logo.src = `assets/logos/${noticeDetails.newEngine}.png`;
            logo.alt = `${noticeDetails.newEngine} logo`;
        }
    }

    // If the homepage was changed:
    //   1. Change "You can also choose to revert this change now."
    //      to "You can also choose to revert these changes now."
    //   2. Display the element notifying the participant that their homepage was changed.
    if (noticeDetails && noticeDetails.homepageChange) {
        const revertDescription = document.getElementById("revertPlural");
        if (revertDescription) revertDescription.textContent = "these changes"

        const homepageChangeNotification = document.getElementById("homepageChangeDescription");
        if (homepageChangeNotification) homepageChangeNotification.classList.remove("hiding");

        const noHomepageChangeNotification = document.getElementById("noHomepageChangeDescription");
        if (noHomepageChangeNotification) noHomepageChangeNotification.classList.add("hiding");
    }

    // Send the NoticeResponse message to the background upon unload.
    window.addEventListener("unload", (event) => {
        browser.runtime.sendMessage({
            type: "NoticeResponse",
            revert: revert,
            attentionDuration: getAttentionDuration(),
            dwellTime: getDwellTime(event.timeStamp),
        });
    });
});
