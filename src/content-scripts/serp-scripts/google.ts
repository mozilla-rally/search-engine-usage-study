import { PageValues } from "../common.js"
import * as Utils from "../Utils.js"

/**
 * Content Scripts for Google SERP
 */
const serpModule = function () {
    // Create a pageValues object to track data for the SERP page
    const pageValues = new PageValues("Google", onNewTab);

    /**
     * @returns {boolean} Whether the page is a Google web SERP page.
     */
    function getPageIsCorrect(): boolean {
        const tbm = Utils.getQueryVariable(window.location.href, "tbm")
        if (!tbm) {
            const tbs = Utils.getQueryVariable(window.location.href, "tbs")
            if (!tbs || tbs.startsWith("qdr") || tbs.startsWith("li") || tbs.startsWith("cdr")) {
                return true;
            }
        }
        return false;
    }

    /**
     * @returns {OrganicDetail[]} An array of details for each of the organic search results.
     */
    function getOrganicDetails(): OrganicDetail[] {
        const organicResults = document.querySelectorAll("div[class='g']:not(.related-question-pair div[class='g'])");
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
        const organicResults = document.querySelectorAll("div[class='g']:not(.related-question-pair div[class='g'])");
        const organicLinkElements: Element[][] = []
        for (const organicResult of organicResults) {
            organicLinkElements.push(Array.from(organicResult.querySelectorAll('[href]:not(.exp-c *)')));
        }
        return organicLinkElements;
    }

    /**
     * @returns {number} The number of ad results on the page.
     */
    function getNumAdResults(): number {
        // gets all basic keyword ads
        const keywordAds = document.querySelectorAll("[aria-label='Ads'] > div")

        // gets all text tags on page that are "Ad" or "Ads"
        const adTagElements = Utils.getXPathElements("//*[(normalize-space(text()) = 'Ad' or normalize-space(text()) = 'Ads') and not(ancestor::*[@aria-label='Ads'])]/../../../../..");

        // Creates a list from the non-keyword ads making sure that none of these non-keyword ads contain each other.
        // Is necessary because some ads on Google contain multiple ad tags
        const nonKeywordAds: Element[] = []
        for (let i = 0; i < adTagElements.length; i++) {
            let add = true
            for (let j = i + 1; j < adTagElements.length; j++) {
                if (adTagElements[i].contains(adTagElements[j]) || adTagElements[j].contains(adTagElements[i])) {
                    add = false
                    break;
                }
            }
            if (add === true) {
                nonKeywordAds.push(adTagElements[i])
            }
        }

        return nonKeywordAds.length + keywordAds.length;
    }

    /**
     * @returns {Element[]} An array of ad link elements on the page.
     */
    function getAdLinkElements(): Element[] {
        // gets all basic keyword ads
        const keywordAds = document.querySelectorAll("[aria-label='Ads'] > div")

        // gets all text tags on page that are "Ad" or "Ads" but not within an [aria-label='Ads'] element
        const adTagElements = Utils.getXPathElements("//*[(normalize-space(text()) = 'Ad' or normalize-space(text()) = 'Ads') and not(ancestor::*[@aria-label='Ads'])]/../../../../..");

        // Creates a list from the non-keyword ads making sure that none of these non-keyword ads contain each other.
        // Is necessary because some ads on Google contain multiple ad tags
        const nonKeywordAds: Element[] = []
        for (let i = 0; i < adTagElements.length; i++) {
            let add = true
            for (let j = i + 1; j < adTagElements.length; j++) {
                if (adTagElements[i].contains(adTagElements[j]) || adTagElements[j].contains(adTagElements[i])) {
                    add = false
                    break;
                }
            }
            if (add === true) {
                nonKeywordAds.push(adTagElements[i])
            }
        }

        const adLinkElements: Element[] = [];
        const adResults = Array.from(keywordAds).concat(nonKeywordAds);
        adResults.forEach(adResult => {
            adLinkElements.push(...Array.from(adResult.querySelectorAll("[href]")).filter(hrefElement => {
                return !Utils.getNormalizedUrl((hrefElement as any).href).includes("google.com/search");
            }));
        });

        return adLinkElements;
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the top of the search area.
     */
    function getSearchAreaTopHeight(): number {
        try {
            const element = (document.querySelector("#top_nav") as HTMLElement)
            return element.offsetHeight + Utils.getElementTopHeight(element);
        } catch (error) {
            return null;
        }

    }

    /**
     * @returns {number} The number of pixels between the top of the page and the bottom of the search area.
     */
    function getSearchAreaBottomHeight(): number {
        try {
            let element = document.querySelector("#botstuff") as HTMLElement
            if (element.offsetHeight !== 0) {
                return element.offsetHeight + Utils.getElementTopHeight(element)
            }

            element = document.querySelector("#bottomads") as HTMLElement
            if (element.offsetHeight !== 0) {
                return element.offsetHeight + Utils.getElementTopHeight(element);
            }

            element = document.querySelector("#res") as HTMLElement
            return element.offsetHeight + Utils.getElementTopHeight(element);
        } catch (error) {
            return null;
        }

    }

    /**
     * @returns {number} The page number.
     */
    function getPageNum(): number {
        const pageElement = Utils.getXPathElement("//div[@role='navigation']//tbody/tr/td[normalize-space(text())]")
        return pageElement ? Number(pageElement.textContent) : -1;
    }

    /**
     * @param {Element} target - the target of a click event.
     * @returns {string} A link if the target was an internal link element in the search area.
     * An empty string if it was a possible internal link element. null otherwise.
     */
    function getInternalLink(target: Element): string {
        if (target.matches("#rcnt *, #appbar *, #atvcap *")) {
            if (!target.matches("[role=navigation] *")) {
                const hrefElement = target.closest("[href]");
                if (hrefElement) {
                    const href = (hrefElement as any).href;
                    if (Utils.isValidLinkToDifferentPage(href)) {
                        const url = new URL(href);
                        if (url.hostname.includes("google.com")) {
                            if (url.pathname === "/url") {
                                const newUrlString = Utils.getQueryVariable(href, "url");
                                const newUrl = new URL(newUrlString)
                                if (newUrl.hostname.includes("google.com")) {
                                    return newUrlString;
                                }
                            } else if (url.pathname.includes("/aclk")) {
                                return null;
                            } else {
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
        let redirectUrl = null;
        if (normalizedUrl.includes("google.com/url")) {
            redirectUrl = Utils.getQueryVariable(url, "url")
        }
        if (pageValues.mostRecentMousedown.type === ElementType.Ad) {
            if (normalizedUrl.includes("googleadservices.com/pagead") ||
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
                (redirectUrl && (pageValues.mostRecentMousedown.href === redirectUrl || redirectUrl[0] === "/") ||
                    normalizedUrl.includes("google.com/search"))) {
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

    webScience.pageManager.onPageVisitStart.addListener(() => {
        pageValues.resetTracking();
        determinePageValues();
    });

    webScience.pageManager.onPageVisitStop.addListener(({ timeStamp }) => {
        pageValues.reportResults(timeStamp);
    });
};

Utils.waitForPageManagerLoad(serpModule)