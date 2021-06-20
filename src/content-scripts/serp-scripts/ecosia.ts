import { PageValues, MousedownType } from "../common.js"
import * as Utils from "../Utils.js"
import { timing } from "@mozilla/web-science";

/**
 * Content Script for Ecosia SERP
 */
const serpModule = function () {
    const pageValues = new PageValues("Ecosia", onNewTab);

    function getOrganicDetails(): OrganicDetail[] {
        const organicResults = document.querySelectorAll("div.card-web > div.result");
        const organicDetails: OrganicDetail[] = []
        for (const organicResult of organicResults) {
            organicDetails.push({ TopHeight: Utils.getElementTopHeight(organicResult), BottomHeight: Utils.getNextElementTopHeight(organicResult), PageNum: null })
        }
        return organicDetails;
    }

    function getOrganicLinkElements(): Element[][] {
        const organicResults = document.querySelectorAll("div.card-web > div.result");
        const organicLinkElements: Element[][] = []
        for (const organicResult of organicResults) {
            organicLinkElements.push(Array.from(organicResult.querySelectorAll('[href]')));
        }
        return organicLinkElements;
    }

    /**
     * @returns {Array} An array of all the ad results on the page
     */
    function getNumAdResults(): number {
        return document.querySelectorAll(".card-ad > div, .card-productads > div").length;
    }

    function getAdLinkElements(): Element[] {
        return Array.from(document.querySelectorAll(".card-ad > div [href], .card-productads > div [href]")).filter(adLinkElement => {
            return !adLinkElement.matches('.ad-hint-wrapper, .ad-hint-wrapper *');
        });
    }

    /**
     * Get the number of pixels between the top of the page and the top of the search area.
     */
    function getSearchAreaTopHeight(): number {
        try {
            const element = document.querySelector(".navbar-row") as HTMLElement;
            return element.offsetHeight + Utils.getElementTopHeight(element);
        } catch (error) {
            return null;
        }
    }

    /**
     * Get the number of pixels between the top of the page and the bottom of the search area.
     */
    function getSearchAreaBottomHeight(): number {
        try {
            const element = document.querySelector(".pagination").previousElementSibling as HTMLElement;
            return element.offsetHeight + Utils.getElementTopHeight(element);
        } catch (error) {
            return null;
        }

    }

    /**
     * Get the page number.
     */
    function getPageNum(): number {
        const pageNumFromUrl = Utils.getQueryVariable(window.location.href, "p");
        return pageNumFromUrl ? Number(pageNumFromUrl) + 1 : 1;
    }

    // Returns the href if it is an internal link
    // Returns empty string if the click was in the search area but there was no link
    // Returns null otherwise
    function getInternalLink(target: Element): string {
        if (target.matches(".results-wrapper *")) {
            if (!target.matches(".pagination *")) {
                const hrefElement = target.closest("[href]");
                if (hrefElement) {
                    const href = (hrefElement as any).href;
                    if (Utils.isLinkToDifferentPage(href)) {
                        const url = new URL(href);
                        if (url.hostname === window.location.hostname) {
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

    /**
     * Determine all the page values and send the query to the background page
     */
    function determinePageValues(): void {
        pageValues.pageIsCorrect = true;
        pageValues.pageNum = getPageNum();
        pageValues.searchAreaBottomHeight = getSearchAreaBottomHeight();
        pageValues.searchAreaTopHeight = getSearchAreaTopHeight();
        pageValues.numAdResults = getNumAdResults();
        pageValues.organicResults = getOrganicDetails();
        pageValues.addAdClickListeners(getAdLinkElements());
        pageValues.addOrganicListeners(getOrganicLinkElements());
        pageValues.addInternalListeners(getInternalLink);
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
        if (pageValues.mostRecentMousedown.type === MousedownType.Ad) {
            if (normalizedUrl.includes("bing.com/aclick")) {
                console.debug("Advertisement Click")
                pageValues.numAdClicks++;
            }
            return;
        }
        if (pageValues.mostRecentMousedown.type === MousedownType.Organic && pageValues.mostRecentMousedown.href === url) {
            console.debug(`Internal Click: Ranking: ${pageValues.mostRecentMousedown.index}, AttentionDuration: ${pageValues.getAttentionDuration()}, PageLoaded: ${pageValues.pageLoaded}`);
            pageValues.organicClicks.push({ Ranking: pageValues.mostRecentMousedown.index, AttentionDuration: pageValues.getAttentionDuration(), PageLoaded: pageValues.pageLoaded })
            return;
        }
        if (pageValues.mostRecentMousedown.type === MousedownType.Internal && pageValues.mostRecentMousedown.href === url) {
            console.debug("Internal Click")
            pageValues.numInternalClicks++;
        }
    }

    window.addEventListener("unload", (event) => {
        pageValues.reportResults(timing.fromMonotonicClock(event.timeStamp, true));
    });
};

Utils.waitForPageManagerLoad(serpModule)