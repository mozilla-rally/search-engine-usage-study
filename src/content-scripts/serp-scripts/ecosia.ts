import { PageValues } from "../common.js"
import * as Utils from "../Utils.js"
import { timing } from "@mozilla/web-science";

/**
 * Content Script for Ecosia SERP
 */
const serpModule = function () {
    // Create a pageValues object to track data for the SERP page
    const pageValues = new PageValues("Ecosia", onNewTab);

    /**
     * @returns {OrganicDetail[]} An array of details for each of the organic search results.
     */
    function getOrganicDetails(): OrganicDetail[] {
        const organicResults = document.querySelectorAll("div.card-web > div.result");
        const organicDetails: OrganicDetail[] = []
        for (const organicResult of organicResults) {
            organicDetails.push({ TopHeight: Utils.getElementTopHeight(organicResult), BottomHeight: Utils.getElementBottomHeight(organicResult), PageNum: null })
        }
        return organicDetails;
    }

    /**
     * @returns {Element[][]} An array of the organic link elements for each of the organic search results.
     */
    function getOrganicLinkElements(): Element[][] {
        const organicResults = document.querySelectorAll("div.card-web > div.result");
        const organicLinkElements: Element[][] = []
        for (const organicResult of organicResults) {
            organicLinkElements.push(Array.from(organicResult.querySelectorAll('[href]')));
        }
        return organicLinkElements;
    }

    /**
     * @returns {number} The number of ad results on the page.
     */
    function getNumAdResults(): number {
        return document.querySelectorAll(".card-ad > div, .card-productads > div").length;
    }

    /**
     * @returns {Element[]} An array of ad link elements on the page.
     */
    function getAdLinkElements(): Element[] {
        return Array.from(document.querySelectorAll(".card-ad > div [href], .card-productads > div [href]")).filter(adLinkElement => {
            return !adLinkElement.matches('.ad-hint-wrapper, .ad-hint-wrapper *');
        });
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the top of the search area.
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
     * @returns {number} The number of pixels between the top of the page and the bottom of the search area.
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
     * @returns {number} The page number.
     */
    function getPageNum(): number {
        const pageNumFromUrl = Utils.getQueryVariable(window.location.href, "p");
        return pageNumFromUrl ? Number(pageNumFromUrl) + 1 : 1;
    }

    /**
     * @param {Element} target - the target of a click event.
     * @returns {string} A link if the target was an internal link element in the search area.
     * An empty string if it was a possible internal link element. null otherwise.
     */
    function getInternalLink(target: Element): string {
        if (target.matches(".results-wrapper *")) {
            if (!target.matches(".pagination *")) {
                const hrefElement = target.closest("[href]");
                if (hrefElement) {
                    const href = (hrefElement as any).href;
                    if (Utils.isValidLinkToDifferentPage(href)) {
                        const url = new URL(href);
                        if (url.hostname.includes("ecosia.org")) {
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
     * Determines the page values and adds listeners
     */
    function determinePageValues(): void {
        pageValues.pageIsCorrect = true;
        pageValues.pageNum = getPageNum();
        pageValues.searchAreaBottomHeight = getSearchAreaBottomHeight();
        pageValues.searchAreaTopHeight = getSearchAreaTopHeight();
        pageValues.numAdResults = getNumAdResults();
        pageValues.organicResults = getOrganicDetails();
        pageValues.addAdListeners(getAdLinkElements());
        pageValues.addOrganicListeners(getOrganicLinkElements());
        pageValues.addInternalListeners(getInternalLink);
    }

    /**
     * A callback that will be passed the string URL of new tabs opened from the page. It should
     * determine if the new tab corresponds with an ad click, organic click, or internal click.
     * @param {string} url - the url string of a new tab opened from the page.
     */
    function onNewTab(url: string) {
        if (!pageValues.mostRecentMousedown) {
            return;
        }
        const normalizedUrl: string = Utils.getNormalizedUrl(url);
        if (pageValues.mostRecentMousedown.type === ElementType.Ad) {
            if (normalizedUrl.includes("bing.com/aclick") || pageValues.mostRecentMousedown.href === url) {
                pageValues.numAdClicks++;
            }
            return;
        }
        if (pageValues.mostRecentMousedown.type === ElementType.Organic) {
            if (pageValues.mostRecentMousedown.href === url) {
                pageValues.organicClicks.push({ Ranking: pageValues.mostRecentMousedown.index, AttentionDuration: pageValues.getAttentionDuration(), PageLoaded: pageValues.pageLoaded })
            }
            return;
        }
        if (pageValues.mostRecentMousedown.type === ElementType.Internal) {
            if (pageValues.mostRecentMousedown.href === url) {
                pageValues.numInternalClicks++;
            }
            return;
        }
    }

    window.addEventListener("DOMContentLoaded", function () {
        determinePageValues();
    });

    window.addEventListener("load", function () {
        determinePageValues();
        pageValues.pageLoaded = true;
    });

    window.addEventListener("unload", (event) => {
        pageValues.reportResults(timing.fromMonotonicClock(event.timeStamp, true));
    });
};

Utils.waitForPageManagerLoad(serpModule)