/**
 * Content Scripts for Yahoo SERP
 */

(async function () {
    const moduleName = "Yahoo"

    /**
     * Determine whether the page is a web search results page
     */
    function determinePageIsCorrect(): void {
        const url = new URL(window.location.href)
        pageIsCorrect = url.hostname === "search.yahoo.com" || url.hostname === "www.search.yahoo.com"
    }

    /**
     * @returns {Array} An array of all the organic results on the page
     */
    function getOrganicResults() {
        return Array.from(document.querySelectorAll("#web > .searchCenterMiddle > li > .algo"));
    }

    /**
     * @returns {Array} An array of all the ad results on the page
     */
    function getAdResults() {
        return Array.from(document.querySelectorAll("ol.searchCenterTopAds > li > .ads, ol.searchCenterBottomAds > li > .ads, ol.searchRightTopAds > li, ol.searchRightMiddleAds > li, ol.searchRightBottomAds > li"))
    }

    function getIsAdLinkElement(adLinkElement: Element): boolean {
        return !!(adLinkElement as any).href && !adLinkElement.matches('.p-abs,.p-abs *')
    }

    /**
     * Determine the height of the top of the search results area
     */
    function determineSearchAreaTopHeight(): void {
        const element = (document.querySelector("#ys") as HTMLElement)
        searchAreaTopHeight = element.offsetHeight + getElementTopHeight(element)
    }

    /**
     * Determine the height of the bottom of the search results area
     */
    function determineSearchAreaBottomHeight(): void {
        const element = (document.querySelector("#main") as HTMLElement)
        searchAreaBottomHeight = element.offsetHeight + getElementTopHeight(element)
    }

    /**
     * Determine the page number
     */
    function determinePageNum(): void {
        const pageElement = document.querySelector(".pages strong")
        if (pageElement) {
            pageNum = Number(pageElement.textContent)
        } else {
            pageNum = -1
        }
    }


    /**
     * @param {string} urlString - A url
     * @returns {boolean} Whether the url links to another page on the search engine
     */
    function isInternalLink(urlString: string): boolean {
        try {
            const url = new URL(urlString)
            if (url.hostname.includes("yahoo.com")) {
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
        determineAdElementsAndAddListeners(getAdResults(), getIsAdLinkElement);

        addInternalClickListeners(
            ".pagination *, #web > .searchCenterMiddle > li > .algo *, ol.searchCenterTopAds > li > .ads *, ol.searchCenterBottomAds > li > .ads *, ol.searchRightTopAds > li *, ol.searchRightMiddleAds > li *, ol.searchRightBottomAds > li *",
            isInternalLink,
            document.querySelectorAll("#bd"));

        getAttributionDetailsFromBackground(moduleName);

        if (pageIsCorrect) {
            sendQueryToBackground(moduleName, ["p", "q", "query"]);
        }
    }

    window.addEventListener("DOMContentLoaded", function () {
        determinePageValues();
    });

    window.addEventListener("load", function () {
        determinePageValues();
        pageLoaded = true
    });

    isInternalLinkFunction = isInternalLink;
    initPageManagerListeners();
    registerNewTabListener();
    registerModule(moduleName)
})()