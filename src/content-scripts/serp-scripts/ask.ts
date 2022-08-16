import { PageValues, getElementBottomHeight, getElementTopHeight, isValidLinkToDifferentPage, getNormalizedUrl, waitForPageManagerLoad, ElementType } from "../common.js"
import { getQueryVariable } from "../../Utils.js"
import { timing } from "@mozilla/web-science";

/**
 * Content Scripts for Google SERP
 */
let internalListeners: { document: Document, clickListener: (event: MouseEvent) => void, mousedownListener: (event: MouseEvent) => void }[] = [];
const serpScript = function () {

    /**
    * @returns {boolean} Whether the page is an Ask web SERP page.
    */
    function getIsWebSerpPage(): boolean {
        // The content script match pattern handles this.
        return true;
    }

    /**
     * @returns {OrganicDetail[]} An array of details for each of the organic search results.
     */
    function getOrganicDetailsAndLinkElements(): { organicDetails: OrganicDetail[], organicLinkElements: Element[][] } {
        try {
            // The organic results are .PartialSearchResults-item elements.
            const organicResults = document.querySelectorAll(".PartialSearchResults-item");

            const organicDetails: OrganicDetail[] = []
            const organicLinkElements: Element[][] = [];
            for (const organicResult of organicResults) {
                // Get the details of all the organic elements.
                organicDetails.push({ topHeight: getElementTopHeight(organicResult), bottomHeight: getElementBottomHeight(organicResult), pageNum: null, onlineService: "" });

                // Get all the links (elements with an "href" attribute).
                organicLinkElements.push(Array.from(organicResult.querySelectorAll('[href]')));
            }
            return { organicDetails: organicDetails, organicLinkElements: organicLinkElements };
        } catch (error) {
            return { organicDetails: [], organicLinkElements: [] };
        }
    }

    /**
     * @returns {Element[]} An array of ad link elements on the page.
     */
    function getAdLinkElements(): Element[] {
        try {
            const adLinkElements: Element[] = [];

            // The image ads on the side are .display-ad-block elements. The advertisements
            // in the main search area are in iframes and handled by askgoogleads.js
            const displayAds = Array.from(document.querySelectorAll(".display-ad-block"));
            const amazonResults = Array.from(document.querySelectorAll(".PartialAmazonResults"));

            const adElements = displayAds.concat(amazonResults);
            for (const adElement of adElements) {
                adLinkElements.push(...adElement.querySelectorAll("[href]"));
            }
            return adLinkElements;
        } catch (error) {
            return [];
        }
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the top of the search area.
     */
    function getSearchAreaTopHeight(): number {
        try {
            return getElementTopHeight(document.querySelector(".main"));
        } catch (error) {
            return null;
        }
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the bottom of the search area.
     */
    function getSearchAreaBottomHeight(): number {
        try {
            return getElementTopHeight(document.querySelector(".PartialWebPagination "));
        } catch (error) {
            return null;
        }
    }

    /**
     * @returns {number} The page number.
     */
    function getPageNum(): number {
        try {
            const pageNumFromUrl = getQueryVariable(window.location.href, "page");
            return pageNumFromUrl ? Number(pageNumFromUrl) : 1;
        } catch (error) {
            return -1;
        }

    }

    /**
     * @returns {number} The number of results produced for the query by the search engine.
     */
    function getNumResults(): number {
        try {
            // The DOM element that contains the count
            const element = document.querySelector(".PartialResultsHeader-summary");

            if (!element) {
                return null;
            } else {
                // Format of string on Ask.com is "1-10 of 100 results"
                let sentence = element.textContent.replace(/[.,\s]/g, '');

                // Removes the "-" and surrounding numerical characters.
                sentence = element.textContent.replace(/\d*-\d*/g, '');

                const extractedNumber: string = sentence.match(/[0-9]+/g)[0];
                if (extractedNumber == null || extractedNumber == "") {
                    return null;
                } else {
                    return Number(extractedNumber);
                }
            }
        } catch (error) {
            return null;
        }
    }

    /**
     * @param {Element} target - the target of a click event.
     * @returns {string} A link if the target was an internal link element in the search area.
     * An empty string if it was a possible internal link element. null otherwise.
     */
    function getInternalLink(target: Element): string {
        try {
            if (target.matches(".main *")) {
                if (!target.matches(".PartialWebPagination *, .PartialPageFooter *")) {
                    const hrefElement = target.closest("[href]");
                    if (hrefElement) {
                        const href = (hrefElement as any).href;
                        if (isValidLinkToDifferentPage(href)) {
                            const url = new URL(href);
                            if (url.hostname.includes("ask.com")) {
                                return href;
                            }
                        } else {
                            return "";
                        }
                    } else {
                        return "";
                    }
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    function addInternalListeners(getInternalLink: (target: Element) => string) {
        for (const internalListener of internalListeners) {
            internalListener.document.removeEventListener("click", internalListener.clickListener, true);
            internalListener.document.removeEventListener("mousedown", internalListener.mousedownListener, true);
        }
        internalListeners = [];

        const internalClickListener = (event: MouseEvent) => {
            if (event.target instanceof Element) {
                const href = getInternalLink(event.target as Element);
                if (href) {
                    if (__ENABLE_DEVELOPER_MODE__) {
                        console.log("Internal Click");
                    }
                    pageValues.numInternalClicks++;
                    pageValues.mostRecentRecordedClickTimeStamp = timing.fromMonotonicClock(event.timeStamp, true);
                    pageValues.mostRecentMousedown = null;
                } else if (href === "") {
                    pageValues.possibleInternalClickTimeStamp = timing.fromMonotonicClock(event.timeStamp, true);
                }
            }
        }

        const internalMousedownListener = (event: MouseEvent) => {
            if (event.target instanceof Element) {
                const href = getInternalLink(event.target as Element);
                if (href) {
                    pageValues.mostRecentMousedown = {
                        Type: ElementType.Internal,
                        Link: href,
                        Ranking: null
                    }
                }
            }
        }

        document.addEventListener("click", internalClickListener, true);
        document.addEventListener("mousedown", internalMousedownListener, true);
        internalListeners.push({ document: document, clickListener: internalClickListener, mousedownListener: internalMousedownListener });
    }

    function extraCallback(): void {
        addInternalListeners(getInternalLink);
    }

    /**
     * A callback that will be passed the string URL of new tabs opened from the page. It should
     * determine if the new tab corresponds with an ad click, organic click, or internal click.
     * @param {string} url - the url string of a new tab opened from the page.
     */
    function onNewTab(url: string) {
        const normalizedUrl: string = getNormalizedUrl(url);
        if (normalizedUrl.includes("g.doubleclick.net") ||
            normalizedUrl.includes("google.com/aclk") ||
            normalizedUrl.includes("revjet") ||
            normalizedUrl.includes("googleadservices.com")) {
            if (__ENABLE_DEVELOPER_MODE__) {
                console.log("Ad Click");
            }
            pageValues.numAdClicks++;
            return;
        }
        if (!pageValues.mostRecentMousedown) {
            return;
        }

        if (pageValues.mostRecentMousedown.Type === ElementType.Ad) {
            if (pageValues.mostRecentMousedown.Link === url) {
                if (__ENABLE_DEVELOPER_MODE__) {
                    console.log("Ad Click");
                }
                pageValues.numAdClicks++;
            }
            return;
        }

        const normalizedRecentUrl: string = getNormalizedUrl(pageValues.mostRecentMousedown.Link)
        if (pageValues.mostRecentMousedown.Type === ElementType.Organic) {
            if (normalizedRecentUrl === normalizedUrl) {
                if (__ENABLE_DEVELOPER_MODE__) {
                    console.log("Organic Click");
                }
                pageValues.organicClicks.push({ ranking: pageValues.mostRecentMousedown.Ranking, attentionDuration: pageValues.getAttentionDuration(), pageLoaded: pageValues.pageLoaded })
            }
            return;
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Internal) {
            if (normalizedRecentUrl === normalizedUrl ||
                normalizedUrl.includes("ask.com")) {
                if (__ENABLE_DEVELOPER_MODE__) {
                    console.log("Internal Click");
                }
                pageValues.numInternalClicks++;
            }
            return;
        }
    }

    // Create a pageValues object to track data for the SERP page
    const pageValues = new PageValues("Ask", onNewTab, getIsWebSerpPage, getPageNum, getSearchAreaBottomHeight, getSearchAreaTopHeight, null, getOrganicDetailsAndLinkElements, getAdLinkElements, null, extraCallback, null, null, getNumResults);

    window.addEventListener("unload", (event) => {
        // Get the number of ads from iFrames
        let numAskFrameAds = 0;
        for (const frame in askFrameToNumAdsObject) {
            numAskFrameAds += askFrameToNumAdsObject[frame]
        }

        pageValues.numAdResults = numAskFrameAds + document.querySelectorAll(".display-ad-block").length + document.querySelectorAll(".PartialAmazonResults").length;
        pageValues.reportResults(timing.fromMonotonicClock(event.timeStamp, true));
    });

    /**   
     * Initializes a listener that will get messages from the 
     * iFrames containing ads
     */
    const askFrameToNumAdsObject = {}
    window.addEventListener("message", (event) => {
        try {
            if ("type" in event.data && event.data.type === "numAds") {
                askFrameToNumAdsObject[event.data.frameID] = event.data.numAds;
            } else if ("type" in event.data && event.data.type === "adClick") {
                if (__ENABLE_DEVELOPER_MODE__) {
                    console.log("Ad Click");
                }
                pageValues.numAdClicks++;
            }
        } catch (error) {
            return;
        }

    }, false);
};

waitForPageManagerLoad(serpScript)