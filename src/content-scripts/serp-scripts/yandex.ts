import { PageValues, getElementBottomHeight, getElementTopHeight, isValidLinkToDifferentPage, getNormalizedUrl, waitForPageManagerLoad, getXPathElements, ElementType } from "../common.js"
import { getQueryVariable, searchEnginesMetadata } from "../../Utils.js"
import { timing } from "@mozilla/web-science";

/**
 * Content Scripts for Yandex SERP
 */
const serpScript = function () {

    /**
     * @returns {boolean} Whether the page is a Yandex web SERP page.
     */
    function getIsWebSerpPage(): boolean {
        return searchEnginesMetadata["Yandex"].getIsSerpPage(window.location.href);
    }

    /**
     * @returns {OrganicDetail[]} An array of details for each of the organic search results.
     */
    function getOrganicDetailsAndLinkElements(): { organicDetails: OrganicDetail[], organicLinkElements: Element[][] } {
        // The organic results are .serp-item elements that have a descendant .organic element and do not have 
        // a descendant with an advertisement tag (an element with text "ad", "advertising", or "реклама")
        const organicResults = Array.from(document.querySelectorAll(".serp-item")).filter(element => {
            if (!element.querySelector(".organic")) {
                return false;
            }
            if (getXPathElements(`descendant::*[
                normalize-space(text()) = 'Реклама' or normalize-space(text()) = 'реклама' or
                normalize-space(text()) = 'Advertising' or normalize-space(text()) = 'advertising' or
                normalize-space(text()) = 'Ad' or normalize-space(text()) = 'ad' or
                normalize-space(text()) = 'Advertisement' or normalize-space(text()) = 'advertisement'
            ]`, element).length) {
                return false;
            }
            return true;
        });

        const organicDetails: OrganicDetail[] = []
        const organicLinkElements: Element[][] = [];
        for (const organicResult of organicResults) {
            // Get the details of all the organic elements.
            organicDetails.push({ topHeight: getElementTopHeight(organicResult), bottomHeight: getElementBottomHeight(organicResult), pageNum: null, onlineService: "" });

            // Get all the links (elements with an "href" attribute).
            organicLinkElements.push(Array.from(organicResult.querySelectorAll('[href]')));
        }
        return { organicDetails: organicDetails, organicLinkElements: organicLinkElements };
    }

    /**
     * @returns {number} The number of ad results on the page.
     */
    function getNumAdResults(): number {
        // The ad results are .serp-item elements that have a descendant 
        // with an advertisement tag.
        return Array.from(document.querySelectorAll(".serp-item")).filter(element => {
            if (getXPathElements(`descendant::*[
                normalize-space(text()) = 'Реклама' or normalize-space(text()) = 'реклама' or
                normalize-space(text()) = 'Advertising' or normalize-space(text()) = 'advertising' or
                normalize-space(text()) = 'Ad' or normalize-space(text()) = 'ad' or
                normalize-space(text()) = 'Advertisement' or normalize-space(text()) = 'advertisement'
            ]`, element).length) {
                return true;
            }
            return false;
        }).length;
    }

    /**
     * @returns {Element[]} An array of ad link elements on the page.
     */
    function getAdLinkElements(): Element[] {
        const adLinkElements: Element[] = [];

        // The organic results are .serp-item elements that have a descendant 
        // with an advertisement tag (an element with text "ad", "advertising", or "реклама")
        const adElements = Array.from(document.querySelectorAll(".serp-item")).filter(element => {
            if (getXPathElements(`descendant::*[
                normalize-space(text()) = 'Реклама' or normalize-space(text()) = 'реклама' or
                normalize-space(text()) = 'Advertising' or normalize-space(text()) = 'advertising' or
                normalize-space(text()) = 'Ad' or normalize-space(text()) = 'ad' or
                normalize-space(text()) = 'Advertisement' or normalize-space(text()) = 'advertisement'
            ]`, element).length) {
                return true;
            }
            return false;
        });

        for (const adElement of adElements) {
            // Get all the links (elements with an "href" attribute).
            adLinkElements.push(...adElement.querySelectorAll("[href]:not(.MissingWords *)"));
        }
        return adLinkElements;
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the top of the search area.
     */
    function getSearchAreaTopHeight(): number {
        try {
            return (document.querySelector(".serp-header") as HTMLElement).offsetHeight + (document.querySelector(".navigation") as HTMLElement).offsetHeight;
        } catch (error) {
            return null;
        }
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the bottom of the search area.
     */
    function getSearchAreaBottomHeight(): number {
        try {
            const contentElements = document.querySelectorAll(".main__content .content__left > *:not([class*='pager'])")
            const element = contentElements[contentElements.length - 1] as HTMLElement
            return element.offsetHeight + getElementTopHeight(element)
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
        if (target.matches(".main *")) {
            if (!target.matches(".pager *")) {
                const hrefElement = target.closest("[href]");
                if (hrefElement) {
                    const href = (hrefElement as any).href;
                    if (isValidLinkToDifferentPage(href)) {
                        const url = new URL(href);
                        if (url.hostname.includes("yandex.ru") || url.hostname.includes("yandex.com")) {
                            if (!url.hostname.includes("yabs.yandex")) {
                                return href;
                            }
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
        const normalizedRecentUrl: string = getNormalizedUrl(pageValues.mostRecentMousedown.Link)
        if (pageValues.mostRecentMousedown.Type === ElementType.Ad) {
            if (normalizedUrl.includes("yabs.yandex.ru") || normalizedRecentUrl.includes("yabs.yandex.ru") ||
                normalizedUrl === normalizedRecentUrl) {
                console.log("AD CLICK")
                pageValues.numAdClicks++;
            }
            return;
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Organic) {
            if (normalizedUrl === normalizedRecentUrl) {
                console.log("ORGANIC CLICK")
                pageValues.organicClicks.push({ ranking: pageValues.mostRecentMousedown.Ranking, attentionDuration: pageValues.getAttentionDuration(), pageLoaded: pageValues.pageLoaded })
            }
            return;
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Internal) {
            if (normalizedRecentUrl === normalizedUrl) {
                console.log("INTERNAL CLICK")
                pageValues.numInternalClicks++;
            }
            return;
        }
    }

    // Create a pageValues object to track data for the SERP page
    const pageValues = new PageValues("Yandex", onNewTab, getIsWebSerpPage, getPageNum, getSearchAreaBottomHeight, getSearchAreaTopHeight, getNumAdResults, getOrganicDetailsAndLinkElements, getAdLinkElements, getInternalLink);

    window.addEventListener("unload", (event) => {
        pageValues.reportResults(timing.fromMonotonicClock(event.timeStamp, true));
    });
};

waitForPageManagerLoad(serpScript)