import { PageValues, getElementBottomHeight, getElementTopHeight, isValidLinkToDifferentPage, getNormalizedUrl, waitForPageManagerLoad, getXPathElements, ElementType } from "../common.js"
import { getQueryVariable } from "../../Utils.js"
import { timing } from "@mozilla/web-science";

/**
 * Content Scripts for Yandex SERP
 */
const serpScript = function () {
    // Create a pageValues object to track data for the SERP page
    const pageValues = new PageValues("Yandex", onNewTab, getIsWebSerpPage, getPageNum, getSearchAreaBottomHeight, getSearchAreaTopHeight, getNumAdResults, getOrganicDetailsAndLinkElements, getAdLinkElements, getInternalLink, null);

    /**
     * @returns {boolean} Whether the page is a Yandex web SERP page.
     */
    function getIsWebSerpPage(): boolean {
        const url = new URL(window.location.href);

        // Make sure the page is not a search for ads (ie. https://direct.yandex.com/search/?text=hello&lr=110509)
        return !url.pathname.includes("direct");
    }

    /**
     * @returns {OrganicDetail[]} An array of details for each of the organic search results.
     */
    function getOrganicDetailsAndLinkElements(): { details: OrganicDetail[], linkElements: Element[][] } {
        // The organic results are .serp-item elements that have a child .organic element and do not have 
        // a descendant with an advertisement tag (an element with text "ad", "advertising", or "реклама")
        const organicResults = getXPathElements("//li[contains(@class, 'serp-item') and div[contains(@class, 'organic') and not(descendant::*[normalize-space(text()) = 'ad' or normalize-space(text()) = 'advertising' or normalize-space(text()) = 'реклама'])]]");

        const organicDetails: OrganicDetail[] = []
        const organicLinkElements: Element[][] = [];
        for (const organicResult of organicResults) {
            // Get the details of all the organic elements.
            organicDetails.push({ TopHeight: getElementTopHeight(organicResult), BottomHeight: getElementBottomHeight(organicResult), PageNum: null });

            // Get all the links (elements with an "href" attribute).
            organicLinkElements.push(Array.from(organicResult.querySelectorAll('[href]')));
        }
        return { details: organicDetails, linkElements: organicLinkElements };
    }

    /**
     * @returns {number} The number of ad results on the page.
     */
    function getNumAdResults(): number {
        // The organic results are .serp-item elements that have a descendant 
        // with an advertisement tag (an element with text "ad", "advertising", or "реклама")
        return getXPathElements("//li[contains(@class, 'serp-item') and descendant::*[normalize-space(text()) = 'ad' or normalize-space(text()) = 'advertising' or normalize-space(text()) = 'реклама']]").length;
    }

    /**
     * @returns {Element[]} An array of ad link elements on the page.
     */
    function getAdLinkElements(): Element[] {
        const adLinkElements: Element[] = [];

        // The organic results are .serp-item elements that have a descendant 
        // with an advertisement tag (an element with text "ad", "advertising", or "реклама")
        const adElements = getXPathElements("//li[contains(@class, 'serp-item') and descendant::*[normalize-space(text()) = 'ad' or normalize-space(text()) = 'advertising' or normalize-space(text()) = 'реклама']]");

        for (const adElement of adElements) {
            // Get all the links (elements with an "href" attribute).
            adLinkElements.push(...adElement.querySelectorAll("[href]"));
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
            if (normalizedUrl.includes("yabs.yandex.ru") ||
                normalizedUrl === normalizedRecentUrl) {
                pageValues.numAdClicks++;
            }
            return;
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Organic) {
            if (normalizedUrl === normalizedRecentUrl) {
                pageValues.organicClicks.push({ Ranking: pageValues.mostRecentMousedown.Ranking, AttentionDuration: pageValues.getAttentionDuration(), PageLoaded: pageValues.pageLoaded })
            }
            return;
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Internal) {
            if (normalizedRecentUrl === normalizedUrl) {
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