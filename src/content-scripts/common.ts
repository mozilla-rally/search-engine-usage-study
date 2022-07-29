import { timing, matching } from "@mozilla/web-science";
import { getSerpQuery } from "../Utils";
import { getSelfPreferencedDetailsAndElements, removeSelfPreferenced, replaceSelfPreferenced } from "./selfPreferencing";

export enum ElementType {
  Organic,
  Internal,
  Ad,
  SelfPreferenced,
}

/**
 * The maximum number of milliseconds after a click where we consider a createdNavigationTarget message
 * to have been caused by the click.
 */
const maxClickToCreatedNavigationTargetMessageDelay = 500;

/**
 * The interval at which to determine page values before the page has fully loaded. We cannot wait
 * for the page to load to determine page values because we may miss out on participant interaction
 * if we were to do so.
 */
const beforeLoadPageValueRefreshInterval = 500;

/**
 * The maximum number of milliseconds after a click where we consider the end of the page visit
 * to have been caused by the click.
 */
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
   * The self preferencing modification type for the page.
   * This is only relevant for Google SERPs.
   */
  readonly selfPreferencingType: string;

  /**
   * The search query for the SERP page
   */
  query: string;

  /**
   * The category of online content the search query is for (flights, hotels, other travel, maps, lyrics, weather, shopping, or other direct answer).
   */
  queryVertical: string;

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
   * Details of the self preferenced results on the page.
   */
  selfPreferencedDetails: Array<SelfPreferencedDetail> = [];

  /**
   * The number of self preferenced result clicks.
   */
  numSelfPreferencedClicks = 0;

  /**
   * An array of the listeners tracking elements on the page. This does not include
   * self preferenced result listeners which are tracked with selfPreferencedListenersList
   */
  elementListenersList: ElementListeners[] = [];

  /**
   * An array of the self preferenced result listeners on the page.
   */
  selfPreferencedElementListenersList: ElementListeners[] = [];

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
   * The timestamp of the most recent click that was possibly on an internal link element. This is needed because of
   * SERP pages having links that cannot be directly tracked because the link is through an event listener rather
   * than an href attribute on the element.
   */
  possibleSelfPreferencedClickTimeStamp: number = null;

  /**
   * The ID of the page value refresh interval that runs until the document readyState is "complete.
   */
  beforeLoadPageValueRefreshIntervalId = null;

  /**
   * Callback to determine the page values for the current SERP page.
   */
  determinePageValues: () => void = null;

  initializeDeterminePageValues(
    getIsWebSerpPage: () => boolean,
    getPageNum: () => number,
    getSearchAreaBottomHeight: () => number,
    getSearchAreaTopHeight: () => number,
    getNumAdResults: () => number,
    getOrganicDetailsAndLinkElements: () => {
      organicDetails: OrganicDetail[];
      organicLinkElements: Element[][];
    },
    getAdLinkElements: () => Element[],
    getInternalLink: (target: Element) => string,
    extraCallback: () => void,
    getSerpQueryVertical: () => string) {

    this.determinePageValues = () => {
      if (__ENABLE_DEVELOPER_MODE__) {
        console.log("Determining page values");
      }
      this.isWebSerpPage = getIsWebSerpPage();
      if (!this.isWebSerpPage) return;

      this.query = getSerpQuery(window.location.href, this.searchEngine);

      this.queryVertical = getSerpQueryVertical ? getSerpQueryVertical() : null;

      this.pageNum = getPageNum();
      this.searchAreaBottomHeight = getSearchAreaBottomHeight();
      this.searchAreaTopHeight = getSearchAreaTopHeight();

      if (getNumAdResults) this.numAdResults = getNumAdResults();

      const { organicDetails, organicLinkElements } = getOrganicDetailsAndLinkElements();
      this.organicDetails = organicDetails;

      this.addListeners(organicLinkElements, getAdLinkElements(), getInternalLink);

      if (extraCallback) extraCallback();
    }

    let mutationObserverForSelfPreferencedResults: MutationObserver = null;

    // Handle self preferenced element tracking on Google
    if (this.searchEngine == "Google") {
      // Add a mutation observer to check for the document.body load
      const bodyObserver = new MutationObserver(() => {
        if (document.body) {
          // document.body exists now so disconnect the observer and add an observer to document.body
          bodyObserver.disconnect();

          // Mutation observer for document.body that refreshes the tracked self preferenced elements
          // on the SERP whenever there is a mutation. This will be disconnected after the document
          // has fully loaded.
          mutationObserverForSelfPreferencedResults = new MutationObserver(() => {
            let selfPreferencedElementDetails: SelfPreferencedDetail[] = [];
            let selfPreferencedElements: Element[] = [];

            if (this.selfPreferencingType == "Remove") {
              selfPreferencedElementDetails = removeSelfPreferenced();
            } else if (this.selfPreferencingType == "Replace") {
              ({ selfPreferencedElementDetails, selfPreferencedElements } = replaceSelfPreferenced(false));
            } else {
              ({ selfPreferencedElementDetails, selfPreferencedElements } = getSelfPreferencedDetailsAndElements());
            }
            if (__ENABLE_DEVELOPER_MODE__) {
              console.log(selfPreferencedElementDetails);
              console.log(selfPreferencedElements);
            }


            this.selfPreferencedDetails = selfPreferencedElementDetails;
            this.addSelfPreferencedListeners(selfPreferencedElements);
          });

          mutationObserverForSelfPreferencedResults.observe(document.body, {
            childList: true,
            subtree: true
          });
        }
      });
      bodyObserver.observe(document.documentElement, { childList: true });
    }

    if (document.readyState === "complete") {
      this.pageLoaded = true;
      this.determinePageValues();
      // We set a timeout to determine page values again in case
      // there are minor changes to the DOM shortly after ready state is complete.
      setTimeout(() => {
        // Disconnect the mutation observer that refreshes the tracked self preferenced results.
        if (mutationObserverForSelfPreferencedResults) {
          mutationObserverForSelfPreferencedResults.disconnect();

          // We try to replace self preferenced results one last time. We do this in case previous calls failed
          // because other organic results had not loaded yet, causing a failure in generating a replacement template.
          if (this.selfPreferencingType == "Replace") {
            let selfPreferencedElementDetails: SelfPreferencedDetail[] = [];
            let selfPreferencedElements: Element[] = [];
            ({ selfPreferencedElementDetails, selfPreferencedElements } = replaceSelfPreferenced(true));
            this.selfPreferencedDetails = selfPreferencedElementDetails;
            this.addSelfPreferencedListeners(selfPreferencedElements);
          }
        }
        this.determinePageValues();
      }, beforeLoadPageValueRefreshInterval);
    } else {
      if (document.readyState === "interactive") {
        this.determinePageValues();
      }
      this.beforeLoadPageValueRefreshIntervalId = setInterval(() => {
        if (this.pageLoaded) {
          // Disconnect the mutation observer that refreshes the tracked self preferenced results.
          if (mutationObserverForSelfPreferencedResults) {
            mutationObserverForSelfPreferencedResults.disconnect();
          }
          this.determinePageValues();
          clearInterval(this.beforeLoadPageValueRefreshIntervalId);
        }
        if (document.readyState !== "loading") {
          this.determinePageValues();
        }
        // We don't clear the interval here because there may be small changes to
        // the DOM after loading so we want to determine page values one more time
        // slightly after the ready state is complete.
        if (document.readyState === "complete") {
          this.determinePageValues();
          this.pageLoaded = true;
        }
      }, beforeLoadPageValueRefreshInterval);
    }
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
      organicDetails: OrganicDetail[];
      organicLinkElements: Element[][];
    },
    getAdLinkElements: () => Element[],
    getInternalLink: (target: Element) => string,
    extraCallback: () => void = null,
    selfPreferencingType = null,
    getSerpQueryVertical: () => string = null) {

    this.searchEngine = searchEngine;
    this.selfPreferencingType = selfPreferencingType;

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
      extraCallback,
      getSerpQueryVertical);

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
   * Called to reset tracking if a new SERP page visit starts. Resets page values.
   */
  resetTracking(timeStamp) {
    this.pageVisitStartTime = timeStamp;
    this.attentionDuration = 0;
    this.lastAttentionUpdateTime = timeStamp;
    this.numInternalClicks = 0;
    this.numSelfPreferencedClicks = 0;
    this.numAdClicks = 0;
    this.organicClicks = [];
    this.mostRecentMousedown = null;
    this.mostRecentRecordedClickTimeStamp = null;
    this.possibleInternalClickTimeStamp = null;
    this.possibleSelfPreferencedClickTimeStamp = null;
  }

  /**
   * Handle click events.
   **/
  handleClick(event: MouseEvent, type: ElementType, ranking: number, getInternalLink: (target: Element) => string) {
    if (!(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) {
      if (type === ElementType.Organic) {
        if (__ENABLE_DEVELOPER_MODE__) {
          console.log("Organic Click");
        }
        this.organicClicks.push({ ranking: ranking, attentionDuration: this.getAttentionDuration(), pageLoaded: this.pageLoaded });
      } else if (type === ElementType.Ad) {
        if (__ENABLE_DEVELOPER_MODE__) {
          console.log("Ad Click");
        }
        this.numAdClicks++;
      } else if (type === ElementType.SelfPreferenced) {
        if (__ENABLE_DEVELOPER_MODE__) {
          console.log("Possible Self Preferenced Result Click");
        }
        if (event.target instanceof Element) {
          const hrefElement = event.target.closest("[href]");
          if (hrefElement && (hrefElement as any).href) {
            if (__ENABLE_DEVELOPER_MODE__) {
              console.log("Self Preferenced Result Click");
            }
            this.numSelfPreferencedClicks++;
          } else {
            this.possibleSelfPreferencedClickTimeStamp = timing.fromMonotonicClock(event.timeStamp, true);
            return;
          }
        }
      } else if (type === ElementType.Internal) {
        if (event.target instanceof Element) {
          const href = getInternalLink(event.target as Element);
          if (href) {
            if (__ENABLE_DEVELOPER_MODE__) {
              console.log("Internal Click");
            }
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
    if (__ENABLE_DEVELOPER_MODE__) {
      if (type === ElementType.Ad) {
        console.log("ElementType: Ad");
      } else if (type === ElementType.Organic) {
        console.log("ElementType: Organic");
      } else if (type === ElementType.Internal) {
        console.log("ElementType: Internal");
      } else if (type === ElementType.SelfPreferenced) {
        console.log("ElementType: Self Preferenced");
      }
    }
    if (type === ElementType.Organic) {
      if (event.target instanceof Element) {
        const hrefElement = event.target.closest("[href]");
        if (hrefElement) {
          const href = (hrefElement as any).href;
          if (href) {
            this.mostRecentMousedown = {
              Type: ElementType.Organic,
              Link: (event.currentTarget as any).href,
              Ranking: ranking,
            }
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
    if (type === ElementType.Internal) {
      if (event.target instanceof Element) {
        const href = getInternalLink(event.target as Element);
        if (href) {
          this.mostRecentMousedown = {
            Type: ElementType.Internal,
            Link: href,
            Ranking: null
          }
        } else if (href === "") {
          this.mostRecentMousedown = {
            Type: ElementType.Internal,
            Link: window.location.href,
            Ranking: null
          }
          this.possibleInternalClickTimeStamp = timing.fromMonotonicClock(event.timeStamp, true);
          return;
        } else {
          this.mostRecentMousedown = null;
        }
      }
    }
    if (type === ElementType.SelfPreferenced) {
      if (__ENABLE_DEVELOPER_MODE__) {
        console.log("Self Preferenced Result Mousedown");
      }
      if (event.target instanceof Element) {
        const hrefElement = event.target.closest("[href]");
        if (hrefElement) {
          const href = (hrefElement as any).href;
          if (href) {
            this.mostRecentMousedown = {
              Type: ElementType.SelfPreferenced,
              Link: href,
              Ranking: null
            }
          }
        }
      }
    }
  }

  /**
   * Adds "click" and "mousedown" listeners to an element.
   * @param element - The element that listeners are being added to.
   * @param type - The type of the element that the listener is being added to (Organic, Advertisement, or Internal)
   * @param ranking - the ranking of the organic result if the element is an organic link element. Otherwise, null.
   * @param getInternalLink - returns a link (the href) if target was an internal link element in the search area, an empty string if a click
   * on target a possible internal link click, and null otherwise. null if the element is not an internal element.
   */
  addElementListeners(element: Element, type: ElementType, ranking: number, getInternalLink: (target: Element) => string) {
    const clickListener = (event: MouseEvent) => this.handleClick(event, type, ranking, getInternalLink);
    const mousedownListener = (event: MouseEvent) => this.handleMousedown(event, type, ranking, getInternalLink);
    element.addEventListener("click", clickListener, true);
    element.addEventListener("mousedown", mousedownListener, true);

    if (type === ElementType.SelfPreferenced) {
      this.selfPreferencedElementListenersList.push({ element: element, clickListener: clickListener, mousedownListener: mousedownListener });
    } else {
      this.elementListenersList.push({ element: element, clickListener: clickListener, mousedownListener: mousedownListener });
    }

  }

  /**
   * Add listeners to the DOM elements to track organic, advertisement, and internal links.
   * @param organicLinkElements - An array where each element is an array of links for the organic element at that index. (eg.
   * organicLinkElements[0] is the array of link elements for the first organic element)
   * @param adLinkElements - An array of ad link elements on the page.
   * @param getInternalLink - returns a link (the href) if target was an internal link element in the search area, an empty string if a click
   * on target a possible internal link click, and null otherwise.
   */
  addListeners(organicLinkElements: Element[][], adLinkElements: Element[], getInternalLink: (target: Element) => string) {
    // Remove any previously added listeners.
    for (const elementListeners of this.elementListenersList) {
      elementListeners.element.removeEventListener("click", elementListeners.clickListener, true);
      elementListeners.element.removeEventListener("mousedown", elementListeners.mousedownListener, true);
    }
    this.elementListenersList = [];

    // Add the internal tracking listener to the document body.
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
   * Add listeners to the self preferenced elements to track self preferenced result clicks.
   * @param selfPreferencedElements - An array of self preferenced result elements on the page.
   */
  addSelfPreferencedListeners(selfPreferencedElements: Element[]) {
    // Remove any previously added self preferenced result listeners.
    for (const elementListeners of this.selfPreferencedElementListenersList) {
      elementListeners.element.removeEventListener("click", elementListeners.clickListener, true);
      elementListeners.element.removeEventListener("mousedown", elementListeners.mousedownListener, true);
    }
    this.selfPreferencedElementListenersList = [];

    // Add the self preferenced tracking listeners.
    for (const selfPreferencedElement of selfPreferencedElements) {
      if (selfPreferencedElement) {
        this.addElementListeners(selfPreferencedElement, ElementType.SelfPreferenced, null, null);
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
      if (__ENABLE_DEVELOPER_MODE__) {
        console.log("Internal Click");
      }
      this.numInternalClicks++;
    }

    // If there was a possible self preferenced click within 1 second of the reporting,
    // we consider the possible self preferenced click to be a self preferenced click.
    if (this.possibleSelfPreferencedClickTimeStamp &&
      this.possibleSelfPreferencedClickTimeStamp >= timeStamp - maxClickToPageVisitEndDelay) {
      if (__ENABLE_DEVELOPER_MODE__) {
        console.log("Self Preferenced Result Click");
      }
      this.numSelfPreferencedClicks++;
    }

    // Send data to background page
    webScience.pageManager.sendMessage({
      type: "SerpVisitData",
      data: {
        searchEngine: this.searchEngine,
        query: this.query,
        queryVertical: this.queryVertical,
        pageId: this.pageId,
        attentionDuration: this.getAttentionDuration(),
        dwellTime: timeStamp - this.pageVisitStartTime,
        pageLoaded: this.pageLoaded,
        pageNum: this.pageNum,
        organicDetails: this.organicDetails,
        organicClicks: this.organicClicks,
        selfPreferencedDetails: this.selfPreferencedDetails,
        numSelfPreferencedClicks: this.numSelfPreferencedClicks,
        numAdResults: this.numAdResults,
        numAdClicks: this.numAdClicks,
        numInternalClicks: this.numInternalClicks,
        searchAreaTopHeight: this.searchAreaTopHeight,
        searchAreaBottomHeight: this.searchAreaBottomHeight,
        pageVisitStartTime: this.pageVisitStartTime,
        selfPreferencingType: this.selfPreferencingType
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
 * @returns {number} The number of pixels between the top of the page and the bottom of the element.
 */
export function getElementBottomHeight(element: Element) {
  try {
    return window.pageYOffset + element.getBoundingClientRect().bottom
  } catch (error) {
    return null;
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
