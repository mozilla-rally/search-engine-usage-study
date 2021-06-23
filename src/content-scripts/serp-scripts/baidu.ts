import { PageValues } from "../common.js"
import * as Utils from "../Utils.js"

/**
 * Content Scripts for Baidu SERP
 */
const serpModule = function () {
    // Create a pageValues object to track data for the SERP page
    const pageValues = new PageValues("Baidu", onNewTab);

    /**
     * @returns {boolean} Whether the page is a Baidu web SERP page.
     */
    function getPageIsCorrect(): boolean {
        const url = new URL(window.location.href)
        if (url.hostname === "baidu.com" || url.hostname === "www.baidu.com") {
            if (window.location.pathname === "/s") {
                const tn = Utils.getQueryVariable(window.location.href, "tn")
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
    function getOrganicDetails(): OrganicDetail[] {
        const organicResults = document.querySelectorAll("#content_left > .result");
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
        const organicResults = document.querySelectorAll("#content_left > .result");
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
        return Utils.getXPathElements("//div[contains(@class, 'c-container') and descendant::*[normalize-space(text()) = 'advertising' or normalize-space(text()) = '广告' or normalize-space(text()) = '品牌广告' or normalize-space(text()) = 'brand advertisement']]").length;
    }

    /**
     * @returns {Element[]} An array of ad link elements on the page.
     */
    function getAdLinkElements(): Element[] {
        const adLinkElements: Element[] = [];
        const adElements = Utils.getXPathElements("//div[contains(@class, 'c-container') and descendant::*[normalize-space(text()) = 'advertising' or normalize-space(text()) = '广告' or normalize-space(text()) = '品牌广告' or normalize-space(text()) = 'brand advertisement']]");
        adElements.forEach(adElement => {
            adLinkElements.push(...Array.from(adElement.querySelectorAll("[href]")).filter(adLinkElement => {
                const href = (adLinkElement as any).href;
                return href && !href.includes("javascript");
            }));
        });
        return adLinkElements;
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the top of the search area.
     */
    function getSearchAreaTopHeight(): number {
        try {
            const element = (document.querySelector("#s_tab") as HTMLElement)
            return element.offsetHeight + Utils.getElementTopHeight(element)
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
            return element.offsetHeight + Utils.getElementTopHeight(element);
        } catch (error) {
            return null;
        }
    }

    /**
     * @returns {number} The page number.
     */
    function getPageNum(): number {
        const pageNumElement = document.querySelector("strong > .pc")
        return pageNumElement ? Number(pageNumElement.textContent) : -1;
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
                if (Utils.isValidLinkToDifferentPage(href)) {
                    const normalizedUrl = Utils.getNormalizedUrl(href);
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
     * Determines the page values and adds listeners
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

    /**
     * A callback that will be passed the string URL of new tabs opened from the page. It should
     * determine if the new tab corresponds with an ad click, organic click, or internal click.
     * @param {string} url - the url string of a new tab opened from the page.
     */
    function onNewTab(url: string) {
        if (!pageValues.mostRecentMousedown) {
            return;
        }
        const normalizedUrl: string = Utils.getNormalizedUrl(url);
        const normalizedRecentUrl: string = Utils.getNormalizedUrl(pageValues.mostRecentMousedown.href)
        if (pageValues.mostRecentMousedown.type === ElementType.Ad) {
            if (normalizedRecentUrl === normalizedUrl) {
                pageValues.numAdClicks++;
            }
            return;
        }
        if (pageValues.mostRecentMousedown.type === ElementType.Organic) {
            if ((pageValues.mostRecentMousedown.href === url) ||
                (normalizedUrl.includes("baidu.com/link") && normalizedRecentUrl.includes("baidu.com/link") &&
                    Utils.getQueryVariable(url, "url") === Utils.getQueryVariable(pageValues.mostRecentMousedown.href, "url"))) {
                pageValues.organicClicks.push({ Ranking: pageValues.mostRecentMousedown.index, AttentionDuration: pageValues.getAttentionDuration(), PageLoaded: pageValues.pageLoaded })
            }
            return;
        }
        if (pageValues.mostRecentMousedown.type === ElementType.Internal) {
            if (normalizedRecentUrl === normalizedUrl) {
                pageValues.numInternalClicks++;
            }
            return;
        }
    }

    window.addEventListener("DOMContentLoaded", function () {
        determinePageValues();
    });

    window.addEventListener("load", function () {
        determinePageValues();
        pageValues.pageLoaded = true;
    });

    // Observer that looks for the #wrapper_wrapper element that contains
    // page content
    const documentObserver = new MutationObserver(function (_, observer) {
        const container = document.querySelector("#wrapper_wrapper")
        if (container) {
            const domObserver = new MutationObserver(function () {
                determinePageValues();
            });
            const config = { childList: true };
            domObserver.observe(container, config);
            observer.disconnect()
        }
    });
    const bodyConfig = { childList: true, subtree: true };
    documentObserver.observe(document, bodyConfig);

    webScience.pageManager.onPageVisitStart.addListener(() => {
        pageValues.resetTracking();
        determinePageValues();
    });

    webScience.pageManager.onPageVisitStop.addListener(({ timeStamp }) => {
        pageValues.reportResults(timeStamp);
    });
};

Utils.waitForPageManagerLoad(serpModule)