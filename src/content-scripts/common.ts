import { timing, matching } from "@mozilla/web-science";
import { getSerpQuery } from "../Utils";

export enum ElementType {
  Organic,
  Internal,
  Ad,
}

/**
 * The maximum number of milliseconds after a click where we consider a createdNavigationTarget message
 * to have been caused by the click.
 */
// TODO: the delay of 500 ms should maybe be even less?
const maxClickToCreatedNavigationTargetMessageDelay = 500;

/**
 * The maximum number of milliseconds after a click where we consider a createdNavigationTarget message
 * to have been caused by the click.
 */
// TODO: the delay of 500 ms should maybe be even less?
const beforeLoadPageValueRefreshInterval = 500;

/**
 * The maximum number of milliseconds after a click where we consider the end of the page visit
 * to have been caused by the click.
 */
// TODO: maybe use different delay than 1 second?
const maxClickToPageVisitEndDelay = 1000;

/**
 * A class that provides functionality for tracking and reporting page values for a SERP page
 * (ie. attention duration, ad clicks, etc.)
 */
export class PageValues {
  /**
   * The name of the search engine that is being tracked
   */
  readonly searchEngine: string;

  /**
   * The search query for the SERP page
   */
  query: string;

  /**
   * The pageId for the page from webScience.pageManager
   */
  pageId: string = null;

  /**
   * Whether the page is a basic web SERP.
   */
  isWebSerpPage = false;

  /**
   * When the SERP visit started.
   */
  pageVisitStartTime = null;

  /**
   * How long the page has had the participant's attention.
   */
  attentionDuration = 0;

  /**
   * When the page attention state was last updated.
   */
  lastAttentionUpdateTime = 0;

  /**
   * If the whole page has loaded, including all dependent resources such as stylesheets and images.
   */
  pageLoaded = false;

  /**
   * The page number of the results for the query.
   */
  pageNum = -1;

  /**
   * Number of pixels between the top of the page and the top of the search area.
   */
  searchAreaTopHeight: number = null;

  /**
   * Number of pixels between the top of the page and the bottom of the search area.
   */
  searchAreaBottomHeight: number = null;

  /**
   * The number of clicks in the search area that have led to other pages on the SERP domain.
   */
  numInternalClicks = 0;

  /**
   * The number of advertisement clicks.
   */
  numAdClicks = 0;

  /**
   * The number of advertisements on the page.
   */
  numAdResults = 0;

  /**
   * Details of the organic result clicks.
   */
  organicClicks: Array<OrganicClick> = [];

  /**
   * Details of the organic results on the page.
   */
  organicDetails: Array<OrganicDetail> = [];

  /**
   * An array of the listeners tracking elements on the page.
   */
  elementListenersList: ElementListeners[] = [];

  /**
   * Details about the element that most recently had the mousedown event fired for it.
   */
  mostRecentMousedown: {
    Type: ElementType,
    Link: string,
    Ranking: number
  };

  /**
   * When the most recent recorded click occurred. This is used to ignore new tabs opened from the page if the 
   * click for the opening of the tab was already recorded.
   */
  mostRecentRecordedClickTimeStamp: number = null;

  /**
   * The timestamp of the most recent click that was possibly on an internal link element. This is needed because of
   * SERP pages having links that cannot be directly tracked because the link is through an event listener rather
   * than an href attribute on the element.
   */
  possibleInternalClickTimeStamp: number = null;

  /**
   * The ID of the page value refresh interval that run after "DOMContentLoaded" until "load".
   */
  beforeLoadPageValueRefreshIntervalId = null;

  determinePageValues: () => void = null;

  initializeDeterminePageValues(
    getIsWebSerpPage: () => boolean,
    getPageNum: () => number,
    getSearchAreaBottomHeight: () => number,
    getSearchAreaTopHeight: () => number,
    getNumAdResults: () => number,
    getOrganicDetailsAndLinkElements: () => {
      details: OrganicDetail[];
      linkElements: Element[][];
    },
    getAdLinkElements: () => Element[],
    getInternalLink: (target: Element) => string,
    extraCallback: () => void) {

    this.determinePageValues = () => {
      this.isWebSerpPage = getIsWebSerpPage();
      if (!this.isWebSerpPage) return;

      this.query = getSerpQuery(window.location.href, this.searchEngine);

      this.pageNum = getPageNum();
      this.searchAreaBottomHeight = getSearchAreaBottomHeight();
      this.searchAreaTopHeight = getSearchAreaTopHeight();

      if (getNumAdResults) this.numAdResults = getNumAdResults();

      const { details, linkElements } = getOrganicDetailsAndLinkElements();
      this.organicDetails = details;

      this.addListeners(linkElements, getAdLinkElements(), getInternalLink);

      if (extraCallback) extraCallback();
    }

    window.addEventListener("DOMContentLoaded", () => {
      this.determinePageValues();
      this.beforeLoadPageValueRefreshIntervalId = setInterval(() => {
        this.determinePageValues();
      }, beforeLoadPageValueRefreshInterval);
    });

    window.addEventListener("load", () => {
      this.pageLoaded = true;
      clearInterval(this.beforeLoadPageValueRefreshIntervalId);
      this.determinePageValues();
    });


  }

  /**
   * Create a PageValues object.
   * @param {string} searchEngine - The name of the search engine being tracked.
   * @param {callback} onNewTab - A callback that will be passed the url if a new tab is opened
   * from this page and determine if a click occurred
   */
  constructor(
    searchEngine: string,
    onNewTab: (url: string) => void,
    getIsWebSerpPage: () => boolean,
    getPageNum: () => number,
    getSearchAreaBottomHeight: () => number,
    getSearchAreaTopHeight: () => number,
    getNumAdResults: () => number,
    getOrganicDetailsAndLinkElements: () => {
      details: OrganicDetail[];
      linkElements: Element[][];
    },
    getAdLinkElements: () => Element[],
    getInternalLink: (target: Element) => string,
    extraCallback: () => void) {
    this.searchEngine = searchEngine;
    this.pageId = webScience.pageManager.pageId;
    this.pageVisitStartTime = webScience.pageManager.pageVisitStartTime;

    this.initializeDeterminePageValues(getIsWebSerpPage,
      getPageNum,
      getSearchAreaBottomHeight,
      getSearchAreaTopHeight,
      getNumAdResults,
      getOrganicDetailsAndLinkElements,
      getAdLinkElements,
      getInternalLink,
      extraCallback);

    // Receives messages from the background when the background receives 
    // onCreatedNavigationTarget messages with the tab of this page as the source.
    browser.runtime.onMessage.addListener((message) => {
      if (message.type === "CreatedNavigationTargetMessage") {
        const details = message.details;
        // If we recently recorded a click, then we assume that this message is for the opening of a link
        // that has already been recorded and we ignore it. Otherwise, we pass the url of the opened tab
        // to the onNewTab callback.
        if (this.mostRecentRecordedClickTimeStamp &&
          this.mostRecentRecordedClickTimeStamp >= (timing.fromSystemClock(details.timeStamp) - maxClickToCreatedNavigationTargetMessageDelay)) {
          this.mostRecentRecordedClickTimeStamp = null;
        } else {
          onNewTab(details.url);
        }
      }
    });

    webScience.pageManager.onPageAttentionUpdate.addListener(({ timeStamp }) => {
      // If the page just lost attention, add to the attention duration
      if (!webScience.pageManager.pageHasAttention) {
        this.attentionDuration += timeStamp - this.lastAttentionUpdateTime;
      }
      this.lastAttentionUpdateTime = timeStamp;
    });
    this.lastAttentionUpdateTime = webScience.pageManager.pageVisitStartTime;
  }

  /**
   * Get how long (in milliseconds) the page had the participant's attention.
   */
  getAttentionDuration(): number {
    // If the page currently has attention, we add the amount of time since the last time
    // the attention state was changed.
    if (webScience.pageManager.pageHasAttention) {
      return this.attentionDuration + (timing.now() - this.lastAttentionUpdateTime);
    } else {
      return this.attentionDuration;
    }
  }

  /**
   * Called to reset tracking if a new SERP page visit starts.
   */
  resetTracking(timeStamp) {
    this.pageVisitStartTime = timeStamp;
    this.attentionDuration = 0;
    this.lastAttentionUpdateTime = timeStamp;
    this.numInternalClicks = 0;
    this.numAdClicks = 0;
    this.organicClicks = [];
    this.mostRecentMousedown = null;
    this.mostRecentRecordedClickTimeStamp = null;
    this.possibleInternalClickTimeStamp = null;
  }

  /**
   * Handle click events.
   **/
  handleClick(event: MouseEvent, type: ElementType, ranking: number, getInternalLink: (target: Element) => string) {
    if (!(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) {
      if (type === ElementType.Organic) {
        console.log("ORGANIC CLICK")
        this.organicClicks.push({ Ranking: ranking, AttentionDuration: this.getAttentionDuration(), PageLoaded: this.pageLoaded });
      } else if (type === ElementType.Ad) {
        console.log("AD CLICK")
        this.numAdClicks++;
      } else if (type === ElementType.Internal) {
        if (event.target instanceof Element) {
          const href = getInternalLink(event.target as Element);
          if (href) {
            console.log("INTERNAL CLICK")
            this.numInternalClicks++;
          } else if (href === "") {
            this.possibleInternalClickTimeStamp = timing.fromMonotonicClock(event.timeStamp, true);
            return;
          }
        }
      }
      this.mostRecentRecordedClickTimeStamp = timing.fromMonotonicClock(event.timeStamp, true);
    }
  }

  /**
   * Handle mousedown events. We handle mousedown events separately from click events because it is possible to
   * to open a link without a standard click (ie. by right-clicking and opening in a new tab).
   **/
  handleMousedown(event: MouseEvent, type: ElementType, ranking: number, getInternalLink: (target: Element) => string) {
    if (type === ElementType.Organic) {
      if ((event.currentTarget as any).href) {
        this.mostRecentMousedown = {
          Type: ElementType.Organic,
          Link: (event.currentTarget as any).href,
          Ranking: ranking,
        }
      }
    }
    if (type === ElementType.Internal) {
      if (event.target instanceof Element) {
        const href = getInternalLink(event.target as Element);
        if (href) {
          this.mostRecentMousedown = {
            Type: ElementType.Internal,
            Link: href,
            Ranking: null
          }
        }
      }
    }
    if (type === ElementType.Ad) {
      if (event.target instanceof Element) {
        const hrefElement = event.target.closest("[href]");
        if (hrefElement) {
          const href = (hrefElement as any).href;
          if (href) {
            this.mostRecentMousedown = {
              Type: ElementType.Ad,
              Link: href,
              Ranking: null
            }
          }
        }
      }
    }
  }

  addElementListeners(element: Element, type: ElementType, ranking: number, getInternalLink: (target: Element) => string) {
    const clickListener = (event: MouseEvent) => this.handleClick(event, type, ranking, getInternalLink);
    const mousedownListener = (event: MouseEvent) => this.handleMousedown(event, type, ranking, getInternalLink);
    element.addEventListener("click", clickListener, true);
    element.addEventListener("mousedown", mousedownListener, true);
    this.elementListenersList.push({ element: element, clickListener: clickListener, mousedownListener: mousedownListener });
  }

  addListeners(organicLinkElements: Element[][], adLinkElements: Element[], getInternalLink: (target: Element) => string) {
    // Remove any previously added listeners.
    for (const elementListeners of this.elementListenersList) {
      elementListeners.element.removeEventListener("click", elementListeners.clickListener, true);
      elementListeners.element.removeEventListener("mousedown", elementListeners.mousedownListener, true);
    }
    this.elementListenersList = [];

    // Add the internal tracking listeners.
    if (getInternalLink) {
      this.addElementListeners(document.body, ElementType.Internal, null, getInternalLink);
    }

    // Add the ad tracking listeners.
    for (const adLinkElement of adLinkElements) {
      this.addElementListeners(adLinkElement, ElementType.Ad, null, null);
    }

    // Add the organic tracking listeners.
    for (let i = 0; i < organicLinkElements.length; i++) {
      const organicLinkElementsAtIndex = organicLinkElements[i];
      for (const organicLinkElement of organicLinkElementsAtIndex) {
        this.addElementListeners(organicLinkElement, ElementType.Organic, i, null);
      }
    }
  }

  /**
   * Report page data to the background.
   */
  reportResults(timeStamp: number) {
    // If pageIsCorrect is false, we do not report
    if (!this.isWebSerpPage) {
      return
    }

    // If there was a possible internal click within 1 second of the reporting,
    // we consider the possible internal click to be an internal click.
    if (this.possibleInternalClickTimeStamp &&
      this.possibleInternalClickTimeStamp >= timeStamp - maxClickToPageVisitEndDelay) {
      console.log("INTERNAL CLICK")
      this.numInternalClicks++;
    }

    // Send data to background page
    webScience.pageManager.sendMessage({
      type: "SerpVisitData",
      data: {
        searchEngine: this.searchEngine,
        query: this.query,
        pageId: this.pageId,
        attentionDuration: this.getAttentionDuration(),
        pageLoaded: this.pageLoaded,
        pageNum: this.pageNum,
        organicDetails: this.organicDetails,
        organicClicks: this.organicClicks,
        numAdResults: this.numAdResults,
        numAdClicks: this.numAdClicks,
        numInternalClicks: this.numInternalClicks,
        searchAreaTopHeight: this.searchAreaTopHeight,
        searchAreaBottomHeight: this.searchAreaBottomHeight,
        pageVisitStartTime: this.pageVisitStartTime
      },
    });
  }
}

/**
 * @param {string} url - The URL string to normalize.
 * @returns {string} The normalized URL string or an empty string if the URL string is not a valid, absolute URL.
 */
export function getNormalizedUrl(url: string): string {
  try {
    return matching.normalizeUrl(url);
  } catch (error) {
    return "";
  }
}

/**
 * @param {Element} element - An element
 * @returns {number} The number of pixels between the top of the page and the top of the element
 */
export function getElementTopHeight(element: Element): number {
  try {
    return window.pageYOffset + element.getBoundingClientRect().top
  } catch (error) {
    return null;
  }

}

/**
 * @param {Element} element - An element
 * @returns {number} The number of pixels between the top of the page and the bottom of the element
 */
export function getElementBottomHeight(element: Element) {
  return getElementTopHeight(getNextElement(element))
}

/**
 * @param {Element} element - An element
 * @returns {number} The next element in the DOM or null if such an element does not exist.
 */
function getNextElement(element: Element) {
  if (!element) {
    return null;
  }

  // Get the next sibling element where the display property for the element or one of its parents
  // is not set to none and the position property is not set to fixed. If no such sibling element exists,
  // recursively call this on the parent element.
  while (element.nextElementSibling && (
    !(element.nextElementSibling as HTMLElement).offsetParent ||
    !(element.nextElementSibling as HTMLElement).offsetHeight ||
    !(element.nextElementSibling as HTMLElement).offsetWidth
  )) {
    element = element.nextElementSibling
  }
  if (element.nextElementSibling) {
    return element.nextElementSibling;
  } else {
    return getNextElement(element.parentElement);
  }
}

/**
 * Retrieves the first matching element given an xpath query
 * @param {string} xpath - An xpath query
 * @param {Node} contextNode - The context node for the query
 * @returns {Element} The first element matching the xpath
 */
export function getXPathElement(xpath: string, contextNode: Node = document): Element {
  const matchingElement = document.evaluate(
    xpath, contextNode,
    null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
  ).singleNodeValue
  return (matchingElement as Element)
}

/**
 * Retrieves an array of all elements matching a given xpath query
 * @param {string} xpath - An xpath query
 * @param {Node} contextNode - The context node for the query
 * @returns {Element} An array of all elements matching the xpath query
 */
export function getXPathElements(xpath: string, contextNode: Node = document): Element[] {
  const results: Element[] = [];
  const query = document.evaluate(xpath, contextNode,
    null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
  let element = query.iterateNext()
  while (element) {
    results.push(element as Element)
    element = query.iterateNext()
  }
  return results;
}


/**
 * @param {string} urlString - a URL string
 * @returns {boolean} Whether the URL string is a valid URL to a different page than the current page.
 */
export function isValidLinkToDifferentPage(urlString: string): boolean {

  try {
    const url = new URL(urlString);
    if (
      url.protocol === window.location.protocol &&
      url.host === window.location.host &&
      url.pathname === window.location.pathname &&
      url.search === window.location.search
    ) {
      // Return false if the urlString parameter is the same as the window's URL while
      // ignoring the fragment and port.
      return false;
    } else if (url.protocol != "https:" && url.protocol != "http:") {
      // Filter out if the URL protocol is not HTTP/S such as for an element
      // meant to trigger javascript with an href attribute of "javascript:;".
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Execute a callback after the webScience.pageManager API has loaded.
 * @param {string} callback - the callback to run
 */
export function waitForPageManagerLoad(callback) {
  if (("webScience" in window) && ("pageManager" in (window as any).webScience)) {
    callback();
  }
  else {
    if (!("pageManagerHasLoaded" in window)) {
      (window as any).pageManagerHasLoaded = [];
    }
    (window as any).pageManagerHasLoaded.push(callback);
  }
}

