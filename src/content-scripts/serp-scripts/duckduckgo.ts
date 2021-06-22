import { PageValues, ElementType } from "../common.js"
import * as Utils from "../Utils.js"
import { timing } from "@mozilla/web-science";

/**
 * Content Script for DuckDuckGo SERP
 */
const serpModule = function () {
    const pageValues = new PageValues("DuckDuckGo", onNewTab);

    /**
     * Get whether the page is a basic SERP page.
     */
    function getPageIsCorrect(): boolean {
        return !!document.querySelector("#duckbar_static li:first-child .is-active, #duckbar_new .is-active") &&
            !!Utils.getQueryVariable(window.location.href, "ia") &&
            !Utils.getQueryVariable(window.location.href, "iax") &&
            !Utils.getQueryVariable(window.location.href, "iaxm");
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

    function getOrganicDetails(): OrganicDetail[] {
        const organicResults = document.querySelectorAll("#links > div[id^='r1-']");
        const organicDetails: OrganicDetail[] = []
        for (const organicResult of organicResults) {
            organicDetails.push({ TopHeight: Utils.getElementTopHeight(organicResult), BottomHeight: Utils.getNextElementTopHeight(organicResult), PageNum: getPageNumForElement(organicResult) })
        }
        return organicDetails;
    }

    function getOrganicLinkElements(): Element[][] {
        const organicResults = document.querySelectorAll("#links > div[id^='r1-']");
        const organicLinkElements: Element[][] = []
        for (const organicResult of organicResults) {
            organicLinkElements.push(Array.from(organicResult.querySelectorAll('[href]')));
        }
        return organicLinkElements;
    }

    /**
     * @returns {Array} An array of all the ad results on the page
     */
    function getNumAdResults(): number {
        return document.querySelectorAll(".badge--ad").length;
    }

    function getAdLinkElements(): Element[] {
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
    }

    /**
     * Get the number of pixels between the top of the page and the top of the search area.
     */
    function getSearchAreaTopHeight(): number {
        try {
            return (document.querySelector("#header_wrapper") as HTMLElement).offsetHeight;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get the number of pixels between the top of the page and the bottom of the search area.
     */
    function getSearchAreaBottomHeight(): number {
        try {
            const resultElements = document.querySelectorAll("#links > div:not(.js-result-hidden-el):not(.is-hidden):not(.result--more)");
            const element = resultElements[resultElements.length - 1] as HTMLElement;
            return element.offsetHeight + Utils.getElementTopHeight(element)
        } catch (error) {
            return null;
        }
    }

    /**
     * Get the page number.
     */
    function getPageNum(): number {
        const pageElement = Utils.getXPathElement("(//div[contains(@class, 'result__pagenum')])[last()]")
        if (pageElement) {
            return Number(pageElement.textContent);
        } else {
            return 1;
        }
    }

    const domObserver = new MutationObserver(function () {
        determinePageValues(timing.now());
    });

    // Returns the href if it is an internal link
    // Returns empty string if the click was in the search area but there was no link
    // Returns null otherwise
    function getInternalLink(target: Element): string {
        if (target.matches("#zero_click_wrapper *, #vertical_wrapper *, #web_content_wrapper *")) {
            const hrefElement = target.closest("[href]");
            if (hrefElement) {
                const href = (hrefElement as any).href;
                if (Utils.isLinkToDifferentPage(href)) {
                    const url = new URL(href);
                    if (url.hostname === window.location.hostname) {
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
    }

    /**
     * Determine all the page values and send the query to the background page
     */
    function determinePageValues(timeStamp: number): void {
        const newPageIsCorrect = getPageIsCorrect();
        if (pageValues.pageIsCorrect && !newPageIsCorrect) {
            pageValues.reportResults(timeStamp);
            pageValues.resetTracking();
        }
        pageValues.pageIsCorrect = newPageIsCorrect;
        pageValues.pageNum = getPageNum();
        pageValues.searchAreaBottomHeight = getSearchAreaBottomHeight();
        pageValues.searchAreaTopHeight = getSearchAreaTopHeight();
        pageValues.numAdResults = getNumAdResults();
        pageValues.organicResults = getOrganicDetails();
        pageValues.addAdListeners(getAdLinkElements());
        pageValues.addOrganicListeners(getOrganicLinkElements());
        pageValues.addInternalListeners(getInternalLink);

        domObserver.disconnect();
        const container = document.querySelector("#links")
        if (container) {
            domObserver.observe(container, { childList: true });
        }
    }

    window.addEventListener("DOMContentLoaded", (event) => {
        determinePageValues(timing.fromMonotonicClock(event.timeStamp, true));
    });

    window.addEventListener("load", (event) => {
        determinePageValues(timing.fromMonotonicClock(event.timeStamp, true));
        pageValues.pageLoaded = true;
    });

    function onNewTab(url) {
        if (!pageValues.mostRecentMousedown) {
            return;
        }
        const normalizedUrl: string = Utils.getNormalizedUrl(url);
        if (pageValues.mostRecentMousedown.type === ElementType.Ad) {
            if (normalizedUrl.includes("duckduckgo.com/y.js") || pageValues.mostRecentMousedown.href === url) {
                pageValues.numAdClicks++;
            }
            return;
        }
        if (pageValues.mostRecentMousedown.type === ElementType.Organic) {
            if (pageValues.mostRecentMousedown.href === url) {
                pageValues.organicClicks.push({ Ranking: pageValues.mostRecentMousedown.index, AttentionDuration: pageValues.getAttentionDuration(), PageLoaded: pageValues.pageLoaded })
            }
            return;
        }
        if (pageValues.mostRecentMousedown.type === ElementType.Internal) {
            if (pageValues.mostRecentMousedown.href === url) {
                pageValues.numInternalClicks++;
            }
            return;
        }
    }

    webScience.pageManager.onPageVisitStart.addListener(({ timeStamp }) => {
        determinePageValues(timeStamp);
    });

    window.addEventListener("unload", (event) => {
        pageValues.reportResults(timing.fromMonotonicClock(event.timeStamp, true));
    });
};

Utils.waitForPageManagerLoad(serpModule)