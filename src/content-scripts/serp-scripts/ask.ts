/**
 * Content Scripts for Ask SERP
 */

(async function () {
    const moduleName = "Ask"

    const askFrameToNumAdsObject = {}
    let numAskDisplayAds = 0

    /**
     * Determine whether the page is a web search results page
     */
    function determinePageIsCorrect(): void {
        // Do not need to determine if it is web search, Ask does not
        // have other searches
        pageIsCorrect = true
    }

    /**
     * @returns {Array} An array of all the organic results on the page
     */
    function getOrganicResults() {
        return Array.from(document.querySelectorAll(".PartialSearchResults-item"));
    }

    /**
     * @returns {Array} An array of the ad results on the page not in iFrames
     */
    function getAdResults() {
        return Array.from(document.querySelectorAll(".display-ad-block"))
    }

    /**
     * Determine the height of the top of the search results area
     */
    function determineSearchAreaTopHeight(): void {
        searchAreaTopHeight = getElementTopHeight(document.querySelector(".main"))
    }

    /**
     * Determine the height of the bottom of the search results area
     */
    function determineSearchAreaBottomHeight(): void {
        searchAreaBottomHeight = getElementTopHeight(document.querySelector(".PartialWebPagination "))
    }

    /**
     * Determine the page number
     */
    function determinePageNum() {
        const url = webScience.pageManager.url
        const pageNumberFromUrl = getQueryVariable(url, "page");
        if (pageNumberFromUrl) {
            pageNum = Number(pageNumberFromUrl)
        } else {
            pageNum = 1
        }
    }

    /**
     * @return {Number} the number of ads on page including those within iFrames
     */
    function getNumAdResultsAsk() {
        let total = 0;
        for (const frame in askFrameToNumAdsObject) {
            total += askFrameToNumAdsObject[frame]
        }
        numAdResults = total + numAskDisplayAds;
    }

    /**
     * @param {string} urlString - A url
     * @returns {boolean} Whether the url links to another page on the search engine
     */
    function isInternalLink(urlString: string): boolean {
        try {
            const url = new URL(urlString)
            return url.hostname.includes("ask.com")
        } catch (error) {
            return false
        }
    }

    function determinePageValues(): void {
        determinePageIsCorrect();
        determinePageNum();

        determineSearchAreaTopHeight()
        determineSearchAreaBottomHeight();

        determineOrganicElementsAndAddListeners(getOrganicResults());
        determineAdElementsAndAddListeners(getAdResults());

        addInternalClickListeners(
            ".PartialWebPagination  *, .PartialPageFooter  *, .PartialSearchResults-item *, .TopAdsPartial *, .BottomAdsPartial *, .PartialRtkAdSlot-ads *",
            isInternalLink,
            document.querySelectorAll(".main"));

        getAttributionDetailsFromBackground(moduleName);

        numAskDisplayAds = document.querySelectorAll(".display-ad-block").length
    }

    /**
     * Initializes a listener that will get messages from the iFrames containing ads
     */
    function initializeFrameListener() {
        window.addEventListener("message", (event) => {
            try {
                if ("type" in event.data && event.data.type === "numAds") {
                    console.log(`${event.data.frameID}: ${event.data.numAds}`)
                    askFrameToNumAdsObject[event.data.frameID] = event.data.numAds
                } else if ("type" in event.data && event.data.type === "adClick") {
                    numAdClicks += 1
                    console.log(numAdClicks)
                }
            } catch (error) {
                // console.log("Wrong message type")
            }

        }, false);
    }

    window.addEventListener("DOMContentLoaded", function () {
        determinePageValues();
    });

    window.addEventListener("load", function () {
        determinePageValues();
        pageLoaded = true
    });

    /**
     * Initializes a listener for new tabs that will determine if they correspond to ad clicks
     * on the current page
     */
    function registerAskNewTabAdListener() {
        browser.runtime.onMessage.addListener((message) => {
            if (message.type === "NewTabURL") {
                if ((message.url as string).includes("g.doubleclick.net") ||
                    (message.url as string).includes("google.com/aclk?") ||
                    (message.url as string).includes("revjet") ||
                    (message.url as string).includes("googleadservices.com")) {
                    numAdClicks++;
                }
            }
        });
    }

    // Functionality to be executed immediately before reporting
    function preReportCallbackAsk() {
        getNumAdResultsAsk();
    }

    registerAskNewTabAdListener();
    initializeFrameListener();

    isInternalLinkFunction = isInternalLink;
    initPageManagerListeners();
    registerNewTabListener();
    registerModule(moduleName, preReportCallbackAsk)
})()