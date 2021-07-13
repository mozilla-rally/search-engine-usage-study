import { PageValues, getElementBottomHeight, getElementTopHeight, isValidLinkToDifferentPage, getNormalizedUrl, waitForPageManagerLoad, getXPathElements, ElementType } from "../common.js"
import { getQueryVariable } from "../../Utils.js"

/**
 * Content Scripts for Baidu SERP
 */
const serpScript = function () {
    // Create a pageValues object to track data for the SERP page
    const pageValues = new PageValues("Baidu", onNewTab, getIsWebSerpPage, getPageNum, getSearchAreaBottomHeight, getSearchAreaTopHeight, getNumAdResults, getOrganicDetailsAndLinkElements, getAdLinkElements, getInternalLink, null);

    /**
     * @returns {boolean} Whether the page is a Baidu web SERP page.
     */
    function getIsWebSerpPage(): boolean {
        const url = new URL(window.location.href)
        if (url.hostname === "baidu.com" || url.hostname === "www.baidu.com") {
            if (window.location.pathname === "/s") {
                const tn = getQueryVariable(window.location.href, "tn")
                if (!tn || (tn === "baidu")) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * @returns {OrganicDetail[]} An array of details for each of the organic search results.
     */
    function getOrganicDetailsAndLinkElements(): { details: OrganicDetail[], linkElements: Element[][] } {
        const organicResults = document.querySelectorAll("#content_left > .result");
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
        return getXPathElements("//div[contains(@class, 'c-container') and descendant::*[normalize-space(text()) = 'advertising' or normalize-space(text()) = '广告' or normalize-space(text()) = '品牌广告' or normalize-space(text()) = 'brand advertisement']]").length;
    }

    /**
     * @returns {Element[]} An array of ad link elements on the page.
     */
    function getAdLinkElements(): Element[] {
        const adLinkElements: Element[] = [];
        const adElements = getXPathElements("//div[contains(@class, 'c-container') and descendant::*[normalize-space(text()) = 'advertising' or normalize-space(text()) = '广告' or normalize-space(text()) = '品牌广告' or normalize-space(text()) = 'brand advertisement']]");
        for (const adElement of adElements) {
            adLinkElements.push(...Array.from(adElement.querySelectorAll("[href]")).filter(adLinkElement => {
                const href = (adLinkElement as any).href;
                return href && !href.includes("javascript");
            }));
        }
        return adLinkElements;
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the top of the search area.
     */
    function getSearchAreaTopHeight(): number {
        try {
            const element = (document.querySelector("#s_tab") as HTMLElement)
            return element.offsetHeight + getElementTopHeight(element)
        } catch (error) {
            return null;
        }
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the bottom of the search area.
     */
    function getSearchAreaBottomHeight(): number {
        try {
            const element = (document.querySelector("#container") as HTMLElement)
            return element.offsetHeight + getElementTopHeight(element);
        } catch (error) {
            return null;
        }
    }

    /**
     * @returns {number} The page number.
     */
    function getPageNum(): number {
        const pageNumElement = document.querySelector("strong > .pc")
        return Number(pageNumElement.textContent);
    }

    /**
     * @param {Element} target - the target of a click event.
     * @returns {string} A link if the target was an internal link element in the search area.
     * An empty string if it was a possible internal link element. null otherwise.
     */
    function getInternalLink(target: Element): string {
        if (target.matches("#container *")) {
            const hrefElement = target.closest("[href]");
            if (hrefElement) {
                const href = (hrefElement as any).href;
                if (isValidLinkToDifferentPage(href)) {
                    const normalizedUrl = getNormalizedUrl(href);
                    if (normalizedUrl.includes("baidu.com") &&
                        !normalizedUrl.includes("baidu.com/link") &&
                        !normalizedUrl.includes("baidu.com/baidu.php")) {
                        return href
                    }
                } else {
                    return "";
                }
            } else {
                return "";
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
            if (normalizedRecentUrl === normalizedUrl) {
                pageValues.numAdClicks++;
            }
            return;
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Organic) {
            if ((pageValues.mostRecentMousedown.Link === url) ||
                (normalizedUrl.includes("baidu.com/link") && normalizedRecentUrl.includes("baidu.com/link") &&
                    getQueryVariable(url, "url") === getQueryVariable(pageValues.mostRecentMousedown.Link, "url"))) {
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

    // Observer that looks for the #wrapper_wrapper element that contains
    // page content
    const documentObserver = new MutationObserver(function (_, observer) {
        const container = document.querySelector("#wrapper_wrapper")
        if (container) {
            const domObserver = new MutationObserver(function () {
                pageValues.determinePageValues();
            });
            const config = { childList: true };
            domObserver.observe(container, config);
            observer.disconnect()
        }
    });
    const bodyConfig = { childList: true, subtree: true };
    documentObserver.observe(document, bodyConfig);

    webScience.pageManager.onPageVisitStart.addListener(({ timeStamp }) => {
        pageValues.resetTracking(timeStamp);
        pageValues.determinePageValues();
    });

    webScience.pageManager.onPageVisitStop.addListener(({ timeStamp }) => {
        pageValues.reportResults(timeStamp);
    });
};

waitForPageManagerLoad(serpScript)