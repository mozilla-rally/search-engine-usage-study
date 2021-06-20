import { timing } from "@mozilla/web-science";
export enum MousedownType {
  Organic,
  Internal,
  Ad,
}

// TODO: this should be even less maybe
const maxClickDelay = 500;

/**
 * Functions for content scripts
 */
export class PageValues {
  /**
   * The name of the search engine that this object is tracking
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
   * How long the page has had the user's attention.
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
   * The number of advertisement on the page.
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
   * Details of the organic results on the page.
   */
  internalListeners: { document: Document, clickListener: (event: MouseEvent) => void, mousedownListener: (event: MouseEvent) => void }[] = [];

  organicListeners: { element: Element, clickListener: (event: MouseEvent) => void, mousedownListener: (event: MouseEvent) => void }[] = [];

  adListeners: { element: Element, clickListener: (event: MouseEvent) => void, mousedownListener: (event: MouseEvent) => void, }[] = [];

  mostRecentMousedown: { type: MousedownType, href: string, index: number };

  mostRecentRecordedClickTimeStamp: number = null;

  possibleInternalClickTimeStamp: number = null;

  constructor(searchEngine: string, onNewTab: (url) => void) {
    this.searchEngine = searchEngine;
    this.pageId = webScience.pageManager.pageId;

    browser.runtime.onMessage.addListener((message) => {
      if (message.type === "CreatedNavigationTargetMessage") {
        const details = message.details;
        if (this.mostRecentRecordedClickTimeStamp &&
          this.mostRecentRecordedClickTimeStamp >= (timing.fromMonotonicClock(details.timeStamp, false) - maxClickDelay)) {
          this.mostRecentRecordedClickTimeStamp = null;
          return;
        }
        console.debug(details);
        onNewTab(details.url);
      }
    });

    webScience.pageManager.onPageAttentionUpdate.addListener(({ timeStamp }) => {
      // If the page just lost attention, add to the attention duration
      // and possibly the attention and audio duration, and stop the timer
      if (!webScience.pageManager.pageHasAttention) {
        this.attentionDuration += timeStamp - this.lastAttentionUpdateTime;
      }
      this.lastAttentionUpdateTime = timeStamp;
    });
    this.lastAttentionUpdateTime = webScience.pageManager.pageVisitStartTime;
  }

  getAttentionDuration() {
    if (webScience.pageManager.pageHasAttention) {
      return this.attentionDuration + (timing.now() - this.lastAttentionUpdateTime);
    } else {
      return this.attentionDuration;
    }
  }

  resetAttentionTracking(timeStamp = timing.now()) {
    this.attentionDuration = 0;
    this.lastAttentionUpdateTime = timeStamp;
  }

  addOrganicListeners(organicLinkElements: Element[][]) {
    for (const organicListener of this.organicListeners) {
      organicListener.element.removeEventListener("click", organicListener.clickListener, true);
      organicListener.element.removeEventListener("mousedown", organicListener.mousedownListener, true);
    }
    this.organicListeners = [];

    for (let i = 0; i < organicLinkElements.length; i++) {
      const organicLinkElementsAtIndex = organicLinkElements[i];
      for (const organicLinkElement of organicLinkElementsAtIndex) {
        const organicClickListener = (event: MouseEvent) => {
          if (!(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) {
            console.debug(`Internal Click: Ranking: ${i}, AttentionDuration: ${this.getAttentionDuration()}, PageLoaded: ${this.pageLoaded}`);
            this.organicClicks.push({ Ranking: i, AttentionDuration: this.getAttentionDuration(), PageLoaded: this.pageLoaded });
            this.mostRecentRecordedClickTimeStamp = timing.fromMonotonicClock(event.timeStamp, true);
          }
        }

        const organicMousedownListener = (_event: MouseEvent) => {
          if ((organicLinkElement as any).href) {
            this.mostRecentMousedown = {
              type: MousedownType.Organic,
              href: (organicLinkElement as any).href,
              index: i,
            }
          }
        }

        organicLinkElement.addEventListener("click", organicClickListener, true);
        organicLinkElement.addEventListener("mousedown", organicMousedownListener, true);
        this.organicListeners.push({ element: organicLinkElement, clickListener: organicClickListener, mousedownListener: organicMousedownListener });
      }
    }
  }

  addAdClickListeners(adLinkElements: Element[]) {
    for (const adListener of this.adListeners) {
      adListener.element.removeEventListener("click", adListener.clickListener, true);
      adListener.element.removeEventListener("mousedown", adListener.mousedownListener, true);
    }
    this.adListeners = [];

    for (const adLinkElement of adLinkElements) {
      const adClickListener = (event: MouseEvent) => {
        if (!(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) {
          console.debug("Advertisement Click")
          this.numAdClicks++;
          this.mostRecentRecordedClickTimeStamp = timing.fromMonotonicClock(event.timeStamp, true);
        }
      }

      const adMousedownListener = (event: MouseEvent) => {
        if (event.target instanceof Element) {
          const hrefElement = event.target.closest("[href]");
          if (hrefElement) {
            const href = (hrefElement as any).href;
            if (href) {
              this.mostRecentMousedown = {
                type: MousedownType.Ad,
                href: href,
                index: null
              }
            }
          }
        }
      }

      adLinkElement.addEventListener("click", adClickListener, true);
      adLinkElement.addEventListener("mousedown", adMousedownListener, true);
      this.adListeners.push({ element: adLinkElement, clickListener: adClickListener, mousedownListener: adMousedownListener });
    }
  }

  addInternalListeners(getInternalLink: (target: Element) => string) {
    for (const internalListener of this.internalListeners) {
      internalListener.document.removeEventListener("click", internalListener.clickListener, true);
      internalListener.document.removeEventListener("mousedown", internalListener.mousedownListener, true);
    }
    this.internalListeners = [];

    const internalClickListener = (event: MouseEvent) => {
      if (!(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) {
        if (event.target instanceof Element) {
          const href = getInternalLink(event.target as Element);
          if (href) {
            console.debug("Internal Click")
            this.numInternalClicks++;
            this.mostRecentRecordedClickTimeStamp = timing.fromMonotonicClock(event.timeStamp, true);
          } else if (href === "") {
            this.possibleInternalClickTimeStamp = timing.fromMonotonicClock(event.timeStamp, true);
          }
        }
      }
    }

    const internalMousedownListener = (event: MouseEvent) => {
      if (event.target instanceof Element) {
        const href = getInternalLink(event.target as Element);
        if (href) {
          this.mostRecentMousedown = {
            type: MousedownType.Internal,
            href: href,
            index: null
          }
        }
      }
    }

    document.addEventListener("click", internalClickListener, true);
    document.addEventListener("mousedown", internalMousedownListener, true);
    this.internalListeners.push({ document: document, clickListener: internalClickListener, mousedownListener: internalMousedownListener });
  }

  reportResults(timeStamp: number) {
    // If pageIsCorrect is false, we do not report
    if (!this.pageIsCorrect) {
      console.debug(
        "Loaded module " + this.searchEngine + " is not passing page correctness test"
      )
      return
    }

    // TODO adjust this time
    if (this.possibleInternalClickTimeStamp &&
      this.possibleInternalClickTimeStamp >= timeStamp - 500) {
      console.debug("Internal Click")
      this.numInternalClicks++;
    }

    const data = {
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
    }

    console.log("HELLO")
    console.log(data)
    console.log("HELLO")

    // Send data to background page
    browser.runtime.sendMessage({
      type: "SerpVisitData",
      data: data,
    })
  }
}
