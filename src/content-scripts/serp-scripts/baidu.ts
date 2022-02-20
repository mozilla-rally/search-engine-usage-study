import { PageValues, getElementBottomHeight, getElementTopHeight, isValidLinkToDifferentPage, getNormalizedUrl, waitForPageManagerLoad, getXPathElements, ElementType } from "../common.js"
import { getQueryVariable, getSerpQuery, searchEnginesMetadata } from "../../Utils.js"
import { timing } from "@mozilla/web-science";

/**
 * Content Scripts for Baidu SERP
 */
const serpScript = function () {

    /**
     * @returns {boolean} Whether the page is a Baidu web SERP page.
     */
    function getIsWebSerpPage(): boolean {
        return searchEnginesMetadata["Baidu"].getIsSerpPage(window.location.href);
    }

    /**
     * @returns {OrganicDetail[]} An array of details for each of the organic search results.
     */
    function getOrganicDetailsAndLinkElements(): { organicDetails: OrganicDetail[], organicLinkElements: Element[][] } {
        const organicResults = Array.from(document.querySelectorAll("[tpl='se_com_default']")).filter(element => {
            if (getXPathElements(`descendant::*[
                normalize-space(text()) = 'advertising' or normalize-space(text()) = '广告' or
                normalize-space(text()) = '品牌广告' or normalize-space(text()) = 'brand advertisement'
            ]`, element).length) {
                return false;
            }
            return true;
        });

        const organicDetails: OrganicDetail[] = []
        const organicLinkElements: Element[][] = [];
        for (const organicResult of organicResults) {
            organicDetails.push({ topHeight: getElementTopHeight(organicResult), bottomHeight: getElementBottomHeight(organicResult), pageNum: null, onlineService: "" })
            organicLinkElements.push(Array.from(organicResult.querySelectorAll('[href]')));
        }
        return { organicDetails: organicDetails, organicLinkElements: organicLinkElements };
    }

    /**
     * @returns {number} The number of ad results on the page.
     */
    function getNumAdResults(): number {
        return Array.from(document.querySelectorAll(".c-container")).filter(element => {
            if (getXPathElements(`descendant::*[
                normalize-space(text()) = 'advertising' or normalize-space(text()) = '广告' or
                normalize-space(text()) = '品牌广告' or normalize-space(text()) = 'brand advertisement'
            ]`, element).length) {
                return true;
            }
            return false;
        }).length + document.querySelectorAll("#top-ad").length;
    }

    /**
     * @returns {Element[]} An array of ad link elements on the page.
     */
    function getAdLinkElements(): Element[] {
        const adLinkElements: Element[] = [];
        document.querySelectorAll(".c-container");

        const adElements: Element[] = Array.from(document.querySelectorAll(".c-container")).filter(element => {
            if (getXPathElements(`descendant::*[
                normalize-space(text()) = 'advertising' or normalize-space(text()) = '广告' or
                normalize-space(text()) = '品牌广告' or normalize-space(text()) = 'brand advertisement'
            ]`, element).length) {
                return true;
            }
            return false;
        });

        adElements.push(...document.querySelectorAll("#top-ad"));

        for (const adElement of adElements) {
            adLinkElements.push(...Array.from(adElement.querySelectorAll("[href]")).filter(adLinkElement => {
                const href = (adLinkElement as any).href;
                return href && !href.includes("javascript");
            }));
        }

        return adLinkElements;
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the top of the search area.
     */
    function getSearchAreaTopHeight(): number {
        try {
            const element = (document.querySelector("#s_tab") as HTMLElement)
            return element.offsetHeight + getElementTopHeight(element)
        } catch (error) {
            return null;
        }
    }

    /**
     * @returns {number} The number of pixels between the top of the page and the bottom of the search area.
     */
    function getSearchAreaBottomHeight(): number {
        try {
            const element = (document.querySelector("#container") as HTMLElement)
            return element.offsetHeight + getElementTopHeight(element);
        } catch (error) {
            return null;
        }
    }

    /**
     * @returns {number} The page number.
     */
    function getPageNum(): number {
        try {
            const pageNumElement = document.querySelector("strong > .pc")
            return Number(pageNumElement.textContent);
        } catch (error) {
            return -1;
        }
    }

    /**
     * @param {Element} target - the target of a click event.
     * @returns {string} A link if the target was an internal link element in the search area.
     * An empty string if it was a possible internal link element. null otherwise.
     */
    function getInternalLink(target: Element): string {
        if (target.matches("#container *")) {
            const hrefElement = target.closest("[href]");
            if (hrefElement) {
                const href = (hrefElement as any).href;
                if (isValidLinkToDifferentPage(href)) {
                    const normalizedUrl = getNormalizedUrl(href);
                    if (normalizedUrl.includes("baidu.com") &&
                        !normalizedUrl.includes("baidu.com/link") &&
                        !normalizedUrl.includes("baidu.com/baidu.php")) {
                        return href
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
     * A callback that will be passed the string URL of new tabs opened from the page. It should
     * determine if the new tab corresponds with an ad click, organic click, or internal click.
     * @param {string} url - the url string of a new tab opened from the page.
     */
    function onNewTab(url: string) {
        if (!pageValues.mostRecentMousedown) {
            return;
        }
        const normalizedUrl: string = getNormalizedUrl(url);
        const normalizedRecentUrl: string = getNormalizedUrl(pageValues.mostRecentMousedown.Link)
        if (pageValues.mostRecentMousedown.Type === ElementType.Ad) {
            if (normalizedRecentUrl === normalizedUrl) {
                console.log("AD CLICK")
                pageValues.numAdClicks++;
            }
            return;
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Organic) {
            if ((pageValues.mostRecentMousedown.Link === url) ||
                (normalizedUrl.includes("baidu.com/link") && normalizedRecentUrl.includes("baidu.com/link") &&
                    getQueryVariable(url, "url") === getQueryVariable(pageValues.mostRecentMousedown.Link, "url"))) {
                console.log("ORGANIC CLICK")
                pageValues.organicClicks.push({ ranking: pageValues.mostRecentMousedown.Ranking, attentionDuration: pageValues.getAttentionDuration(), pageLoaded: pageValues.pageLoaded })
            }
            return;
        }
        if (pageValues.mostRecentMousedown.Type === ElementType.Internal) {
            if (normalizedRecentUrl === normalizedUrl) {
                console.log("INTERNAL CLICK")
                pageValues.numInternalClicks++;
            }
            return;
        }
    }

    // Create a pageValues object to track data for the SERP page
    const pageValues = new PageValues("Baidu", onNewTab, getIsWebSerpPage, getPageNum, getSearchAreaBottomHeight, getSearchAreaTopHeight, getNumAdResults, getOrganicDetailsAndLinkElements, getAdLinkElements, getInternalLink);

    // This variable tracks whether the #wrapper_wrapper element has been modified
    // for the current page visit. This variable is used to prevent reporting on unload
    // if the content has not changed since the last page visit start.
    let wrapperModified = false;

    // Observer that looks for the #wrapper_wrapper element that contains
    // page content
    const documentObserver = new MutationObserver(function (_, observer) {
        const container = document.querySelector("#wrapper_wrapper");
        if (container) {
            const domObserver = new MutationObserver(function () {
                pageValues.determinePageValues();
                if (pageValues.isWebSerpPage) {
                    wrapperModified = true;
                }
            });
            const config = { childList: true };
            domObserver.observe(container, config);
            observer.disconnect()
        }
    });
    const bodyConfig = { childList: true, subtree: true };
    documentObserver.observe(document, bodyConfig);

    webScience.pageManager.onPageVisitStart.addListener(({ timeStamp }) => {
        const newPageIsCorrect = getIsWebSerpPage();

        if (newPageIsCorrect) {
            const newQuery = getSerpQuery(window.location.href, "Baidu");
            if (newQuery && pageValues.query && newQuery !== pageValues.query) {
                pageValues.reportResults(timeStamp);
                pageValues.resetTracking(timeStamp);
            } else if (!pageValues.isWebSerpPage) {
                pageValues.resetTracking(timeStamp);
            }
        } else if (pageValues.isWebSerpPage) {
            pageValues.reportResults(timeStamp);
        }
        wrapperModified = false;
        pageValues.determinePageValues();
    });

    window.addEventListener("unload", (event) => {
        if (wrapperModified) {
            pageValues.reportResults(timing.fromMonotonicClock(event.timeStamp, true));
        }
    });
};

waitForPageManagerLoad(serpScript)