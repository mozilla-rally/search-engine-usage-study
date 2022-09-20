import { PageValues, getElementBottomHeight, getElementTopHeight, isValidLinkToDifferentPage, getNormalizedUrl, waitForPageManagerLoad, ElementType } from "../common.js"
import { searchEnginesMetadata } from "../../Utils.js"
import { timing } from "@mozilla/web-science";

/**
 * Content Script for DuckDuckGo SERP
 */
const serpScript = function () {
    /**
     * @returns {boolean} Whether the page is a DuckDuckGo web SERP page.
     */
    function getIsWebSerpPage(): boolean {
        return searchEnginesMetadata["DuckDuckGo"].getIsSerpPage(window.location.href);
    }

    /**
     * DuckDuckGo uses a continuous scroll on its SERP pages and so multiple pages of results can be in the same window.
     * This function can be used to determine which page of results an organic result is part of.
     * @param {Element} element - An organic search result element
     * @returns {number} The page number of the given element.
     */
    function getPageNumForElement(element: Element) {
        try {
            while (element) {
                if (element.classList.contains("has-pagenum")) {
                    return Number(element.querySelector(".result__pagenum").textContent)
                }
                element = element.previousElementSibling;
            }
            return 1;
        } catch (error) {
            return -1;
        }
    }

    /**
     * @returns {OrganicDetail[]} An array of details for each of the organic search results.
     */
    function getOrganicDetailsAndLinkElements(): { organicDetails: OrganicDetail[], organicLinkElements: Element[][] } {
        try {
            const organicResults = document.querySelectorAll("#links > div[id^='r1-'], #links > div.nrn-react-div");
            const organicDetails: OrganicDetail[] = []
            const organicLinkElements: Element[][] = [];
            for (const organicResult of organicResults) {
                organicDetails.push({ topHeight: getElementTopHeight(organicResult), bottomHeight: getElementBottomHeight(organicResult), pageNum: getPageNumForElement(organicResult), onlineService: "" })
                organicLinkElements.push(Array.from(organicResult.querySelectorAll('[href]')));
            }
            return { organicDetails: organicDetails, organicLinkElements: organicLinkElements };
        } catch (error) {
            return { organicDetails: [], organicLinkElements: [] };
        }
    }

    /**
     * @returns {number} The number of ad results on the page.
     */
    function getNumAdResults(): number {
        try {
            return document.querySelectorAll(".badge--ad").length;
        } catch (error) {
            return -1;
        }
    }

    /**
     * @returns {Element[]} An array of ad link elements on the page.
     */
    function getAdLinkElements(): Element[] {
        try {
            const adLinkElements: Element[] = [];

            // Add all the carousel items. We can't just add the elements in the carousel with an href attribute because each item is clickable through a JS event
            const modules = document.querySelectorAll(".module--carousel");
            for (const module of modules) {
                if (module.querySelector(".badge--ad")) {
                    adLinkElements.push(...module.querySelectorAll(".module--carousel__item"));
                }
            }

            const regularAdLinkElements = Array.from(document.querySelectorAll("#ads [href], .result--ad [href]")).filter(adLinkElement => {
                return !adLinkElement.matches(
                    '.report-ad, .report-ad *, .feedback-prompt, .feedback-prompt *, .badge--ad__tooltip, .badge--ad__tooltip *, .module--carousel *')
            });

            adLinkElements.push(...regularAdLinkElements);

            return adLinkElements;
        } catch (error) {
            return [];
        }
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the top of the search area.
     */
    function getSearchAreaTopHeight(): number {
        try {
            return (document.querySelector("#header_wrapper") as HTMLElement).offsetHeight;
        } catch (error) {
            return null;
        }
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the bottom of the search area.
     */
    function getSearchAreaBottomHeight(): number {
        try {
            const resultElements = document.querySelectorAll("#links > div:not(.js-result-hidden-el):not(.is-hidden):not(.result--more)");
            const element = resultElements[resultElements.length - 1] as HTMLElement;
            return getElementBottomHeight(element)
        } catch (error) {
            return null;
        }
    }

    /**
     * @returns {number} The page number.
     */
    function getPageNum(): number {
        try {
            const pageNumElements = document.querySelectorAll("div.result__pagenum");
            const lastPageNumElement = pageNumElements[pageNumElements.length - 1];
            const pageNumber = Number(lastPageNumElement.textContent);
            return pageNumber ? pageNumber : 1;
        } catch (error) {
            return 1
        }
    }

    const domObserver = new MutationObserver(function () {
        pageValues.determinePageValues();
    });

    /**
     * @param {Element} target - the target of a click event.
     * @returns {string} A link if the target was an internal link element in the search area.
     * An empty string if it was a possible internal link element. null otherwise.
     */
    function getInternalLink(target: Element): string {
        try {
            if (target.matches("#zero_click_wrapper *, #vertical_wrapper *, #web_content_wrapper *")) {
                const hrefElement = target.closest("[href]");
                if (hrefElement) {
                    const href = (hrefElement as any).href;
                    if (isValidLinkToDifferentPage(href)) {
                        const url = new URL(href);
                        if (url.hostname.includes("duckduckgo.com")) {
                            return href;
                        }
                    } else {
                        return "";
                    }
                } else {
                    return "";
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    function extraCallback(): void {
        domObserver.disconnect();
        const container = document.querySelector("#links")
        if (container) {
            domObserver.observe(container, { childList: true });
        }
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

        const normalizedUrl: string = getNormalizedUrl(url);
        if (pageValues.mostRecentMousedown.Type === ElementType.Ad) {
            if (normalizedUrl.includes("duckduckgo.com/y.js") || pageValues.mostRecentMousedown.Link === url) {
                if (__ENABLE_DEVELOPER_MODE__) {
                    console.log("Ad Click");
                }
                pageValues.numAdClicks++;
            }
            return;
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Organic) {
            if (pageValues.mostRecentMousedown.Link === url) {
                if (__ENABLE_DEVELOPER_MODE__) {
                    console.log("Organic Click");
                }
                pageValues.organicClicks.push({ ranking: pageValues.mostRecentMousedown.Ranking, attentionDuration: pageValues.getAttentionDuration(), pageLoaded: pageValues.pageLoaded })
            }
            return;
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Internal) {
            if (getNormalizedUrl(pageValues.mostRecentMousedown.Link) === normalizedUrl) {
                if (__ENABLE_DEVELOPER_MODE__) {
                    console.log("Internal Click");
                }
                pageValues.numInternalClicks++;
            }
            return;
        }
    }

    // Create a pageValues object to track data for the SERP page
    const pageValues = new PageValues("DuckDuckGo", onNewTab, getIsWebSerpPage, getPageNum, getSearchAreaBottomHeight, getSearchAreaTopHeight, getNumAdResults, getOrganicDetailsAndLinkElements, getAdLinkElements, getInternalLink, extraCallback);

    webScience.pageManager.onPageVisitStart.addListener(({ timeStamp }) => {
        const newPageIsCorrect = getIsWebSerpPage();

        // DuckDuckGo uses the History API when navigating between different search types
        // for the same SERP query. This ensures we report when such a navigation occurs.
        if (pageValues.isWebSerpPage && !newPageIsCorrect) {
            pageValues.reportResults(timeStamp);
        }

        if (!pageValues.isWebSerpPage && newPageIsCorrect) {
            pageValues.resetTracking(timeStamp);
        }
        pageValues.determinePageValues();
    });

    window.addEventListener("unload", (event) => {
        pageValues.reportResults(timing.fromMonotonicClock(event.timeStamp, true));
    });
};

waitForPageManagerLoad(serpScript)