import { PageValues, ElementType } from "../common.js"
import * as Utils from "../Utils.js"
import { timing } from "@mozilla/web-science";

/**
 * Content Scripts for Google SERP
 */
let internalListeners: { document: Document, clickListener: (event: MouseEvent) => void, mousedownListener: (event: MouseEvent) => void }[] = [];
const serpModule = function () {
    const pageValues = new PageValues("Ask", onNewTab);

    function getOrganicDetails(): OrganicDetail[] {
        const organicResults = document.querySelectorAll(".PartialSearchResults-item");
        const organicDetails: OrganicDetail[] = []
        for (const organicResult of organicResults) {
            organicDetails.push({ TopHeight: Utils.getElementTopHeight(organicResult), BottomHeight: Utils.getNextElementTopHeight(organicResult), PageNum: null })
        }
        return organicDetails;
    }

    function getOrganicLinkElements(): Element[][] {
        const organicResults = document.querySelectorAll(".PartialSearchResults-item");
        const organicLinkElements: Element[][] = []
        for (const organicResult of organicResults) {
            organicLinkElements.push(Array.from(organicResult.querySelectorAll('[href]')));
        }
        return organicLinkElements;
    }

    function getAdLinkElements(): Element[] {
        const adLinkElements: Element[] = [];
        const adElements = document.querySelectorAll(".display-ad-block");
        adElements.forEach(adElement => {
            adLinkElements.push(...adElement.querySelectorAll("[href]"));
        });
        return adLinkElements;
    }

    /**
     * Get the number of pixels between the top of the page and the top of the search area.
     */
    function getSearchAreaTopHeight(): number {
        try {
            return Utils.getElementTopHeight(document.querySelector(".main"));
        } catch (error) {
            return null;
        }
    }

    /**
     * Get the number of pixels between the top of the page and the bottom of the search area.
     */
    function getSearchAreaBottomHeight(): number {
        try {
            return Utils.getElementTopHeight(document.querySelector(".PartialWebPagination "));
        } catch (error) {
            return null;
        }
    }

    /**
     * Get the page number.
     */
    function getPageNum(): number {
        const pageNumFromUrl = Utils.getQueryVariable(window.location.href, "page");
        return pageNumFromUrl ? Number(pageNumFromUrl) : 1;
    }

    // Returns the href if it is an internal link
    // Returns empty string if the click was in the search area but there was no link
    // Returns null otherwise
    function getInternalLink(target: Element): string {
        if (target.matches(".main *")) {
            if (!target.matches(".PartialWebPagination *, .PartialPageFooter *")) {
                const hrefElement = target.closest("[href]");
                if (hrefElement) {
                    const href = (hrefElement as any).href;
                    if (Utils.isLinkToDifferentPage(href)) {
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
                        type: ElementType.Internal,
                        href: href,
                        index: null
                    }
                }
            }
        }

        document.addEventListener("click", internalClickListener, true);
        document.addEventListener("mousedown", internalMousedownListener, true);
        internalListeners.push({ document: document, clickListener: internalClickListener, mousedownListener: internalMousedownListener });
    }

    /**
     * Determine all the page values and send the query to the background page
     */
    function determinePageValues(): void {
        pageValues.pageIsCorrect = true;
        pageValues.pageNum = getPageNum();
        pageValues.searchAreaBottomHeight = getSearchAreaBottomHeight();
        pageValues.searchAreaTopHeight = getSearchAreaTopHeight();
        pageValues.organicResults = getOrganicDetails();
        pageValues.addAdListeners(getAdLinkElements());
        pageValues.addOrganicListeners(getOrganicLinkElements());
        addInternalListeners(getInternalLink);
    }

    window.addEventListener("DOMContentLoaded", function () {
        determinePageValues();
    });

    window.addEventListener("load", function () {
        determinePageValues();
        pageValues.pageLoaded = true;
    });

    function onNewTab(url) {
        const normalizedUrl: string = Utils.getNormalizedUrl(url);
        if (normalizedUrl.includes("g.doubleclick.net") ||
            normalizedUrl.includes("google.com/aclk") ||
            normalizedUrl.includes("revjet") ||
            normalizedUrl.includes("googleadservices.com")) {
            pageValues.numAdClicks++;
            return;
        }
        if (!pageValues.mostRecentMousedown) {
            return;
        }
        const normalizedRecentUrl: string = Utils.getNormalizedUrl(pageValues.mostRecentMousedown.href)
        if (pageValues.mostRecentMousedown.type === ElementType.Organic) {
            if (normalizedRecentUrl === normalizedUrl) {
                pageValues.organicClicks.push({ Ranking: pageValues.mostRecentMousedown.index, AttentionDuration: pageValues.getAttentionDuration(), PageLoaded: pageValues.pageLoaded })
            }
            return;
        }
        if (pageValues.mostRecentMousedown.type === ElementType.Internal) {
            if (normalizedRecentUrl === normalizedUrl ||
                normalizedUrl.includes("ask.com")) {
                pageValues.numInternalClicks++;
            }
            return;
        }
    }

    window.addEventListener("unload", (event) => {
        let numAskFrameAds = 0;
        for (const frame in askFrameToNumAdsObject) {
            numAskFrameAds += askFrameToNumAdsObject[frame]
        }
        pageValues.numAdResults = numAskFrameAds + document.querySelectorAll(".display-ad-block").length;
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
                pageValues.numAdClicks++;
            }
        } catch (error) {
            return;
        }

    }, false);
};

Utils.waitForPageManagerLoad(serpModule)