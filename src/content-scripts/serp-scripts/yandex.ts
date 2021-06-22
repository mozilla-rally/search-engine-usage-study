import { PageValues, ElementType } from "../common.js"
import * as Utils from "../Utils.js"
import { timing } from "@mozilla/web-science";
/**
 * Content Scripts for Yandex SERP
 */
const serpModule = function () {
    const pageValues = new PageValues("Yandex", onNewTab);

    /**
     * Get whether the page is a basic SERP page.
     */
    function getPageIsCorrect(): boolean {
        const url = new URL(window.location.href)
        return !url.pathname.includes("direct")
    }

    function getOrganicDetails(): OrganicDetail[] {
        const organicResults = Utils.getXPathElements("//li[contains(@class, 'serp-item') and div[contains(@class, 'organic') and not(descendant::*[normalize-space(text()) = 'ad' or normalize-space(text()) = 'advertising' or normalize-space(text()) = 'реклама'])]]");
        const organicDetails: OrganicDetail[] = []
        for (const organicResult of organicResults) {
            organicDetails.push({ TopHeight: Utils.getElementTopHeight(organicResult), BottomHeight: Utils.getNextElementTopHeight(organicResult), PageNum: null })
        }
        return organicDetails;
    }

    function getOrganicLinkElements(): Element[][] {
        const organicResults = Utils.getXPathElements("//li[contains(@class, 'serp-item') and div[contains(@class, 'organic') and not(descendant::*[normalize-space(text()) = 'ad' or normalize-space(text()) = 'advertising' or normalize-space(text()) = 'реклама'])]]");
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
        return Utils.getXPathElements("//li[contains(@class, 'serp-item') and descendant::*[normalize-space(text()) = 'ad' or normalize-space(text()) = 'advertising' or normalize-space(text()) = 'реклама']]").length;
    }

    function getAdLinkElements(): Element[] {
        const adLinkElements: Element[] = [];
        const adElements = Utils.getXPathElements("//li[contains(@class, 'serp-item') and descendant::*[normalize-space(text()) = 'ad' or normalize-space(text()) = 'advertising' or normalize-space(text()) = 'реклама']]");
        adElements.forEach(adElement => {
            adLinkElements.push(...adElement.querySelectorAll("[href]"));
        });
        return adLinkElements;
    }

    /**
     * Get the number of pixels between the top of the page and the top of the search area.
     */
    function getSearchAreaTopHeight(): number {
        try {
            return (document.querySelector(".serp-header") as HTMLElement).offsetHeight + (document.querySelector(".navigation") as HTMLElement).offsetHeight;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get the number of pixels between the top of the page and the bottom of the search area.
     */
    function getSearchAreaBottomHeight(): number {
        try {
            const contentElements = document.querySelectorAll(".main__content .content__left > *:not([class*='pager'])")
            const element = contentElements[contentElements.length - 1] as HTMLElement
            return element.offsetHeight + Utils.getElementTopHeight(element)
        } catch (error) {
            return null;
        }

    }

    /**
     * Get the page number.
     */
    function getPageNum(): number {
        const pageNumFromUrl = Utils.getQueryVariable(window.location.href, "p");
        return pageNumFromUrl ? Number(pageNumFromUrl) + 1 : 1;
    }

    // Returns the href if it is an internal link
    // Returns empty string if the click was in the search area but there was no link
    // Returns null otherwise
    function getInternalLink(target: Element): string {
        if (target.matches(".main *")) {
            if (!target.matches(".pager *")) {
                const hrefElement = target.closest("[href]");
                if (hrefElement) {
                    const href = (hrefElement as any).href;
                    if (Utils.isLinkToDifferentPage(href)) {
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
        const normalizedRecentUrl: string = Utils.getNormalizedUrl(pageValues.mostRecentMousedown.href)
        if (pageValues.mostRecentMousedown.type === ElementType.Ad) {
            if (normalizedUrl.includes("yabs.yandex.ru") ||
                normalizedUrl === normalizedRecentUrl) {
                pageValues.numAdClicks++;
            }
            return;
        }
        if (pageValues.mostRecentMousedown.type === ElementType.Organic) {
            if (normalizedRecentUrl === normalizedUrl) {
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

    window.addEventListener("unload", (event) => {
        pageValues.reportResults(timing.fromMonotonicClock(event.timeStamp, true));
    });
};

Utils.waitForPageManagerLoad(serpModule)