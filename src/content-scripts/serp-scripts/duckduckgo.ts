import * as Common from "../common.js"
/**
 * Content Scripts for DuckDuckGo SERP
 */
(async function () {
    const moduleName = "DuckDuckGo"
    /**
     * Determine whether the page is a web search results page
     */
    function determinePageIsCorrect(): void {
        Common.setPageIsCorrect(!!document.querySelector("#duckbar_static li:first-child .is-active, #duckbar_new .is-active") && !!Common.getQueryVariable(window.location.href, "ia"))
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
            Common.setSearchAreaTopHeight((document.querySelector("#header_wrapper") as HTMLElement).offsetHeight)
        } catch (error) {
            Common.setSearchAreaTopHeight(null)
        }
    }

    /**
     * Determine the height of the bottom of the search results area
     */
    function determineSearchAreaBottomHeight(): void {
        try {
            const resultElements = document.querySelectorAll("#links > div:not(.js-result-hidden-el):not(.is-hidden):not(.result--more)")

            const element = resultElements[resultElements.length - 1] as HTMLElement
            Common.setSearchAreaBottomHeight(element.offsetHeight + Common.getElementTopHeight(element))
        } catch (error) {
            Common.setSearchAreaBottomHeight(null)
        }
    }

    /**
     * Determine the page number 
     * Note: DDG pagination occurs through continuous scroll rather than loading
     * a new page for each page of results
     */
    function determinePageNum(): void {
        const pageElement = Common.getXPathElement("(//div[contains(@class, 'result__pagenum')])[last()]")
        if (pageElement) {
            Common.setPageNum(Number(pageElement.textContent))
        } else {
            Common.setPageNum(1)
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

        if (Common.getPageIsCorrect()) {
            determinePageNum();

            determineSearchAreaTopHeight();
            determineSearchAreaBottomHeight();

            Common.determineOrganicElementsAndAddListeners(getOrganicResults(), getPageNumForElement);
            Common.determineAdElementsAndAddListeners(getAdResults(), getIsAdLinkElement)

            Common.addInternalClickListeners(
                ".result--more *, #ads > div *, .result--ad *, #links > div[id^='r1-'] *",
                isInternalLink,
                document.querySelectorAll("#zero_click_wrapper, #vertical_wrapper, #web_content_wrapper"));

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
        Common.setPageLoaded(true);
    });

    function initPageManagerListenersDDG() {
        function initModuleDDG() {
            Common.registerAttentionListener();
            webScience.pageManager.onPageVisitStart.addListener(() => {
                if (!Common.getPageIsCorrect()) {
                    Common.reportResults();
                    Common.resetAttentionTracking();
                }
                determinePageValues();
            });

            // In case we miss an initial pageVisitStart event
            if (webScience.pageManager.pageVisitStarted) {
                Common.resetAttentionTracking();
                determinePageValues();
            }
        }

        if (("webScience" in window) && ("pageManager" in window["webScience"])) {
            initModuleDDG();
        }
        else {
            if (!("pageManagerHasLoaded" in window)) {
                window["pageManagerHasLoaded"] = [];
            }
            window["pageManagerHasLoaded"].push(initModuleDDG);
        }
    }

    window.addEventListener("unload", () => {
        Common.pageVisitEndListener();
    });

    initPageManagerListenersDDG();
    Common.registerNewTabListener();
    Common.registerModule(moduleName)
})()
