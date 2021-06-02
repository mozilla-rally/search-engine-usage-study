/**
 * Content Scripts for DuckDuckGo SERP
 */
(async function () {
    const moduleName = "DuckDuckGo"
    /**
     * Determine whether the page is a web search results page
     */
    function determinePageIsCorrect(): void {
        pageIsCorrect = !!document.querySelector("#duckbar_static li:first-child .is-active, #duckbar_new .is-active") && !!getQueryVariable(window.location.href, "ia")
    }

    /**
     * @returns {Array} An array of all the organic results on the page
     */
    function getOrganicResults() {
        return Array.from(document.querySelectorAll("#links > div[id^='r1-']"));
    }

    /**
     * @returns {Array} An array of all the ad results on the page
     */
    function getAdResults() {
        return Array.from(document.querySelectorAll("#ads > div, .result--ad")).filter(adElement => {
            return !!adElement.innerHTML && adElement.querySelector(".badge--ad")
        });
    }

    function getIsAdLinkElement(adLinkElement: Element): boolean {
        return !!(adLinkElement as any).href && !adLinkElement.matches(
            '.report-ad, .report-ad *, .feedback-prompt, .feedback-prompt *, .badge--ad__tooltip, .badge--ad__tooltip *')
    }

    /**
     * Determine the height of the top of the search results area
     */
    function determineSearchAreaTopHeight(): void {
        try {
            searchAreaTopHeight = (document.querySelector("#header_wrapper") as HTMLElement).offsetHeight
        } catch (error) {
            searchAreaTopHeight = null
        }
    }

    /**
     * Determine the height of the bottom of the search results area
     */
    function determineSearchAreaBottomHeight(): void {
        try {
            const resultElements = document.querySelectorAll("#links > div:not(.js-result-hidden-el):not(.is-hidden):not(.result--more)")

            const element = resultElements[resultElements.length - 1] as HTMLElement
            searchAreaBottomHeight = element.offsetHeight + getElementTopHeight(element)
        } catch (error) {
            searchAreaBottomHeight = null
        }
    }

    /**
     * Determine the page number 
     * Note: DDG pagination occurs through continuous scroll rather than loading
     * a new page for each page of results
     */
    function determinePageNum(): void {
        const pageElement = getXPathElement("(//div[contains(@class, 'result__pagenum')])[last()]")
        if (pageElement) {
            pageNum = Number(pageElement.textContent)
        } else {
            pageNum = 1
        }
    }

    /**
     * Determine the page number of the given element
     */
    function getPageNumForElement(element: Element) {
        while (element) {
            if (element.classList.contains("has-pagenum")) {
                return Number(element.querySelector(".result__pagenum").textContent)
            }
            element = element.previousElementSibling
        }
        return 1
    }

    /**
     * @param {string} urlString - A url
     * @returns {boolean} Whether the url links to another page on the search engine
     */
    function isInternalLink(urlString: string): boolean {
        const url = new URL(urlString)
        return url.hostname.includes("duckduckgo.com")
    }

    const domObserver = new MutationObserver(function () {
        determinePageValues();
    });

    /**
     * Determine all the page values and send the query to the background page
     */
    function determinePageValues(): void {
        determinePageIsCorrect();

        if (pageIsCorrect) {
            determinePageNum();

            determineSearchAreaTopHeight();
            determineSearchAreaBottomHeight();

            determineOrganicElementsAndAddListeners(getOrganicResults(), getPageNumForElement);
            determineAdElementsAndAddListeners(getAdResults(), getIsAdLinkElement)

            addInternalClickListeners(
                ".result--more *, #ads > div *, .result--ad *, #links > div[id^='r1-'] *",
                isInternalLink,
                document.querySelectorAll("#zero_click_wrapper, #vertical_wrapper, #web_content_wrapper"));

            getAttributionDetailsFromBackground(moduleName);

            if (getQueryVariable(window.location.href, "q")) {
                sendQueryToBackground(moduleName, ["q"]);
            } else {
                const url = new URL(window.location.href)
                const query = decodeURIComponent(url.pathname.substr(1).replace(/_/g, " "));
                if (query) {
                    browser.runtime.sendMessage({ type: "SERPQuery", engine: moduleName, query: query });
                }
            }

            domObserver.disconnect();
            const container = document.querySelector("#links")
            if (container) {
                domObserver.observe(container, { childList: true });
            }
        }
    }

    window.addEventListener("DOMContentLoaded", function () {
        determinePageValues();
    });

    window.addEventListener("load", function () {
        determinePageValues();
        pageLoaded = true
    });

    function initPageManagerListenersDDG() {
        function initModuleDDG() {
            registerAttentionListener();
            webScience.pageManager.onPageVisitStart.addListener((timeStamp) => {
                if (!pageIsCorrect) {
                    reportResults();
                    timestamp = timeStamp;
                    resetAttentionTracking();
                }
                determinePageValues();
            });

            // In case we miss an initial pageVisitStart event
            if (webScience.pageManager.pageVisitStarted) {
                timestamp = webScience.pageManager.pageVisitStartTime
                resetAttentionTracking();
                determinePageValues();
            }
        }

        if (("webScience" in window) && ("pageManager" in window.webScience)) {
            initModuleDDG();
        }
        else {
            if (!("pageManagerHasLoaded" in window)) {
                window.pageManagerHasLoaded = [];
            }
            window.pageManagerHasLoaded.push(initModuleDDG);
        }
    }

    window.addEventListener("unload", () => {
        pageVisitEndListener();
    });

    isInternalLinkFunction = isInternalLink;
    initPageManagerListenersDDG();
    registerNewTabListener();
    registerModule(moduleName)
})()
