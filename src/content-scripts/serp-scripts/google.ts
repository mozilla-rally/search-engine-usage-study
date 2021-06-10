import * as Common from "../common.js"

/**
 * Content Scripts for Google SERP
 */

(async function () {
    const moduleName = "Google"

    /**
     * Determine whether the page is a web search results page
     */
    function determinePageIsCorrect(): void {
        const tbm = Common.getQueryVariable(window.location.href, "tbm")
        if (!tbm) {
            const tbs = Common.getQueryVariable(window.location.href, "tbs")
            if (!tbs || tbs.startsWith("qdr") || tbs.startsWith("li") || tbs.startsWith("cdr")) {
                Common.setPageIsCorrect(true)
                return
            }
        }
        Common.setPageIsCorrect(false)
    }

    /**
     * @returns {Array} An array of all the organic results on the page
     */
    function getOrganicResults() {
        return Array.from(document.querySelectorAll("div[class='g']:not(.related-question-pair div[class='g'])"))
    }

    /**
     * @returns {Array} An array of all the ad results on the page
     */
    function getAdResults() {
        // gets all basic keyword ads
        const keywordAds = document.querySelectorAll("[aria-label='Ads'] > div")

        // gets all text tags on page that are "Ad" or "Ads"
        const adTagElements = Common.getXPathElements("//*[(normalize-space(text()) = 'Ad' or normalize-space(text()) = 'Ads') and not(ancestor::*[@aria-label='Ads'])]/../../../../..");

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

        return Array.from(keywordAds).concat(nonKeywordAds)
    }

    /**
     * Determine the height of the top of the search results area
     */
    function determineSearchAreaTopHeight(): void {
        const element = (document.querySelector("#top_nav") as HTMLElement)
        Common.setSearchAreaTopHeight(element.offsetHeight + Common.getElementTopHeight(element))
    }

    /**
     * Determine the height of the bottom of the search results area
     */
    function determineSearchAreaBottomHeight(): void {
        let element = document.querySelector("#botstuff") as HTMLElement
        if (element.offsetHeight !== 0) {
            Common.setSearchAreaBottomHeight(element.offsetHeight + Common.getElementTopHeight(element))
            return
        }

        element = document.querySelector("#bottomads") as HTMLElement
        if (element.offsetHeight !== 0) {
            Common.setSearchAreaBottomHeight(element.offsetHeight + Common.getElementTopHeight(element))
            return
        }

        element = document.querySelector("#res") as HTMLElement
        Common.setSearchAreaBottomHeight(element.offsetHeight + Common.getElementTopHeight(element))
    }

    /**
     * Determine the page number
     */
    function determinePageNum(): void {
        const pageElement = Common.getXPathElement("//div[@role='navigation']//tbody/tr/td[normalize-space(text())]")
        if (pageElement) {
            Common.setPageNum(Number(pageElement.textContent))
        } else {
            Common.setPageNum(-1)
        }
    }

    /**
     * @param {string} urlString - A url
     * @returns {boolean} Whether the url links to another page on the search engine
     */
    function isInternalLink(urlString: string): boolean {
        try {
            const url = new URL(urlString)
            if (url.hostname.includes("google.com")) {
                if (urlString.includes("google.com/url")) {
                    const newUrlString = Common.getQueryVariable(urlString, "url")
                    const newUrl = new URL(newUrlString)
                    return newUrl.hostname.includes("google.com")
                } else if (urlString.includes("google.com/aclk")) {
                    return false
                } else {
                    return true
                }
            } else {
                return false
            }
        } catch (error) {
            return false
        }
    }

    /**
     * Determine all the page values and send the query to the background page
     */
    function determinePageValues(): void {
        determinePageIsCorrect();
        determinePageNum();
        determineSearchAreaTopHeight()
        determineSearchAreaBottomHeight()
        Common.determineOrganicElementsAndAddListeners(getOrganicResults());
        Common.determineAdElementsAndAddListeners(getAdResults());

        Common.addInternalClickListeners(
            "[role=navigation] *, div[class='g']:not(.related-question-pair div[class='g']) *",
            isInternalLink,
            document.querySelectorAll("#rcnt, #appbar, #atvcap"));
    }

    window.addEventListener("DOMContentLoaded", function () {
        determinePageValues();
    });

    window.addEventListener("load", function () {
        determinePageValues();
        Common.setPageLoaded(true)
    });

    Common.initPageManagerListeners();
    Common.registerNewTabListener();
    Common.registerModule(moduleName)
})()

console.log("GOOGLE")