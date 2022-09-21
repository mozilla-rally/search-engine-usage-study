import { PageValues, getElementBottomHeight, getElementTopHeight, isValidLinkToDifferentPage, getNormalizedUrl, waitForPageManagerLoad, ElementType } from "../common.js"
import { timing } from "@mozilla/web-science";
import { searchEnginesMetadata } from "../../Utils.js"

/**
 * Content Scripts for Yahoo SERP
 */
const serpScript = function () {

    /**
     * @returns {boolean} Whether the page is a Yahoo web SERP page.
     */
    function getIsWebSerpPage(): boolean {
        return searchEnginesMetadata["Yahoo"].getIsSerpPage(window.location.href);
    }

    /**
     * @returns {OrganicDetail[]} An array of details for each of the organic search results.
     */
    function getOrganicDetailsAndLinkElements(): { organicDetails: OrganicDetail[], organicLinkElements: Element[][] } {
        try {
            const organicResults = document.querySelectorAll("#web > .searchCenterMiddle > li > .algo");
            const organicDetails: OrganicDetail[] = []
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
        try {
            return document.querySelectorAll("ol.searchCenterTopAds > li > div:not([class*='AdTitle']):not([class*='AdHdr']), ol.searchCenterBottomAds > li > div:not([class*='AdTitle']):not([class*='AdHdr']), ol.searchCenterMiddle > li > div .compProductList, ol.searchRightTopAds > li, ol.searchRightMiddleAds > li, ol.searchRightBottomAds > li").length;
        } catch (error) {
            return -1;
        }

    }

    /**
     * @returns {Element[]} An array of ad link elements on the page.
     */
    function getAdLinkElements(): Element[] {
        try {
            const adLinkElements: Element[] = [];

            const adElements = document.querySelectorAll("ol.searchCenterTopAds > li > div:not([class*='AdTitle']):not([class*='AdHdr']), ol.searchCenterBottomAds > li > div:not([class*='AdTitle']):not([class*='AdHdr']), ol.searchCenterMiddle > li > div .compProductList, ol.searchRightTopAds > li, ol.searchRightMiddleAds > li, ol.searchRightBottomAds > li");
            for (const adElement of adElements) {
                adLinkElements.push(...adElement.querySelectorAll('[href]'));
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
            const element = (document.querySelector("#ys") as HTMLElement)
            return getElementBottomHeight(element);
        } catch (error) {
            return null;
        }
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the bottom of the search area.
     */
    function getSearchAreaBottomHeight(): number {
        try {
            const element = (document.querySelector("#main") as HTMLElement)
            return getElementBottomHeight(element);
        } catch (error) {
            return null;
        }
    }

    /**
     * @returns {number} The page number.
     */
    function getPageNum(): number {
        try {
            const pageElement = document.querySelector(".pages strong");
            if (pageElement) {
                return Number(pageElement.textContent)
            } else {
                return -1;
            }
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
            const element = document.querySelector(".searchSuperTop .title span");

            // If the DOM element doesn't exist, we assume this means there are no results.
            if (!element) {
                return 0;
            } else {
                const sentence = element.textContent.replace(/[.,\s]/g, '');

                // Format of string on Yahoo is "About 326,000 search results"
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
            if (target.matches("#bd *")) {
                if (!target.matches(".pagination *")) {
                    const hrefElement = target.closest("[href]");
                    if (hrefElement) {
                        const href = (hrefElement as any).href;
                        if (isValidLinkToDifferentPage(href)) {
                            const url = new URL(href);
                            if (url.hostname.includes("yahoo.com") && !url.hostname.includes("r.search.yahoo.com")) {
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
        const normalizedUrl: string = getNormalizedUrl(url);
        if (pageValues.mostRecentMousedown.Type === ElementType.Ad) {
            if (normalizedUrl.includes("r.search.yahoo.com/cbclk2") || pageValues.mostRecentMousedown.Link === url) {
                if (__ENABLE_DEVELOPER_MODE__) {
                    console.log("Ad Click");
                }
                pageValues.numAdClicks++;
            }
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
                if (!url.includes("r.search.yahoo.com")) {
                    if (__ENABLE_DEVELOPER_MODE__) {
                        console.log("Internal Click");
                    }
                    pageValues.numInternalClicks++;
                }

            }
            return;
        }
    }

    // Create a pageValues object to track data for the SERP page
    const pageValues = new PageValues("Yahoo", onNewTab, getIsWebSerpPage, getPageNum, getSearchAreaBottomHeight, getSearchAreaTopHeight, getNumAdResults, getOrganicDetailsAndLinkElements, getAdLinkElements, getInternalLink, null, null, null, getNumResults);

    window.addEventListener("unload", (event) => {
        pageValues.reportResults(timing.fromMonotonicClock(event.timeStamp, true));
    });
};

waitForPageManagerLoad(serpScript)