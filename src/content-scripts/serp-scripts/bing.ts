import { PageValues } from "../common.js"
import * as Utils from "../Utils.js"
import { timing } from "@mozilla/web-science";

/**
 * Content Scripts for Bing SERP
 */
const serpModule = function () {
    // Create a pageValues object to track data for the SERP page
    const pageValues = new PageValues("Bing", onNewTab);

    /**
     * @returns {OrganicDetail[]} An array of details for each of the organic search results.
     */
    function getOrganicDetails(): OrganicDetail[] {
        const organicResults = document.querySelectorAll("#b_results > li.b_algo");
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
        const organicResults = document.querySelectorAll("#b_results > li.b_algo");
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
        return document.querySelectorAll(".b_adSlug").length;
    }

    /**
     * @returns {Element[]} An array of ad link elements on the page.
     */
    function getAdLinkElements(): Element[] {
        const adLinkElements: Element[] = [];

        // Get link elements from ad carousels
        document.querySelectorAll(".adsMvCarousel").forEach(adElement => {
            if (adElement.parentElement.parentElement.querySelector(".b_adSlug")) {
                adLinkElements.push(...adElement.querySelectorAll(".slide:not(.see_more) [href]"));
            }
        });

        // Get standard ad link elements
        const adElements = Array.from(document.querySelectorAll(".b_ad > ul > li, .b_adLastChild")).filter(adElement => {
            return !adElement.querySelector(".adsMvCarousel");
        });
        adElements.forEach(adElement => {
            Array.from(adElement.querySelectorAll("[href]")).filter(adLinkElement => {
                if (!adLinkElement.matches('.b_adcaret, .b_adcaret *, .b_adinfo, .b_adinfo *')) {
                    adLinkElements.push(adLinkElement);
                }
            });
        });

        return adLinkElements;
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the top of the search area.
     */
    function getSearchAreaTopHeight(): number {
        try {
            return (document.querySelector("#b_header") as HTMLElement).offsetHeight;
        } catch (error) {
            return null;
        }
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the bottom of the search area.
     */
    function getSearchAreaBottomHeight(): number {
        const element = (document.querySelector(".b_pag") as HTMLElement);
        return Utils.getElementTopHeight(element);
    }

    /**
     * @returns {number} The page number.
     */
    function getPageNum(): number {
        const pageElement = document.querySelector(".sb_pagS_bp")
        if (pageElement) {
            return Number(pageElement.textContent);
        } else {
            return -1;
        }
    }

    /**
     * @param {Element} target - the target of a click event.
     * @returns {string} A link if the target was an internal link element in the search area.
     * An empty string if it was a possible internal link element. null otherwise.
     */
    function getInternalLink(target: Element): string {
        // Make sure the target is in the search area
        if (target.matches("#b_content *")) {
            // Make sure the target is not a pagination element, organic element, or ad element
            if (!target.matches(".b_pag *, #b_results > li.b_algo *, .b_ad > ul > li *, .b_adLastChild *")) {
                const hrefElement = target.closest("[href]");
                if (hrefElement) {
                    const href = (hrefElement as any).href;
                    if (Utils.isValidLinkToDifferentPage(href)) {
                        const url = new URL(href);
                        if (url.hostname.includes("bing.com")) {
                            // If the link URL is a valid link to a different page and the hostname includes
                            // bing.com, then it is an internal link.
                            return href;
                        }
                    } else {
                        // If the link is not a valid link to a different page, it is possibly an internal link.
                        return "";
                    }
                } else {
                    // If there is no href, then it is possibly an internal link.
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
        // If a mousedown has not been recorded on an ad, organic, or internal element then return
        if (!pageValues.mostRecentMousedown) {
            return;
        }

        const normalizedUrl: string = Utils.getNormalizedUrl(url);

        // If the URL is for a redirect, get the URL it redirects to
        let redirectUrl = null;
        if (normalizedUrl.includes("bing.com/newtabredir")) {
            redirectUrl = Utils.getQueryVariable(url, "url")
        }

        if (pageValues.mostRecentMousedown.type === ElementType.Ad) {
            if (normalizedUrl.includes("bing.com/aclk") ||
                pageValues.mostRecentMousedown.href === url ||
                (redirectUrl && pageValues.mostRecentMousedown.href === redirectUrl)) {
                pageValues.numAdClicks++;
            }
            return;
        }
        if (pageValues.mostRecentMousedown.type === ElementType.Organic) {
            if (pageValues.mostRecentMousedown.href === url ||
                (redirectUrl && pageValues.mostRecentMousedown.href === redirectUrl)) {
                pageValues.organicClicks.push({ Ranking: pageValues.mostRecentMousedown.index, AttentionDuration: pageValues.getAttentionDuration(), PageLoaded: pageValues.pageLoaded })
            }
            return
        }
        if (pageValues.mostRecentMousedown.type === ElementType.Internal) {
            if (pageValues.mostRecentMousedown.href === url ||
                (redirectUrl && (pageValues.mostRecentMousedown.href === redirectUrl || redirectUrl[0] === "/"))) {
                pageValues.numInternalClicks++;
            }
            return
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