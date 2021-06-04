/**
 * Content Scripts for Baidu SERP
 */

(async function () {
    const moduleName = "Baidu"

    /**
     * Determine whether the page is a web search results page
     */
    function determinePageIsCorrect(): void {
        const url = new URL(window.location.href)
        if (url.hostname === "baidu.com" || url.hostname === "www.baidu.com") {
            const tn = getQueryVariable(window.location.href, "tn")
            if (!tn || (tn === "baidu")) {
                pageIsCorrect = true
                return
            }
        }
        pageIsCorrect = false

    }

    /**
     * @returns {Array} An array of all the organic results on the page
     */
    function getOrganicResults() {
        return Array.from(document.querySelectorAll("#content_left > .result"));
    }

    /**
     * @returns {Array} An array of all the ad results on the page
     */
    function getAdResults() {
        return getXPathElements("//div[contains(@class, 'c-container') and descendant::*[normalize-space(text()) = 'advertising' or normalize-space(text()) = '广告' or normalize-space(text()) = '品牌广告' or normalize-space(text()) = 'brand advertisement']]")
    }

    /**
     * @param {string} adResults - an array of the ad results on the page
     * @returns {Array} An array of all the ad links in the ad results
     */
    function getIsAdLinkElement(adLinkElement: Element): boolean {
        const adLink = (adLinkElement as any).href
        return adLink && !adLink.includes("javascript")
    }

    /**
     * Determine the height of the top of the search results area
     */
    function determineSearchAreaTopHeight(): void {
        const element = (document.querySelector("#s_tab") as HTMLElement)
        searchAreaTopHeight = element.offsetHeight + getElementTopHeight(element)
    }

    /**
     * Determine the height of the bottom of the search results area
     */
    function determineSearchAreaBottomHeight(): void {
        const element = (document.querySelector("#container") as HTMLElement)
        searchAreaBottomHeight = element.offsetHeight + getElementTopHeight(element)
    }

    /**
     * Determine the page number
     */
    function determinePageNum(): void {
        const pageNumElement = document.querySelector("strong > .pc")
        pageNum = pageNumElement ? Number(pageNumElement.textContent) : -1;
    }

    /**
     * @param {string} urlString - A url
     * @returns {boolean} Whether the url links to another page on the search engine
     */
    function isInternalLink(urlString: string): boolean {
        try {
            const url = new URL(urlString)
            if (url.hostname.includes("baidu.com")) {
                if (urlString.includes("baidu.com/other.php")) {
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
        determineSearchAreaBottomHeight();

        determineOrganicElementsAndAddListeners(getOrganicResults());
        determineAdElementsAndAddListeners(getAdResults(), getIsAdLinkElement)

        addInternalClickListeners(
            "#content_left > .result *",
            isInternalLink,
            document.querySelectorAll("#container"));

        getAttributionDetailsFromBackground(moduleName);
    }

    const bodyObserver = new MutationObserver(function (_, observer) {
        const container = document.querySelector("#wrapper_wrapper")
        if (container) {
            const domObserver = new MutationObserver(function () {
                determinePageValues();
            });
            const config = { childList: true };
            domObserver.observe(container, config);
            observer.disconnect()
            console.log("tracking")
        }
    });
    const bodyConfig = { childList: true, subtree: true };
    bodyObserver.observe(document, bodyConfig);



    // TODO: do we need this?
    webScience.pageManager.onPageVisitStart.addListener(() => {
        console.debug("We hit this")
        determinePageValues();
    });

    isInternalLinkFunction = isInternalLink;
    initPageManagerListeners();
    registerNewTabListener();
    registerModule(moduleName)
})()