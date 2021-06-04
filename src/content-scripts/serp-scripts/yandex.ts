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
        pageIsCorrect = !url.pathname.includes("direct")
    }

    /**
     * @returns {Array} An array of all the organic results on the page
     */
    function getOrganicResults() {
        return getXPathElements("//li[contains(@class, 'serp-item') and div[contains(@class, 'organic') and not(descendant::*[normalize-space(text()) = 'ad' or normalize-space(text()) = 'advertising' or normalize-space(text()) = 'реклама'])]]")
    }

    /**
     * @returns {Array} An array of all the ad results on the page
     */
    function getAdResults() {
        return getXPathElements("//li[contains(@class, 'serp-item') and descendant::*[normalize-space(text()) = 'ad' or normalize-space(text()) = 'advertising' or normalize-space(text()) = 'реклама']]");
    }

    /**
     * Determine the height of the top of the search results area
     */
    function determineSearchAreaTopHeight(): void {
        searchAreaTopHeight = (document.querySelector(".serp-header") as HTMLElement).offsetHeight + (document.querySelector(".navigation") as HTMLElement).offsetHeight
    }

    /**
     * Determine the height of the bottom of the search results area
     */
    function determineSearchAreaBottomHeight(): void {
        const contentElements = document.querySelectorAll(".main__content .content__left > *:not([class*='pager'])")
        const element = contentElements[contentElements.length - 1] as HTMLElement
        searchAreaBottomHeight = element.offsetHeight + getElementTopHeight(element)
    }

    /**
     * Determine the page number
     */
    function determinePageNum(): void {
        const url = webScience.pageManager.url
        const pageNumberFromUrl = getQueryVariable(url, "p");
        if (pageNumberFromUrl) {
            pageNum = Number(pageNumberFromUrl) + 1
        } else {
            pageNum = 1
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

        determineOrganicElementsAndAddListeners(getOrganicResults());
        determineAdElementsAndAddListeners(getAdResults());

        addInternalClickListeners(
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
        pageLoaded = true
    });

    window.addEventListener("unload", pageVisitEndListener);

    isInternalLinkFunction = isInternalLink;
    initPageManagerListeners(false);
    registerNewTabListener();
    registerModule(moduleName)
})()