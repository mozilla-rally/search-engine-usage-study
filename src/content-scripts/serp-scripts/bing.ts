import { PageValues, getElementBottomHeight, getElementTopHeight, isValidLinkToDifferentPage, getNormalizedUrl, waitForPageManagerLoad, ElementType } from "../common.js"
import { getQueryVariable, searchEnginesMetadata } from "../../Utils.js"
import { timing } from "@mozilla/web-science";

/**
 * Content Scripts for Bing SERP
 */
const serpScript = function () {

    /**
    * @returns {boolean} Whether the page is a Bing web SERP page.
    */
    function getIsWebSerpPage(): boolean {
        // The content script match pattern handles this.
        return searchEnginesMetadata["Bing"].getIsSerpPage(window.location.href);
    }

    /**
     * @returns {OrganicDetail[]} An array of details for each of the organic search results.
     */
    function getOrganicDetailsAndLinkElements(): { organicDetails: OrganicDetail[], organicLinkElements: Element[][] } {
        try {
            const organicResults = document.querySelectorAll("#b_results > li.b_algo");
            const organicDetails: OrganicDetail[] = []
            const organicLinkElements: Element[][] = [];
            for (const organicResult of organicResults) {
                organicDetails.push({ topHeight: getElementTopHeight(organicResult), bottomHeight: getElementBottomHeight(organicResult), pageNum: null, onlineService: "" })
                organicLinkElements.push(Array.from(organicResult.querySelectorAll('[href]')).filter(element => {
                    // Exclude links in the "Explore Further" box (.pageRecoContainer) and any missing word links (.wr_hlic)
                    return !element.closest(".pageRecoContainer") && !element.closest(".wr_hlic");
                }));
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
            return document.querySelectorAll(".b_adSlug").length;
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
        } catch (error) {
            return [];
        }
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the top of the search area.
     */
    function getSearchAreaTopHeight(): number {
        try {
            return (document.querySelector("#b_header") as HTMLElement).offsetHeight;
        } catch (error) {
            return -1;
        }
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the bottom of the search area.
     */
    function getSearchAreaBottomHeight(): number {
        try {
            const element = (document.querySelector(".b_pag") as HTMLElement);
            return getElementTopHeight(element);
        } catch (error) {
            return -1;
        }
    }

    /**
     * @returns {number} The page number.
     */
    function getPageNum(): number {
        try {
            const pageElement = document.querySelector(".sb_pagS_bp")
            return Number(pageElement.textContent);
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
            const element = document.querySelector(".sb_count");

            if (document.querySelector(".b_no")) {
                return 0;
            } else if (!element) {
                return null;
            } else {
                // Format of string on Bing is "6,930,000,000 Results" or "11-24 Of 359,000 Results"
                let sentence = element.textContent.replace(/[.,\s]/g, '');

                // Removes the "-" and surrounding numerical characters.
                sentence = element.textContent.replace(/\d*-\d*/g, '');

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
            // Make sure the target is in the search area
            if (target.matches("#b_content *")) {
                // Make sure the target is not a pagination element, organic element, or ad element
                if (!target.matches(".b_pag *")) {
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
        // If a mousedown has not been recorded on an ad, organic, or internal element then return
        if (!pageValues.mostRecentMousedown) {
            return;
        }

        const normalizedUrl: string = getNormalizedUrl(url);

        // If the URL is for a redirect, get the URL it redirects to.
        // Sometimes this redirect URL is encoded in Base 64.
        let redirectUrl = null;
        let redirectUrlBase64 = null;
        if (normalizedUrl.includes("bing.com/newtabredir")) {
            redirectUrl = getQueryVariable(url, "url")
            try {
                redirectUrlBase64 = atob(getQueryVariable(url, "url"));
            } catch (error) {
                // Do nothing
            }
        }

        if (pageValues.mostRecentMousedown.Type === ElementType.Ad) {
            if (normalizedUrl.includes("bing.com/aclk") ||
                pageValues.mostRecentMousedown.Link === url ||
                (redirectUrl && pageValues.mostRecentMousedown.Link === redirectUrl) ||
                (redirectUrlBase64 && pageValues.mostRecentMousedown.Link === redirectUrlBase64)) {
                if (__ENABLE_DEVELOPER_MODE__) {
                    console.log("Ad Click");
                }
                pageValues.numAdClicks++;
            }
            return;
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Organic) {
            if (pageValues.mostRecentMousedown.Link === url ||
                (redirectUrl && pageValues.mostRecentMousedown.Link === redirectUrl) ||
                (redirectUrlBase64 && pageValues.mostRecentMousedown.Link === redirectUrlBase64)) {
                if (__ENABLE_DEVELOPER_MODE__) {
                    console.log("Organic Click");
                }
                pageValues.organicClicks.push({ ranking: pageValues.mostRecentMousedown.Ranking, attentionDuration: pageValues.getAttentionDuration(), pageLoaded: pageValues.pageLoaded })
            }
            return
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Internal) {
            if ((pageValues.mostRecentMousedown.Link === url && normalizedUrl.includes("bing.com") && !normalizedUrl.includes("bing.com/newtabredir") && !normalizedUrl.includes("bing.com/aclk")) ||
                (redirectUrl && (pageValues.mostRecentMousedown.Link === redirectUrl || redirectUrl[0] === "/")) ||
                (redirectUrlBase64 && (pageValues.mostRecentMousedown.Link === redirectUrlBase64 || redirectUrlBase64[0] === "/"))) {
                if (__ENABLE_DEVELOPER_MODE__) {
                    console.log("Internal Click");
                }
                pageValues.numInternalClicks++;
            }
            return
        }
    }

    // Create a pageValues object to track data for the SERP page
    const pageValues = new PageValues("Bing", onNewTab, getIsWebSerpPage, getPageNum, getSearchAreaBottomHeight, getSearchAreaTopHeight, getNumAdResults, getOrganicDetailsAndLinkElements, getAdLinkElements, getInternalLink, null, null, null, getNumResults);

    webScience.pageManager.onPageVisitStart.addListener(({ timeStamp }) => {
        const newPageIsCorrect = getIsWebSerpPage();

        // Bing sometimes uses the History API when navigating between pages (e.g., when clicking on the "See more results"
        // button on a maps result). This ensures we report when such a navigation occurs.
        if (pageValues.isWebSerpPage && !newPageIsCorrect) {
            pageValues.reportResults(timeStamp);
        }

        if (!pageValues.isWebSerpPage && newPageIsCorrect) {
            pageValues.resetTracking(timeStamp);
        }
        pageValues.determinePageValues();
    });

    window.addEventListener("unload", (event) => {
        pageValues.reportResults(timing.fromMonotonicClock(event.timeStamp, true));
    });
};

waitForPageManagerLoad(serpScript)