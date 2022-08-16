import { PageValues, getElementBottomHeight, getElementTopHeight, isValidLinkToDifferentPage, waitForPageManagerLoad, ElementType } from "../common.js"
import { getQueryVariable } from "../../Utils.js"
import { timing } from "@mozilla/web-science";

/**
 * Content Script for Brave SERP
 */
const serpScript = function () {

    /**
    * @returns {boolean} Whether the page is an Brave web SERP page.
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
            const organicResults = document.querySelectorAll("#results > .snippet.fdb");
            const organicDetails: OrganicDetail[] = [];
            const organicLinkElements: Element[][] = [];
            for (const organicResult of organicResults) {
                organicDetails.push({ topHeight: getElementTopHeight(organicResult), bottomHeight: getElementBottomHeight(organicResult), pageNum: null, onlineService: "" })
                organicLinkElements.push(Array.from(organicResult.querySelectorAll('[href]')));
            }
            return { organicDetails: organicDetails, organicLinkElements: organicLinkElements };
        } catch (error) {
            return { organicDetails: [], organicLinkElements: [] };
        }

    }

    /**
     * @returns {number} The number of ad results on the page.
     */
    function getNumAdResults(): number {
        // Brave search does not yet have ads.
        return 0;
    }

    /**
     * @returns {Element[]} An array of ad link elements on the page.
     */
    function getAdLinkElements(): Element[] {
        // Brave search does not yet have ads.
        return [];
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the top of the search area.
     */
    function getSearchAreaTopHeight(): number {
        try {
            return getElementTopHeight(document.querySelector("#results"));
        } catch (error) {
            return null;
        }
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the bottom of the search area.
     */
    function getSearchAreaBottomHeight(): number {
        try {
            const resultsElements = document.querySelectorAll("#results > *:not(#pagination)");
            return getElementBottomHeight(resultsElements[resultsElements.length - 1]);
        } catch (error) {
            return null;
        }

    }

    /**
     * @returns {number} The page number.
     */
    function getPageNum(): number {
        try {
            const pageNumFromUrl = getQueryVariable(window.location.href, "offset");
            return pageNumFromUrl ? Number(pageNumFromUrl) + 1 : 1;
        } catch (error) {
            return -1;
        }

    }

    /**
     * @param {Element} target - the target of a click event.
     * @returns {string} A link if the target was an internal link element in the search area.
     * An empty string if it was a possible internal link element. null otherwise.
     */
    function getInternalLink(target: Element): string {
        try {
            if (target.matches("#search-main *")) {
                if (!(target.matches(".footer *, #pagination *"))) {
                    const hrefElement = target.closest("[href]");
                    if (hrefElement) {
                        const href = (hrefElement as any).href;
                        if (isValidLinkToDifferentPage(href)) {
                            const url = new URL(href);
                            if (url.hostname.includes("brave.com")) {
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

    /**
     * A callback that will be passed the string URL of new tabs opened from the page. It should
     * determine if the new tab corresponds with an ad click, organic click, or internal click.
     * @param {string} url - the url string of a new tab opened from the page.
     */
    function onNewTab(url: string) {
        if (!pageValues.mostRecentMousedown) {
            return;
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Ad) {
            // Brave search does not yet have ads.
            return;
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Organic) {
            if (pageValues.mostRecentMousedown.Link === url) {
                if (__ENABLE_DEVELOPER_MODE__) {
                    console.log("Organic Click");
                }
                pageValues.organicClicks.push({ ranking: pageValues.mostRecentMousedown.Ranking, attentionDuration: pageValues.getAttentionDuration(), pageLoaded: pageValues.pageLoaded })
            }
            return;
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Internal) {
            if (pageValues.mostRecentMousedown.Link === url) {
                if (__ENABLE_DEVELOPER_MODE__) {
                    console.log("Internal Click");
                }
                pageValues.numInternalClicks++;
            }
            return;
        }
    }

    // Create a pageValues object to track data for the SERP page
    const pageValues = new PageValues("Brave", onNewTab, getIsWebSerpPage, getPageNum, getSearchAreaBottomHeight, getSearchAreaTopHeight, getNumAdResults, getOrganicDetailsAndLinkElements, getAdLinkElements, getInternalLink);

    window.addEventListener("unload", (event) => {
        pageValues.reportResults(timing.fromMonotonicClock(event.timeStamp, true));
    });
};

waitForPageManagerLoad(serpScript)