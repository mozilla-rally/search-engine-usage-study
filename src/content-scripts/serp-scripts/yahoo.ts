import { PageValues, ElementType } from "../common.js"
import * as Utils from "../Utils.js"
import { timing } from "@mozilla/web-science";


/**
 * Content Scripts for Yahoo SERP
 */
const serpModule = function () {
    const pageValues = new PageValues("Yahoo", onNewTab);

    /**
     * Get whether the page is a basic SERP page.
     */
    function getPageIsCorrect(): boolean {
        const url = new URL(window.location.href);
        return url.hostname === "search.yahoo.com" || url.hostname === "www.search.yahoo.com";
    }

    function getOrganicDetails(): OrganicDetail[] {
        const organicResults = document.querySelectorAll("#web > .searchCenterMiddle > li > .algo");
        const organicDetails: OrganicDetail[] = []
        for (const organicResult of organicResults) {
            organicDetails.push({ TopHeight: Utils.getElementTopHeight(organicResult), BottomHeight: Utils.getNextElementTopHeight(organicResult), PageNum: null })
        }
        return organicDetails;
    }

    function getOrganicLinkElements(): Element[][] {
        const organicResults = document.querySelectorAll("#web > .searchCenterMiddle > li > .algo");
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
        return document.querySelectorAll("ol.searchCenterTopAds > li > .ads, ol.searchCenterBottomAds > li > .ads, ol.searchRightTopAds > li, ol.searchRightMiddleAds > li, ol.searchRightBottomAds > li").length;
    }

    function getAdLinkElements(): Element[] {
        const adLinkElements: Element[] = [];

        adLinkElements.push(...document.querySelectorAll("ol.searchCenterTopAds > li > .ads > div:not(.rs-section), ol.searchCenterBottomAds > li > .ads > div:not(.rs-section)"));

        document.querySelectorAll("ol.searchRightTopAds > li, ol.searchRightMiddleAds > li, ol.searchRightBottomAds > li").forEach(adElement => {
            adLinkElements.push(...adElement.querySelectorAll('[href]:not(.p-abs,.p-abs *, .rs-section, .rs-section *)'));
        });

        return adLinkElements;
    }

    /**
     * Get the number of pixels between the top of the page and the top of the search area.
     */
    function getSearchAreaTopHeight(): number {
        try {
            const element = (document.querySelector("#ys") as HTMLElement)
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
            const element = (document.querySelector("#main") as HTMLElement)
            return element.offsetHeight + Utils.getElementTopHeight(element);
        } catch (error) {
            return null;
        }
    }

    /**
     * Get the page number.
     */
    function getPageNum(): number {
        const pageElement = document.querySelector(".pages strong")
        if (pageElement) {
            return Number(pageElement.textContent)
        } else {
            return -1;
        }
    }

    // Returns the href if it is an internal link
    // Returns empty string if the click was in the search area but there was no link
    // Returns null otherwise
    function getInternalLink(target: Element): string {
        if (target.matches("#bd *")) {
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
        pageValues.pageIsCorrect = getPageIsCorrect();
        if (!pageValues.pageIsCorrect) return;
        pageValues.pageNum = getPageNum();
        pageValues.searchAreaBottomHeight = getSearchAreaBottomHeight();
        pageValues.searchAreaTopHeight = getSearchAreaTopHeight();
        pageValues.numAdResults = getNumAdResults();
        pageValues.organicResults = getOrganicDetails();
        pageValues.addAdListeners(getAdLinkElements());
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
        if (!pageValues.mostRecentMousedown) {
            return;
        }
        const normalizedUrl: string = Utils.getNormalizedUrl(url);
        if (pageValues.mostRecentMousedown.type === ElementType.Ad) {
            if (normalizedUrl.includes("r.search.yahoo.com/cbclk2") || pageValues.mostRecentMousedown.href === url) {
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

    window.addEventListener("unload", (event) => {
        pageValues.reportResults(timing.fromMonotonicClock(event.timeStamp, true));
    });
};

Utils.waitForPageManagerLoad(serpModule)