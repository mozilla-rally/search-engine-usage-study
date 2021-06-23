import { timing } from "@mozilla/web-science";

/**
 * A class to track page values for SERP pages
 */
export class PageValues {
  /**
   * The name of the search engine that is being tracked
   */
  readonly searchEngine: string;

  /**
   * The pageId for the page from webScience.pageManager
   */
  pageId: string = null;

  /**
   * Whether the page is a basic web SERP.
   */
  pageIsCorrect = false;

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
   * Page number of the SERP page.
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
  organicResults: Array<OrganicDetail> = [];

  /**
   * An array of the listeners tracking internal clicks on the page.
   */
  internalListeners: InternalListener[] = [];

  /**
   * An array of the listeners tracking organic clicks on the page.
   */
  organicListeners: OrganicListener[] = [];

  /**
   * An array of the listeners tracking advertisement clicks on the page.
   */
  adListeners: AdListener[] = [];

  /**
   * Details about the element that most recently had the mousedown event fired for it.
   */
  mostRecentMousedown: RecentMousedown;

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
   * Create a PageValues object.
   * @param {string} searchEngine - The name of the search engine being tracked.
   * @param {callback} onNewTab - A callback that will be passed the url if a new tab is opened
   * from this page and determine if a click occurred
   */
  constructor(searchEngine: string, onNewTab: (url: string) => void) {
    this.searchEngine = searchEngine;
    this.pageId = webScience.pageManager.pageId;

    // Receives messages from the background when the background receives 
    // onCreatedNavigationTarget messages with the tab of this page as the source.
    browser.runtime.onMessage.addListener((message) => {
      if (message.type === "CreatedNavigationTargetMessage") {
        const details = message.details;
        // If we recently recorded a click, then we assume that this message is for the opening of a link
        // that has already been recorded and we ignore it. Otherwise, we pass the url of the opened tab
        // to the onNewTab callback.
        // TODO: the delay of 500 ms should maybe be even less?
        if (this.mostRecentRecordedClickTimeStamp &&
          this.mostRecentRecordedClickTimeStamp >= (timing.fromMonotonicClock(details.timeStamp, false) - 500)) {
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
  resetTracking(timeStamp = timing.now()) {
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
   * Add listeners to track organic clicks.
   * @param {Element[][]} organicLinkElements - For each organic search result, an array
   * of the organic link elements for that result.
   **/
  addOrganicListeners(organicLinkElements: Element[][]) {
    // Remove any existing listeners tracking organic clicks
    for (const organicListener of this.organicListeners) {
      organicListener.element.removeEventListener("click", organicListener.clickListener, true);
      organicListener.element.removeEventListener("mousedown", organicListener.mousedownListener, true);
    }
    this.organicListeners = [];

    for (let i = 0; i < organicLinkElements.length; i++) {
      const organicLinkElementsAtIndex = organicLinkElements[i];
      for (const organicLinkElement of organicLinkElementsAtIndex) {
        // A listener for click events on organic link elements
        const organicClickListener = (event: MouseEvent) => {
          if (!(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) {
            this.organicClicks.push({ Ranking: i, AttentionDuration: this.getAttentionDuration(), PageLoaded: this.pageLoaded });
            this.mostRecentRecordedClickTimeStamp = timing.fromMonotonicClock(event.timeStamp, true);
          }
        }

        // A listener for mousedown events on organic link elements
        const organicMousedownListener = (_event: MouseEvent) => {
          if ((organicLinkElement as any).href) {
            this.mostRecentMousedown = {
              type: ElementType.Organic,
              href: (organicLinkElement as any).href,
              index: i,
            }
          }
        }

        // Add the organic click tracking listeners
        organicLinkElement.addEventListener("click", organicClickListener, true);
        organicLinkElement.addEventListener("mousedown", organicMousedownListener, true);
        this.organicListeners.push({ element: organicLinkElement, clickListener: organicClickListener, mousedownListener: organicMousedownListener });
      }
    }
  }

  /**
   * Add listeners to track ad clicks.
   * @param {Element[]} adLinkElements - An array of advertisement link elements on the page.
   **/
  addAdListeners(adLinkElements: Element[]) {
    // Remove any existing listeners tracking ad clicks
    for (const adListener of this.adListeners) {
      adListener.element.removeEventListener("click", adListener.clickListener, true);
      adListener.element.removeEventListener("mousedown", adListener.mousedownListener, true);
    }
    this.adListeners = [];

    for (const adLinkElement of adLinkElements) {
      // A listener for click events on ad link elements
      const adClickListener = (event: MouseEvent) => {
        if (!(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) {
          this.numAdClicks++;
          this.mostRecentRecordedClickTimeStamp = timing.fromMonotonicClock(event.timeStamp, true);
        }
      }

      // A listener for mousedown events on ad link elements
      const adMousedownListener = (event: MouseEvent) => {
        if (event.target instanceof Element) {
          const hrefElement = event.target.closest("[href]");
          if (hrefElement) {
            const href = (hrefElement as any).href;
            if (href) {
              this.mostRecentMousedown = {
                type: ElementType.Ad,
                href: href,
                index: null
              }
            }
          }
        }
      }

      // Add the ad click tracking listeners
      adLinkElement.addEventListener("click", adClickListener, true);
      adLinkElement.addEventListener("mousedown", adMousedownListener, true);
      this.adListeners.push({ element: adLinkElement, clickListener: adClickListener, mousedownListener: adMousedownListener });
    }
  }

  /**
   * Add listeners to track internal clicks.
   * @param {callback} getInternalLink - A callback function that returns a URL if the target element is
   * an internal link element and the href of the element is a link to an internal page. It returns
   * an empty string if the element was possibly an internal link element. Otherwise, returns null.
   **/
  addInternalListeners(getInternalLink: (target: Element) => string) {
    // Remove any existing listeners tracking internal clicks
    for (const internalListener of this.internalListeners) {
      internalListener.document.removeEventListener("click", internalListener.clickListener, true);
      internalListener.document.removeEventListener("mousedown", internalListener.mousedownListener, true);
    }
    this.internalListeners = [];

    // A listener for click events on internal link elements
    const internalClickListener = (event: MouseEvent) => {
      if (!(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) {
        if (event.target instanceof Element) {
          const href = getInternalLink(event.target as Element);
          if (href) {
            this.numInternalClicks++;
            this.mostRecentRecordedClickTimeStamp = timing.fromMonotonicClock(event.timeStamp, true);
          } else if (href === "") {
            this.possibleInternalClickTimeStamp = timing.fromMonotonicClock(event.timeStamp, true);
          }
        }
      }
    }

    // A listener for mousedown events on internal link elements
    const internalMousedownListener = (event: MouseEvent) => {
      if (event.target instanceof Element) {
        const href = getInternalLink(event.target as Element);
        if (href) {
          this.mostRecentMousedown = {
            type: ElementType.Internal,
            href: href,
            index: null
          }
        }
      }
    }

    // Add the internal click tracking listeners
    document.addEventListener("click", internalClickListener, true);
    document.addEventListener("mousedown", internalMousedownListener, true);
    this.internalListeners.push({ document: document, clickListener: internalClickListener, mousedownListener: internalMousedownListener });
  }

  /**
   * Report page data to the background.
   */
  reportResults(timeStamp: number) {
    // If pageIsCorrect is false, we do not report
    if (!this.pageIsCorrect) {
      return
    }

    // If there was a possible internal click within 1 second of the reporting,
    // we consider the possible internal click to be an internal click.
    // TODO: maybe use different delay than 1 second?
    if (this.possibleInternalClickTimeStamp &&
      this.possibleInternalClickTimeStamp >= timeStamp - 1000) {
      this.numInternalClicks++;
    }

    // Send data to background page
    browser.runtime.sendMessage({
      type: "SerpVisitData",
      data: {
        searchEngine: this.searchEngine,
        attentionDuration: this.getAttentionDuration(),
        pageNum: this.pageNum,
        organicDetails: this.organicResults,
        organicClicks: this.organicClicks,
        numAdResults: this.numAdResults,
        numAdClicks: this.numAdClicks,
        numInternalClicks: this.numInternalClicks,
        searchAreaTopHeight: this.searchAreaTopHeight,
        searchAreaBottomHeight: this.searchAreaBottomHeight,
        pageId: this.pageId
      },
    })
  }
}
