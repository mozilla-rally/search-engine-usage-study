import * as Common from "../common.js"
/**
 * Content Scripts for Yandex SERP
 */

(async function () {
    const moduleName = "Yandex"

    /**
     * Determine whether the page is a web search results page
     */
    function determinePageIsCorrect(): void {
        const url = new URL(window.location.href)
        Common.setPageIsCorrect(!url.pathname.includes("direct"))
    }

    /**
     * @returns {Array} An array of all the organic results on the page
     */
    function getOrganicResults() {
        return Common.getXPathElements("//li[contains(@class, 'serp-item') and div[contains(@class, 'organic') and not(descendant::*[normalize-space(text()) = 'ad' or normalize-space(text()) = 'advertising' or normalize-space(text()) = 'реклама'])]]")
    }

    /**
     * @returns {Array} An array of all the ad results on the page
     */
    function getAdResults() {
        return Common.getXPathElements("//li[contains(@class, 'serp-item') and descendant::*[normalize-space(text()) = 'ad' or normalize-space(text()) = 'advertising' or normalize-space(text()) = 'реклама']]");
    }

    /**
     * Determine the height of the top of the search results area
     */
    function determineSearchAreaTopHeight(): void {
        Common.setSearchAreaTopHeight((document.querySelector(".serp-header") as HTMLElement).offsetHeight + (document.querySelector(".navigation") as HTMLElement).offsetHeight)
    }

    /**
     * Determine the height of the bottom of the search results area
     */
    function determineSearchAreaBottomHeight(): void {
        const contentElements = document.querySelectorAll(".main__content .content__left > *:not([class*='pager'])")
        const element = contentElements[contentElements.length - 1] as HTMLElement
        Common.setSearchAreaBottomHeight(element.offsetHeight + Common.getElementTopHeight(element))
    }

    /**
     * Determine the page number
     */
    function determinePageNum(): void {
        const url = webScience.pageManager.url
        const pageNumberFromUrl = Common.getQueryVariable(url, "p");
        if (pageNumberFromUrl) {
            Common.setPageNum(Number(pageNumberFromUrl) + 1)
        } else {
            Common.setPageNum(1)
        }
    }

    /**
     * @param {string} urlString - A url
     * @returns {boolean} Whether the url links to another page on the search engine
     */
    function isInternalLink(urlString: string): boolean {
        try {
            const url = new URL(urlString)
            if (url.hostname.includes("yandex.ru") || url.hostname.includes("yandex.com")) {
                return true
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
            ".pager  *, .serp-item > .organic *",
            isInternalLink,
            document.querySelectorAll(".main"));
    }

    window.addEventListener("DOMContentLoaded", function () {
        console.log("DOMContentLoaded")
        determinePageValues();
    });

    window.addEventListener("load", function () {
        determinePageValues();
        Common.setPageLoaded(true)
    });

    window.addEventListener("unload", Common.pageVisitEndListener);

    Common.initPageManagerListeners(false);
    Common.registerNewTabListener();
    Common.registerModule(moduleName)
})()