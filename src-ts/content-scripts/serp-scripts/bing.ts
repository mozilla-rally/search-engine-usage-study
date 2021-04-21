/**
 * Content Scripts for Bing SERP
 */

(async function () {
    const moduleName = "Bing"

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
        return Array.from(document.querySelectorAll("#b_results > li.b_algo"));
    }

    /**
     * @returns {Array} An array of all the ad results on the page
     */
    function getAdResults() {
        return Array.from(document.querySelectorAll(".b_ad > ul > li, .b_adLastChild"))
    }

    /**
     * @param {string} adResults - an array of the ad results on the page
     * @returns {Array} An array of all the ad links in the ad results
     */
    function getAdLinks(adResults: Element[]): Element[] {
        const adLinks: Element[] = []
        for (const adResult of adResults) {
            adLinks.push(...adResult.querySelectorAll("[href]:not(.b_adinfo):not(.b_adinfo [href])"))
        }
        return adLinks
    }

    /**
     * Determine the height of the top of the search results area
     */
    function determineSearchAreaTopHeight(): void {
        searchAreaTopHeight = (document.querySelector("#b_header") as HTMLElement).offsetHeight
    }

    /**
     * Determine the height of the bottom of the search results area
     */
    function determineSearchAreaBottomHeight(): void {
        const element = (document.querySelector(".b_pag") as HTMLElement)
        searchAreaBottomHeight = getElementTopHeight(element)
    }

    /**
     * Determine the page number
     */
    function determinePageNum(): void {
        const pageElement = document.querySelector(".sb_pagS_bp")
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
            if (url.hostname.includes("bing.com")) {
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
        determineAdElementsAndAddListeners(getAdResults(), getAdLinks);

        addInternalClickListeners(
            ".b_pag *, #b_results > li.b_algo *, .b_ad > ul > li *, .b_adLastChild *",
            isInternalLink,
            document.querySelectorAll("#b_content"));

        getAttributionDetailsFromBackground(moduleName);

        if (pageIsCorrect) {
            sendQueryToBackground(moduleName, ["q"]);
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