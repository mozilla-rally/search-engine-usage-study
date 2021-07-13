import { PageValues, getElementBottomHeight, getElementTopHeight, isValidLinkToDifferentPage, getNormalizedUrl, waitForPageManagerLoad, ElementType } from "../common.js"
import { getQueryVariable } from "../../Utils.js"
import { timing } from "@mozilla/web-science";

/**
 * Content Scripts for Bing SERP
 */
const serpScript = function () {
    // Create a pageValues object to track data for the SERP page
    const pageValues = new PageValues("Bing", onNewTab, getIsWebSerpPage, getPageNum, getSearchAreaBottomHeight, getSearchAreaTopHeight, getNumAdResults, getOrganicDetailsAndLinkElements, getAdLinkElements, getInternalLink, null);

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
        const organicResults = document.querySelectorAll("#b_results > li.b_algo");
        const organicDetails: OrganicDetail[] = []
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
        return document.querySelectorAll(".b_adSlug").length;
    }

    /**
     * @returns {Element[]} An array of ad link elements on the page.
     */
    function getAdLinkElements(): Element[] {
        const adLinkElements: Element[] = [];

        // Get link elements from ad carousels
        const adCarousels = document.querySelectorAll(".adsMvCarousel");
        for (const adCarousel of adCarousels) {
            if (adCarousel.parentElement.parentElement.querySelector(".b_adSlug")) {
                adLinkElements.push(...adCarousel.querySelectorAll(".slide:not(.see_more) [href]"));
            }
        }

        // Get standard ad link elements
        const adElements = Array.from(document.querySelectorAll(".b_ad > ul > li, .b_adLastChild")).filter(adElement => {
            return !adElement.querySelector(".adsMvCarousel");
        });

        for (const adElement of adElements) {
            adLinkElements.push(...Array.from(adElement.querySelectorAll("[href]")).filter(adLinkElement => {
                return !adLinkElement.matches('.b_adcaret, .b_adcaret *, .b_adinfo, .b_adinfo *');
            }));
        }

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
        return getElementTopHeight(element);
    }

    /**
     * @returns {number} The page number.
     */
    function getPageNum(): number {
        const pageElement = document.querySelector(".sb_pagS_bp")
        return Number(pageElement.textContent);
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
                    if (isValidLinkToDifferentPage(href)) {
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
     * A callback that will be passed the string URL of new tabs opened from the page. It should
     * determine if the new tab corresponds with an ad click, organic click, or internal click.
     * @param {string} url - the url string of a new tab opened from the page.
     */
    function onNewTab(url: string) {
        // If a mousedown has not been recorded on an ad, organic, or internal element then return
        if (!pageValues.mostRecentMousedown) {
            return;
        }

        const normalizedUrl: string = getNormalizedUrl(url);

        // If the URL is for a redirect, get the URL it redirects to
        let redirectUrl = null;
        if (normalizedUrl.includes("bing.com/newtabredir")) {
            redirectUrl = getQueryVariable(url, "url")
        }

        if (pageValues.mostRecentMousedown.Type === ElementType.Ad) {
            if (normalizedUrl.includes("bing.com/aclk") ||
                pageValues.mostRecentMousedown.Link === url ||
                (redirectUrl && pageValues.mostRecentMousedown.Link === redirectUrl)) {
                pageValues.numAdClicks++;
            }
            return;
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Organic) {
            if (pageValues.mostRecentMousedown.Link === url ||
                (redirectUrl && pageValues.mostRecentMousedown.Link === redirectUrl)) {
                pageValues.organicClicks.push({ Ranking: pageValues.mostRecentMousedown.Ranking, AttentionDuration: pageValues.getAttentionDuration(), PageLoaded: pageValues.pageLoaded })
            }
            return
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Internal) {
            if (pageValues.mostRecentMousedown.Link === url ||
                (redirectUrl && (pageValues.mostRecentMousedown.Link === redirectUrl || redirectUrl[0] === "/"))) {
                pageValues.numInternalClicks++;
            }
            return
        }
    }

    window.addEventListener("unload", (event) => {
        pageValues.reportResults(timing.fromMonotonicClock(event.timeStamp, true));
    });
};

waitForPageManagerLoad(serpScript)