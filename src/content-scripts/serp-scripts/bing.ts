import { PageValues, ElementType } from "../common.js"
import * as Utils from "../Utils.js"

/**
 * Content Scripts for Bing SERP
 */
const serpModule = function () {
    const pageValues = new PageValues("Bing", onNewTab);

    function getOrganicDetails(): OrganicDetail[] {
        const organicResults = document.querySelectorAll("#b_results > li.b_algo");
        const organicDetails: OrganicDetail[] = []
        for (const organicResult of organicResults) {
            organicDetails.push({ TopHeight: Utils.getElementTopHeight(organicResult), BottomHeight: Utils.getNextElementTopHeight(organicResult), PageNum: null })
        }
        return organicDetails;
    }

    function getOrganicLinkElements(): Element[][] {
        const organicResults = document.querySelectorAll("#b_results > li.b_algo");
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
        return document.querySelectorAll(".b_adSlug").length;
    }

    function getAdLinkElements(): Element[] {
        const adLinkElements: Element[] = [];

        // Add ad carousel links
        document.querySelectorAll(".adsMvCarousel").forEach(adElement => {
            if (adElement.parentElement.parentElement.querySelector(".b_adSlug")) {
                adLinkElements.push(...adElement.querySelectorAll(".slide:not(.see_more) [href]"));
            }
        });

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
     * Get the number of pixels between the top of the page and the top of the search area.
     */
    function getSearchAreaTopHeight(): number {
        try {
            return (document.querySelector("#b_header") as HTMLElement).offsetHeight;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get the number of pixels between the top of the page and the bottom of the search area.
     */
    function getSearchAreaBottomHeight(): number {
        try {
            const element = (document.querySelector(".b_pag") as HTMLElement)
            return Utils.getElementTopHeight(element)
        } catch (error) {
            return null;
        }
    }

    /**
     * Get the page number.
     */
    function getPageNum(): number {
        const pageElement = document.querySelector(".sb_pagS_bp")
        if (pageElement) {
            return Number(pageElement.textContent);
        } else {
            return -1;
        }
    }

    // Returns the href if it is an internal link
    // Returns empty string if the click was in the search area but there was no link
    // Returns null otherwise
    function getInternalLink(target: Element): string {
        if (target.matches("#b_content *")) {
            if (!target.matches(".b_pag *, #b_results > li.b_algo *, .b_ad > ul > li *, .b_adLastChild *")) {
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

    webScience.pageManager.onPageVisitStop.addListener(({ timeStamp }) => {
        pageValues.reportResults(timeStamp);
    });
};

Utils.waitForPageManagerLoad(serpModule)