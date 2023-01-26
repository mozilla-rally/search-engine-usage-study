import * as webScience from "@mozilla/web-science";


/**
 * Link to lambda function that returns whether the posted survey ID is a lottery winner and, if so,
 * the Amazon gift code and whether the participant has indicated that they have redeemed the code.
 */
const fetchLambdaUrl = "https://bmq4h2slkvngosxcy7vevdy7xm0yxfyg.lambda-url.us-east-1.on.aws/";

/**
 * Link to lambda function to post an update to when the participant has indicated that they have redeemed
 * their Amazon gift code.
 */
const updateLambdaUrl = "https://4n2pucnmrh76jw3mmb27q6bvaq0wytaz.lambda-url.us-east-1.on.aws/";

/**
 * Call API
 * @param {string} action - Which action to execute ("fetch" or "update")
 */
async function callAPI(action) {
    let url;
    if (action == "fetch") {
        url = fetchLambdaUrl;
    } else if (action == "update") {
        url = updateLambdaUrl;
    }

    try {
        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify({ "surveyId": await webScience.userSurvey.getSurveyId() })
        });

        if (!response.ok) { // there was an error
            const message = "An error has occured: " + response.status;
            console.error(message)
            return null;
        }


        if (action == "fetch") {
            const results = await response.json(); // fetch JSON
            return results;
        } else {
            return null;
        }
    } catch (error) {
        console.error(error);
        return null;
    }


}


/**
 * Set a key-value pair in storage.
 * @param {string} key - The key to use in the storage area.
 * @param {*} value - The value to store in the storage area for the key.
 */
async function set(key, value) {
    await browser.storage.local.set({ [key]: value });
}

/**
 * Check if user is a lottery winner and if so, notify.
 */
export async function initialize() {
    // Handle redeemed callback
    webScience.messaging.onMessage.addListener(async () => {
        await callAPI("update");
    }, { type: "WebScience.redeemed" });

    webScience.scheduling.onIdleDaily.addListener(() => {
        // Run Fetch
        callAPI("fetch").then(async lotteryResults => {
            if (!lotteryResults) return;
            if (lotteryResults["isWinner"]) { // the user is a winner

                // Set Redeem Code
                const redeemCode = lotteryResults["giftCode"];
                await set("redeemCode", redeemCode)

                const redeemed = lotteryResults["redeemed"];
                if (!redeemed) {
                    // Creates a browser popup window displaying the notice to the participant
                    browser.windows.create({
                        allowScriptsToClose: true,
                        url: `/dist/pages/lottery_popup.html`,
                    });
                }
            }
        });
    });
}
