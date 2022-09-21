import { timing, matching } from "@mozilla/web-science";
import { getSerpQuery } from "../Utils";

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
   * The number of results produced for the query by the search engine.
   */
  numResults: number = null;

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
    getSerpQueryVertical: () => string,
    getNumResults: () => number) {

    this.determinePageValues = () => {
      if (__ENABLE_DEVELOPER_MODE__) {
        console.log("Determining page values");
      }
      this.isWebSerpPage = getIsWebSerpPage();
      if (!this.isWebSerpPage) return;

      this.query = getSerpQuery(window.location.href, this.searchEngine);

      this.queryVertical = getSerpQueryVertical ? getSerpQueryVertical() : null;

      this.numResults = getNumResults ? getNumResults() : null;

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
    getSerpQueryVertical: () => string = null,
    getNumResults: () => number = null) {

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
      getSerpQueryVertical,
      getNumResults);

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
        numResults: this.numResults,
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

  printPageValues() {
    console.log({
      searchEngine: this.searchEngine,
      query: this.query,
      queryVertical: this.queryVertical,
      numResults: this.numResults,
      pageId: this.pageId,
      attentionDuration: this.getAttentionDuration(),
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
    })
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

import DOMPurify from 'dompurify';

/**
 * An HTML class that identifies results that have previously been retrieved by 
 * getSelfPreferencedElements if noRepeats is true.
 */
const trackedElementClass = "rally-study-self-preferenced-tracking";

function getGoogleOrganicResults(): Element[] {
  return Array.from(document.querySelectorAll("#rso .g:not(.rally-study-self-preferenced-tracking):not(.related-question-pair .g):not(.g .g):not(.kno-kp *):not(.kno-kp):not(.g-blk):not([data-async-type='editableDirectionsSearch'] .g)")).filter(element => {
    // Remove shopping results
    return !element.querySelector(":scope > g-card")
  });
}

/**
 * An object that maps self preferenced result types that have a possible replacement
 * to metadata for the result. A self preferenced result type has a possible replacement if
 * Google has a competing service for the self preferenced result type. For example, travel
 * self preferenced results have a competing service (Google Flights), while lyrics do not.
 * @type {Array}
 */
const selfPreferencedResultMetadataReplacement: {
  [type: string]: {
    // The cite element content for a replacement result.
    cite: string;
    // The cite span element content for a replacement result.
    citeSpan: string;
    // Gets the self preferenced results for the result type.
    getResults: () => Element[],
    // Gets fallback data for a replacement result.
    getReplacementData: (element: Element) => ReplacementDataVariableSubset,
    // Gets fallback data for a replacement result.
    getDefaultReplacementData: () => ReplacementDataVariableSubset,
  }
} = {
  thingsToDo: {
    cite: "https://www.google.com",
    citeSpan: " › travel › things-to-do",
    getResults: function (): Element[] {
      return getXPathElements("//*[@id='rso']/*[descendant::*[@role='heading' and starts-with(text(), 'Top sights in')]]");
    },
    getReplacementData: function (element: Element): ReplacementDataVariableSubset {
      return {
        header: getXPathElement(".//*[@role='heading' and starts-with(text(), 'Top sights in')]", element).textContent + " - Google Travel",
        link: getLink(element),
        description: "Plan your trip with Google. Find flights, hotels, vacation rentals, things to do, and more.",
      };
    },
    getDefaultReplacementData: function (): ReplacementDataVariableSubset {
      // From duckduckgo.com search of "Google Things to Do"
      return {
        header: "Things to do - Google Search",
        link: "https://www.google.com/travel/things-to-do",
        description: "Plan your trip with Google. Find flights, hotels, vacation rentals, things to do, and more.",
      };
    },
  },
  vacationRental: {
    cite: "https://www.google.com",
    citeSpan: " › travel › hotels",
    getResults: function (): Element[] {
      return getXPathElements("//*[@id='rso']/*[descendant::*[@role='heading' and starts-with(text(), 'Vacation Rentals |')]]");
    },
    getReplacementData: function (element: Element): ReplacementDataVariableSubset {
      return {
        header: getXPathElement(".//*[@role='heading' and starts-with(text(), 'Vacation Rentals |')]", element).textContent + " - Google Travel",
        link: getLink(element),
        description: "Plan your trip with Google. Find flights, hotels, vacation rentals, things to do, and more.",
      };
    },
    getDefaultReplacementData: function (): ReplacementDataVariableSubset {
      // duckduckgo.com search of "Google Vacation Rentals" does not provide a search result specifically for
      // Google Vacation Rentals so we instead used HTML tags on the Google Vacation Rentals homepage.
      return {
        // From the HTML <title> tag on the Google Vacation Rentals homepage.
        header: "Google Hotel Search",
        // This URL takes you to the Google Vacation Rentals homepage.
        link: "https://www.google.com/travel/hotels?ts=CAI",
        // From the HTML <meta name="description"> tag on the Google Vacation Rentals homepage.
        description: "Plan your trip with Google. Find flights, hotels, vacation rentals, things to do, and more.",
      };
    },
  },
  hotel: {
    cite: "https://www.google.com",
    citeSpan: " › travel › hotels",
    getResults: function (): Element[] {
      return getXPathElements("//*[@id='rso']/*[descendant::*[@role='heading' and starts-with(text(), 'Hotels |')]]");
    },
    getReplacementData: function (element: Element): ReplacementDataVariableSubset {
      return {
        // The tail is from a DuckDuckGo search of "Google Hotels in Detroit"
        header: getXPathElement(".//*[@role='heading' and starts-with(text(), 'Hotels |')]", element).textContent + " - Google Hotel Search",
        link: getLink(element),
        description: "Find a place to stay quickly and easily. Browse hotel photos and reviews, compare rates and availability, and book a room on Google Hotel Search.",
      };
    },
    getDefaultReplacementData: function (): ReplacementDataVariableSubset {
      // From duckduckgo.com search of "Google Hotels"
      return {
        header: "Google Hotel Search",
        link: "https://www.google.com/travel/hotels",
        description: "Find a place to stay quickly and easily. Browse hotel photos and reviews, compare rates and availability, and book a room on Google Hotel Search.",
      };
    },
  },
  localSearch: {
    cite: "https://maps.google.com",
    citeSpan: "",
    getResults: function (): Element[] {
      const localSearchResultsType1 = getXPathElements("//*[@id='rso']/*[descendant::*[starts-with(@aria-label, 'Location Results')]]");

      const localSearchResultsType2 = getXPathElements("//*[@id='rcnt']/div/div[descendant::*[starts-with(@aria-label, 'Location Results') and not(ancestor::*[@id='center_col'])]]");

      return localSearchResultsType1.concat(localSearchResultsType2);
    },
    getReplacementData: function (element: Element): ReplacementDataVariableSubset {
      return {
        // The tail is from a DuckDuckGo search of "Google Hotels in Detroit"
        header: getXPathElement(".//*[starts-with(@aria-label, 'Location Results')]", element).textContent + " - Google Maps",
        link: getLink(element),
        description: "Find local businesses, view maps and get driving directions in Google Maps.",
      };
    },
    getDefaultReplacementData: function (): ReplacementDataVariableSubset {
      // From duckduckgo.com search of "Google Maps"
      return {
        header: "Google Maps",
        link: "https://maps.google.com",
        description: "Find local businesses, view maps and get driving directions in Google Maps.",
      };
    },
  },
  map: {
    cite: "https://maps.google.com",
    citeSpan: "",
    getResults: function (): Element[] {
      return getXPathElements("//*[@id='rso']/*[descendant::*[@aria-label= 'From'] and descendant::*[@aria-label= 'To']]");
    },
    getReplacementData: function (element: Element): ReplacementDataVariableSubset {
      // Attempt to get the origin.
      let origin = null;
      try {
        origin = (getXPathElement(".//*[@aria-label='From']", element) as any).placeholder as string;
        if (origin == "My location") {
          origin = "Your location";
        }
      } catch (error) {
        // Do nothing
      }

      // Attempt to get the destination.
      let dest = null;
      try {
        dest = (getXPathElement(".//*[@aria-label='To']", element) as any).placeholder as string;
        if (dest == "My location") {
          dest = null;
        }
      } catch (error) {
        // Do nothing
      }

      const header = origin && dest ? `${origin} to ${dest} - Google Maps` : null;
      const dataUrl = element.querySelector('[data-url]').getAttribute('data-url');
      const url = dataUrl ? "https://www.google.com" + dataUrl : null;

      return {
        header: header,
        link: url,
        description: "Find local businesses, view maps and get driving directions in Google Maps.",
      };
    },
    getDefaultReplacementData: function (): ReplacementDataVariableSubset {
      // From duckduckgo.com search of "Google Maps"
      return {
        header: "Google Maps",
        link: "https://maps.google.com",
        description: "Find local businesses, view maps and get driving directions in Google Maps.",
      };
    },
  },
  flight: {
    cite: "https://www.google.com",
    citeSpan: " › travel › flights",
    getResults: function (): Element[] {
      if (document.querySelector("#kp-wp-tab-AIRFARES")) {
        return getXPathElements("//*[@id='kp-wp-tab-AIRFARES']/*[descendant::g-more-link[descendant::span[text()='Show flights']]]");
      } else {
        return getXPathElements("//*[@id='rso']/*[descendant::g-more-link[descendant::span[text()='Show flights']]]");
      }
    },
    getReplacementData: function (element: Element): ReplacementDataVariableSubset {
      // Attempt to get the origin city.
      let originCity = null;
      try {
        const originValue = (getXPathElement(".//*[@placeholder='Enter an origin']", element) as any).value as string;
        originCity = originValue.substring(0, originValue.indexOf(","));
      } catch (error) {
        // Do nothing
      }

      // Attempt to get the destination city.
      let destCity = null;
      try {
        const destValue = (getXPathElement(".//*[@placeholder='Enter a destination']", element) as any).value as string;
        destCity = destValue.substring(0, destValue.indexOf(","));
      } catch (error) {
        // Do nothing
      }

      let header = null;
      let link = null;
      let description = null;
      if (originCity && destCity) {
        header = `Flights from ${originCity} to ${destCity}` + " - Google Flights";
        link = `https://www.google.com/travel/flights/flights-from-${originCity.replace(/ /g, "-")}-to-${destCity.replace(/ /g, "-")}.html`;
        description = `Find the best flights from ${originCity} to ${destCity} fast, track prices, and book with confidence.`;
      } else if (originCity) {
        header = `Flights from ${originCity}` + " - Google Flights";
        link = `https://www.google.com/travel/flights/flights-from-${originCity.replace(/ /g, "-")}.html`;
        description = `Find the best flights from ${originCity} fast, track prices, and book with confidence.`;
      } else if (destCity) {
        header = `Flights to ${destCity}` + " - Google Flights";
        link = `https://www.google.com/travel/flights/flights-to-${destCity.replace(/ /g, "-")}.html`;
        description = `Find the best flights to ${destCity} fast, track prices, and book with confidence.`;
      }

      return { header, link, description };
    },
    getDefaultReplacementData: function (): ReplacementDataVariableSubset {
      // From duckduckgo.com search of "Google Flights"
      return {
        header: "Book flights with confidence | Google Flights",
        link: "https://www.google.com/flights",
        description: "Find cheap flights and airline tickets. Google Flights helps you compare and track airfares on hundreds of airlines to help you find the best flight deals.",
      };
    },
  },
  // Searching "Flights to Texas" gets this result
  flight2: {
    cite: "https://www.google.com",
    citeSpan: " › travel › flights",
    getResults: function (): Element[] {

      if (document.querySelector("#kp-wp-tab-AIRFARES")) {
        return [];
      } else {
        return getXPathElements("//*[@id='rso']/*[descendant::g-more-link[descendant::span[text()='Search on Google Flights']]]");
      }
    },
    getReplacementData: function (element: Element): ReplacementDataVariableSubset {
      return {
        header: "Book flights with confidence | Google Flights",
        link: "https://www.google.com/flights",
        description: "Find cheap flights and airline tickets. Google Flights helps you compare and track airfares on hundreds of airlines to help you find the best flight deals.",
      };
    },
    getDefaultReplacementData: function (): ReplacementDataVariableSubset {
      // From duckduckgo.com search of "Google Flights"
      return {
        header: "Book flights with confidence | Google Flights",
        link: "https://www.google.com/flights",
        description: "Find cheap flights and airline tickets. Google Flights helps you compare and track airfares on hundreds of airlines to help you find the best flight deals.",
      };
    },
  },
}

/**
 * An object that maps self preferenced result types that do not have a possible replacement
 * to metadata for the result. A self preferenced result type does not has a possible replacement
 * if Google does not have a competing service for the self preferenced result type. For example,
 * lyrics self preferenced results do not have have a competing service, while travel does (Google Flights).
 * @type {Array}
 */
const selfPreferencedResultMetadataNoReplacement: {
  [type: string]: {
    // Gets the self preferenced results for the result type.
    getResults: () => Element[],
  }
} = {
  lyric: {
    getResults: function (): Element[] {
      // Gets lyrics in the 'Lyrics' tab of a tabbed knowledge panel.
      let lyricsElements: Element[] = Array.from(document.querySelectorAll("[aria-label='Lyrics']"));

      // If there is not a knowledge panel, gets the standard lyrics result.
      if (!document.querySelector("[id^='kp-wp-tab']")) {
        lyricsElements = lyricsElements.concat(getXPathElements("//*[@id='rso']/*[not(@aria-label='Lyrics') and descendant::*[@data-lyricid]]")).filter(element => {
          return !element.querySelector("[aria-label='Lyrics']");
        });
      } else {
        lyricsElements = lyricsElements.concat(getXPathElements("//*[starts-with(@id, 'kp-wp-tab-default_tab')]/*[not(@aria-label='Lyrics') and descendant::*[@data-lyricid]]")).filter(element => {
          return !element.querySelector("[aria-label='Lyrics']");
        });

        lyricsElements = lyricsElements.concat(getXPathElements("//*[@id='kp-wp-tab-overview']/*[not(@aria-label='Lyrics') and descendant::*[@data-lyricid]]").filter(element => {
          return !element.querySelector("[aria-label='Lyrics']");
        }));
      }

      return lyricsElements;
    },
  },
  weather: {
    getResults: function (): Element[] {
      return getXPathElements("//*[@id='rso']/*[descendant::h2[text()='Weather Result']]");
    },
  },
  shoppingMainResults: {
    getResults: function (): Element[] {
      // Get the self preferenced shopping results in the main results column that are labeled as 'Ads'
      // and generally at the top of the page.
      const adSelfPreferencedProductResult: Element[] = Array.from(document.querySelectorAll(".cu-container")).filter(element => {
        return !element.closest("#rhs") && !element.querySelector(".commercial-unit-desktop-rhs")
      });

      // Get the self preferenced shopping results in the main results column that are not labeled as 'Ads'
      // and generally not at the top of the page.
      const nonAdSelfPreferencedProductResult: Element[] = Array.from(document.querySelectorAll(".g")).filter(element => {
        return !!element.querySelector("[data-enable-product-traversal]") && !element.closest("#rhs");
      });

      return adSelfPreferencedProductResult.concat(nonAdSelfPreferencedProductResult);
    },
  },
}

function elementFilter(element: Element) {
  if (element.querySelector("#rso") || element.querySelector("[id^='kp-wp-tab']") || element.querySelectorAll("div.g").length > 1) {
    return false;
  }

  return true;
}

/**
 * Attempts to create a basic organic result based on the organic results on the SERP.
 * @returns {string} The created element.
 */
function getCreatedTemplateSER(): Element {
  // Gets the organic results
  const organicResults = getGoogleOrganicResults().filter(elementFilter).filter(element => {
    return !!element.querySelectorAll("[data-content-feature]");
  });

  // Gets the organic element with the smallest height. We are assuming the smallest height element will be
  // the most basic organic result.
  let minTemplateSearchResultHeight = Number.MAX_VALUE;
  let templateSearchResult: Element = null;
  for (const organicResult of organicResults) {
    const resultOffsetHeight = (organicResult as HTMLElement).offsetHeight;
    if (resultOffsetHeight && resultOffsetHeight > 0 && resultOffsetHeight < minTemplateSearchResultHeight) {
      templateSearchResult = organicResult;
      minTemplateSearchResultHeight = resultOffsetHeight;
    }
  }

  if (!templateSearchResult) {
    return null;
  }

  const linkElement = getXPathElement(".//a[@href and descendant::h3 and descendant::cite and not(ancestor::g-expandable-container)]", templateSearchResult);

  const headerElement = linkElement.querySelector("h3");
  const citeElement = linkElement.querySelector("cite");
  const description = Array.from(templateSearchResult.querySelectorAll("div:not(g-expandable-container *)")).filter(element => {
    return !element.querySelector("*:not(span):not(em)") && (element.closest(".g").isSameNode(headerElement.closest(".g")));
  }).reduce((largestElement, currentElement) => {
    return currentElement.textContent.length > largestElement.textContent.length ?
      currentElement :
      largestElement
  });

  if (!headerElement || !citeElement || !description) {
    return null;
  }

  const replacementSearchResult = templateSearchResult.cloneNode() as Element;
  const elementsToReplace = [headerElement, citeElement, description];

  const templateToReplacementElementMap = new Map();
  templateToReplacementElementMap.set(templateSearchResult, replacementSearchResult);

  let loopCounter = 0;

  for (const elementToReplace of elementsToReplace) {
    let childReplacementNode = null;
    let currentNode = elementToReplace;

    while (!templateToReplacementElementMap.has(currentNode)) {
      loopCounter += 1;
      if (loopCounter >= 30) {
        return null;
      }

      const newReplacementNode = currentNode.cloneNode();
      if (currentNode == description) {
        (newReplacementNode as Element).classList.add("self-preferenced-replacement-description");
      }

      if (childReplacementNode) {
        (newReplacementNode as Element).append(childReplacementNode);
      }

      childReplacementNode = newReplacementNode;
      templateToReplacementElementMap.set(currentNode, newReplacementNode);

      currentNode = currentNode.parentElement;
    }

    if (childReplacementNode) {
      templateToReplacementElementMap.get(currentNode).append(childReplacementNode)
    }
  }

  if (linkElement.children[0].matches("br")) {
    replacementSearchResult.querySelector("a").prepend(document.createElement('br'))
  }

  let templateSpan = templateSearchResult.querySelector("a cite > span");
  if (!templateSpan) {
    templateSpan = document.querySelector(".g a cite > span");
  }

  if (templateSpan) {
    replacementSearchResult.querySelector("cite").append(templateSpan.cloneNode())
  } else {
    return null;
  }

  return replacementSearchResult;
}

/**
 * Creates a basic organic result with hardcoded HTML.
 * @returns {string} The created element.
 */
function getDefaultTemplateSER(): HTMLDivElement {
  const replacementSER = document.createElement('div');
  replacementSER.classList.add('g');
  replacementSER.innerHTML = `
<div class="jtfYYd">
	<div class="NJo7tc Z26q7c jGGQ5e" data-header-feature="0">
		<div class="yuRUbf">
			<a href="">
				<br>
				<h3 class="LC20lb MBeuO DKV0Md"></h3>
				<div class="TbwUpd NJjxre">
					<cite class="iUh30 qLRx3b tjvcx" role="text">
						<span class="dyjrff qzEoUe" role="text"></span>
					</cite>
				</div>
			</a>
		</div>
	</div>
	<div class="NJo7tc Z26q7c uUuwM" data-content-feature="1">
		<div class="VwiC3b yXK7lf MUxGbd yDYNvb lyLwlc lEBKkf self-preferenced-replacement-description">
		</div>
	</div>
</div>
`;

  // Get all of the CSS selectors for the document.
  const selectors: string[] = [];
  for (const sheet of document.styleSheets) {
    try {
      selectors.push(...Object.values(sheet.cssRules).map(x => { return x["selectorText"] }).filter(selectorText => !!selectorText));
    } catch (error) {
      // Do nothing
    }
  }
  const selectorsString = selectors.join(" ");


  // A list of all the classes in the hardcoded HTML above
  const classes = ['DKV0Md', 'LC20lb', 'MBeuO', 'MUxGbd', 'NJjxre', 'NJo7tc',
    'TbwUpd', 'VwiC3b', 'Z26q7c', 'dyjrff', 'iUh30', 'jGGQ5e',
    'jtfYYd', 'lEBKkf', 'lyLwlc', 'qLRx3b', 'qzEoUe', 'tjvcx', 'uUuwM',
    'yDYNvb', 'yXK7lf', 'yuRUbf'];

  // Check that each of the classes in the default template HTML is either in the CSS or in the DOM.
  for (const className of classes) {
    if (!selectorsString.includes(className) && !document.querySelector(`.${className}`)) {
      console.log(`Class not found: ${className}`);
      return null;
    }
  }

  return replacementSER;
}



/**
 * Creates a replacement result from the given parameters.
 * @param {string} header - The header for the replacement result.
 * @param {string} link - The link for the replacement result.
 * @param {string} description - The description for the replacement result.
 * @param {string} cite - The cite for the replacement result.
 * @param {string} citeSpan - The cite span for the replacement result.
 * @returns the replacement result created with the given parameters.
 */
function generateReplacementResult(header: string, link: string, description: string, cite: string, citeSpan: string): Element {
  try {
    const replacementSER = getCreatedTemplateSER();
    if (replacementSER) {
      replacementSER.querySelector("a h3").textContent = header;
      replacementSER.querySelector("a").href = link;
      replacementSER.querySelector(".self-preferenced-replacement-description").textContent = description;
      replacementSER.querySelector("a cite").prepend(document.createTextNode(cite));
      replacementSER.querySelector("a cite > span").textContent = citeSpan;

      if (__ENABLE_DEVELOPER_MODE__) {
        console.log("Self preferenced result created from organic results");
      }

      replacementSER.classList.add(trackedElementClass);
      return replacementSER;
    }


  } catch (error) {
    // Do nothing
  }


  try {
    const replacementSER = getDefaultTemplateSER();
    if (replacementSER) {
      replacementSER.querySelector("h3").textContent = header;
      replacementSER.querySelector("a").href = link;
      replacementSER.querySelector(".self-preferenced-replacement-description").textContent = description;
      replacementSER.querySelector("cite").prepend(document.createTextNode(cite));
      replacementSER.querySelector("cite > span").textContent = citeSpan;

      if (__ENABLE_DEVELOPER_MODE__) {
        console.log("Self preferenced result created from hardcoded template");
      }

      replacementSER.classList.add(trackedElementClass);
      return replacementSER;
    }

  } catch (error) {
    // Do nothing
  }

  return null;
}

/**
 * @returns the main link for a self preferenced result (e.g., the "More Places" button link) if it can be found.
 * Otherwise, null.
 */
function getLink(element: Element): string {
  let link = null;

  // Sometimes the g-more-link element is within the a element and sometimes the a element is within
  // g-more-link element so we try both ways here.
  try {
    link = (getXPathElement(".//a[@href and descendant::g-more-link]", element) as any).href;
  } catch (error) {
    // Do nothing
  }
  if (!link) {
    try {
      link = (getXPathElement(".//g-more-link//a[@href]", element) as any).href;
    } catch (error) {
      // Do nothing
    }
  }
  return link;
}

/**
 * @returns the data for a replacement result for all self preferenced result types except Google Flights.
 */
function getReplacementData(element, type): ReplacementData {
  const cite = selfPreferencedResultMetadataReplacement[type].cite;
  const citeSpan = selfPreferencedResultMetadataReplacement[type].citeSpan;

  try {
    const replacementData = selfPreferencedResultMetadataReplacement[type].getReplacementData(element);
    if (replacementData.description && replacementData.header && replacementData.link) {
      return { ...replacementData, cite, citeSpan };
    }
  } catch (error) {
    // Do nothing
  }

  return {
    ...selfPreferencedResultMetadataReplacement[type].getDefaultReplacementData(),
    cite,
    citeSpan
  };
}

/**
 * @param {boolean} excludeTrackedElements - Whether to get the results that have been marked
 * as already being tracked.
 * call to this function.
 * @returns an object where each key is a self preferenced result type and each value
 * is the self preferenced results on the SERP of that type.
 */
function getSelfPreferencedElements(excludeTrackedElements: boolean): {
  [type: string]: { elements: Element[], possibleReplacementResult: boolean }
} {

  // Get the self preferenced results for each of the types we are tracking.
  const selfPreferencedResults: {
    [type: string]: { elements: Element[], possibleReplacementResult: boolean }
  } = {};
  for (const selfPreferencedResultType in selfPreferencedResultMetadataReplacement) {
    selfPreferencedResults[selfPreferencedResultType] = {
      elements: selfPreferencedResultMetadataReplacement[selfPreferencedResultType].getResults().filter(elementFilter),
      possibleReplacementResult: true,
    }
  }
  for (const selfPreferencedResultType in selfPreferencedResultMetadataNoReplacement) {
    selfPreferencedResults[selfPreferencedResultType] = {
      elements: selfPreferencedResultMetadataNoReplacement[selfPreferencedResultType].getResults().filter(elementFilter),
      possibleReplacementResult: false,
    }
  }

  if (excludeTrackedElements) {
    // Filter out the results that have been marked as being tracked.
    for (const selfPreferencedResultType in selfPreferencedResults) {
      selfPreferencedResults[selfPreferencedResultType].elements = selfPreferencedResults[selfPreferencedResultType].elements.filter(element => {
        return !element.classList.contains(trackedElementClass);
      });
    }
  }

  return selfPreferencedResults;
}

// A list of self preferenced result details that have been removed from the SERP.
const removedSelfPreferencedElementDetails: SelfPreferencedDetail[] = [];
/**
 * Removes the self preferenced results on the SERP.
 * @returns {string} An array of the details of the self preferenced results that were removed from the page.
 */
export function removeSelfPreferenced(): SelfPreferencedDetail[] {

  const selfPreferencedResults: {
    [type: string]: { elements: Element[], possibleReplacementResult: boolean }
  } = getSelfPreferencedElements(true);

  // Add trackedElementClass to all all the identified self preferenced results so that we do not try
  // to remove them again on a subsequent call to this method.
  for (const selfPreferencedResultType in selfPreferencedResults) {
    const elements = selfPreferencedResults[selfPreferencedResultType].elements;
    for (const element of elements) {
      element.classList.add(trackedElementClass);
    }
  }

  // Get details of all self preferenced results
  for (const selfPreferencedResultType in selfPreferencedResults) {
    const elements = selfPreferencedResults[selfPreferencedResultType].elements;
    for (const element of elements) {
      removedSelfPreferencedElementDetails.push({
        topHeight: getElementTopHeight(element),
        bottomHeight: getElementBottomHeight(element),
        type: selfPreferencedResultType
      });
    }
  }

  // Remove all self preferenced results
  // This is in separate loop from the one above that gets the details so that
  // any removal will not affect the heights
  for (const selfPreferencedResultType in selfPreferencedResults) {
    const elements = selfPreferencedResults[selfPreferencedResultType].elements;
    for (const element of elements) {
      (element as any).style.setProperty("display", "none");
    }
  }

  return removedSelfPreferencedElementDetails;
}

/**
 * @returns {string} An object containing an array of the details of the self preferenced results on the page and an array of
 * the self preferenced results. This is used if there will be no modification to the SERP.
 */
export function getSelfPreferencedDetailsAndElements(): { selfPreferencedElementDetails: SelfPreferencedDetail[], selfPreferencedElements: Element[] } {

  // We pass false to getSelfPreferencedElements because we want to return details for all self preferenced elements on the page,
  // even if details for a particular element were previously returned by a call to this function.
  const selfPreferencedResults: {
    [type: string]: { elements: Element[], possibleReplacementResult: boolean }
  } = getSelfPreferencedElements(false);

  const selfPreferencedElementDetails: SelfPreferencedDetail[] = [];
  const selfPreferencedElements: Element[] = [];

  // Get the details of all the self preferenced results.
  for (const selfPreferencedResultType in selfPreferencedResults) {
    const elements = selfPreferencedResults[selfPreferencedResultType].elements;
    for (const element of elements) {
      selfPreferencedElements.push(element);
      selfPreferencedElementDetails.push({
        topHeight: getElementTopHeight(element),
        bottomHeight: getElementBottomHeight(element),
        type: selfPreferencedResultType
      });
    }
  }

  return { selfPreferencedElementDetails, selfPreferencedElements };
}

// A list of replacement results that have been added to the SERP.
const replacedSelfPreferencedElementsAndType: { selfPreferencedType: string, selfPreferencedElement: Element }[] = [];

/**
 * Replaces the self preferenced results on the page for which Google has a competing own service.
 * @param {boolean} lastCall -  Whether this is the last call to this function.
 * @returns {string} An object containing:
 *      1) An array of the details of the replacement results created and of the self preferenced results that were
 *         removed without replacement
 *      2) An array of the replacement results that have been created.
 * the self preferenced results.
 */
export function replaceSelfPreferenced(lastCall: boolean): { selfPreferencedElementDetails: SelfPreferencedDetail[], selfPreferencedElements: Element[] } {
  const selfPreferencedResults: {
    [type: string]: { elements: Element[], possibleReplacementResult: boolean }
  } = getSelfPreferencedElements(true);

  const selfPreferencedResultsToReplace: {
    [type: string]: Element[]
  } = {};

  // Get all the self preferenced elements that will be removed and all the elements that will be replaced.
  for (const selfPreferencedResultType in selfPreferencedResults) {
    if (selfPreferencedResults[selfPreferencedResultType].possibleReplacementResult) {
      selfPreferencedResultsToReplace[selfPreferencedResultType] = selfPreferencedResults[selfPreferencedResultType].elements;
    }
  }

  // Creates the replacement results and removes the self preferenced results they are replacing.
  for (const typeOfSelfPreferencedResultToReplace in selfPreferencedResultsToReplace) {
    for (const selfPreferencedResultToReplace of selfPreferencedResultsToReplace[typeOfSelfPreferencedResultToReplace]) {
      // Get the data used to populate a replacement result from the self preferenced result.
      const replacementData = getReplacementData(selfPreferencedResultToReplace, typeOfSelfPreferencedResultToReplace);

      // Generate a sanitized replacement result.
      let replacementResult = generateReplacementResult(replacementData.header, replacementData.link, replacementData.description, replacementData.cite, replacementData.citeSpan);
      if (replacementResult) {
        const temp = document.createElement('div');
        temp.innerHTML = DOMPurify.sanitize(replacementResult);
        replacementResult = (temp.firstChild as Element);
      }

      // Insert the replacement result right before the self preferenced result and then remove the self preferenced result.
      if (replacementResult) {
        selfPreferencedResultToReplace.parentElement.insertBefore(replacementResult, selfPreferencedResultToReplace);
        (selfPreferencedResultToReplace as any).style.setProperty("display", "none");

        // Add the replacement result to the list of replacement results that is built up across different runs of this function.
        // We do this because if a future run adds more replacement results, we will want to recalculate the position of
        // all the previously added replacement results.
        replacedSelfPreferencedElementsAndType.push({
          selfPreferencedType: typeOfSelfPreferencedResultToReplace,
          selfPreferencedElement: replacementResult,
        });

        // Add trackedElementClass to the element that has been replaced so that we do not try
        // to replace it again on a subsequent call to this method.
        selfPreferencedResultToReplace.classList.add(trackedElementClass);
      } else if (lastCall) {
        // If this is the last call and we failed to generate a replacement result, we just leave the self-preferenced result as-is.
        replacedSelfPreferencedElementsAndType.push({
          selfPreferencedType: typeOfSelfPreferencedResultToReplace,
          selfPreferencedElement: selfPreferencedResultToReplace,
        })
      }
    }
  }


  const replacedSelfPreferencedElements: Element[] = [];
  const replacedSelfPreferencedElementDetails: SelfPreferencedDetail[] = [];

  // Gets the details of replacement results from all runs of this function. We wait until the end of this function call
  // to get these details because replacing a self preferenced result may change the top height and bottom height
  // of a replacement result.
  for (const { selfPreferencedType, selfPreferencedElement } of replacedSelfPreferencedElementsAndType) {
    replacedSelfPreferencedElementDetails.push({
      topHeight: selfPreferencedElement ? getElementTopHeight(selfPreferencedElement) : Number.MAX_SAFE_INTEGER,
      bottomHeight: selfPreferencedElement ? getElementBottomHeight(selfPreferencedElement) : Number.MAX_SAFE_INTEGER,
      type: selfPreferencedType
    });
    replacedSelfPreferencedElements.push(selfPreferencedElement);
  }

  return {
    selfPreferencedElementDetails: replacedSelfPreferencedElementDetails, selfPreferencedElements: replacedSelfPreferencedElements
  };
}
