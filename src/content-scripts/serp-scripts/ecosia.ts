/**
 * Content Scripts for Ecosia SERP
 */

(async function () {
    const moduleName = "Ecosia"

    /**
     * Determine whether the page is a web search results page
     */
    function determinePageIsCorrect(): void {
        // Don't need to determine if it is web search, this is handled by
        // content script URL matching
        pageIsCorrect = true
    }

    /**
     * @returns {Array} An array of all the organic results on the page
     */
    function getOrganicResults() {
        return Array.from(document.querySelectorAll("div.card-web > div.result"));
    }

    /**
     * @returns {Array} An array of all the ad results on the page
     */
    function getAdResults() {
        return Array.from(document.querySelectorAll(".card-ad > div, .card-productads > div"));
    }

    function getIsAdLinkElement(adLinkElement: Element): boolean {
        return !!(adLinkElement as any).href && !adLinkElement.matches('.ad-hint-wrapper, .ad-hint-wrapper *')
    }

    /**
     * Determine the height of the top of the search results area
     */
    function determineSearchAreaTopHeight(): void {
        const element = document.querySelector(".navbar-row") as HTMLElement
        searchAreaTopHeight = element.offsetHeight + getElementTopHeight(element)
    }

    /**
     * Determine the height of the bottom of the search results area
     */
    function determineSearchAreaBottomHeight(): void {
        const element = document.querySelector(".pagination").previousElementSibling as HTMLElement
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
        const url = new URL(urlString)
        return url.hostname.includes("ecosia.org")
    }

    /**
     * Determine all the page values and send the query to the background page
     */
    function determinePageValues(): void {
        console.debug("DETERMINING")
        determinePageIsCorrect();
        determinePageNum();

        determineSearchAreaTopHeight()
        determineSearchAreaBottomHeight()

        determineOrganicElementsAndAddListeners(getOrganicResults());
        determineAdElementsAndAddListeners(getAdResults(), getIsAdLinkElement);

        addInternalClickListeners(
            ".pagination *, div.card-web > div.result *, .card-ad > div, .card-productads > div *",
            isInternalLink,
            document.querySelectorAll(".results-wrapper"))
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