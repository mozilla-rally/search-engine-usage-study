import { PageValues, getElementBottomHeight, getElementTopHeight, isValidLinkToDifferentPage, getNormalizedUrl, waitForPageManagerLoad, ElementType } from "../common.js"
import { getQueryVariable } from "../../Utils.js"
import { timing } from "@mozilla/web-science";

/**
 * Content Script for Ecosia SERP
 */
const serpScript = function () {
    // Create a pageValues object to track data for the SERP page
    const pageValues = new PageValues("Ecosia", onNewTab, getIsWebSerpPage, getPageNum, getSearchAreaBottomHeight, getSearchAreaTopHeight, getNumAdResults, getOrganicDetailsAndLinkElements, getAdLinkElements, getInternalLink, null);


    /**
    * @returns {boolean} Whether the page is a DuckDuckGo web SERP page.
    */
    function getIsWebSerpPage(): boolean {
        return true;
    }

    /**
     * @returns {OrganicDetail[]} An array of details for each of the organic search results.
     */
    function getOrganicDetailsAndLinkElements(): { details: OrganicDetail[], linkElements: Element[][] } {
        const organicResults = document.querySelectorAll("div.card-web > div.result");
        const organicDetails: OrganicDetail[] = [];
        const organicLinkElements: Element[][] = [];
        for (const organicResult of organicResults) {
            organicDetails.push({ TopHeight: getElementTopHeight(organicResult), BottomHeight: getElementBottomHeight(organicResult), PageNum: null })
            organicLinkElements.push(Array.from(organicResult.querySelectorAll('[href]')));
        }
        return { details: organicDetails, linkElements: organicLinkElements };
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
            return element.offsetHeight + getElementTopHeight(element);
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
            return element.offsetHeight + getElementTopHeight(element);
        } catch (error) {
            return null;
        }

    }

    /**
     * @returns {number} The page number.
     */
    function getPageNum(): number {
        const pageNumFromUrl = getQueryVariable(window.location.href, "p");
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
                    if (isValidLinkToDifferentPage(href)) {
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
     * A callback that will be passed the string URL of new tabs opened from the page. It should
     * determine if the new tab corresponds with an ad click, organic click, or internal click.
     * @param {string} url - the url string of a new tab opened from the page.
     */
    function onNewTab(url: string) {
        if (!pageValues.mostRecentMousedown) {
            return;
        }
        const normalizedUrl: string = getNormalizedUrl(url);
        if (pageValues.mostRecentMousedown.Type === ElementType.Ad) {
            if (normalizedUrl.includes("bing.com/aclick") || pageValues.mostRecentMousedown.Link === url) {
                pageValues.numAdClicks++;
            }
            return;
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Organic) {
            if (pageValues.mostRecentMousedown.Link === url) {
                pageValues.organicClicks.push({ Ranking: pageValues.mostRecentMousedown.Ranking, AttentionDuration: pageValues.getAttentionDuration(), PageLoaded: pageValues.pageLoaded })
            }
            return;
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Internal) {
            if (pageValues.mostRecentMousedown.Link === url) {
                pageValues.numInternalClicks++;
            }
            return;
        }
    }

    window.addEventListener("unload", (event) => {
        pageValues.reportResults(timing.fromMonotonicClock(event.timeStamp, true));
    });
};

waitForPageManagerLoad(serpScript)