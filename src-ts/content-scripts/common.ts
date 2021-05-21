/**
 * Functions for content scripts
 */

let pageLoaded = false

let organicDetails: Array<{
  TopHeight: number,
  BottomHeight: number,
  PageNum: number,
}> = []

let numAdResults: number = null

let pageNum: number = null

let pageIsCorrect = null

let timestamp = Date.now()

let searchAreaTopHeight: number = null
let searchAreaBottomHeight: number = null

let lastClickTime: number = null

/**
 * The attribution of the current page
 * @type {string}
 */
let attribution: string = null

/**
 * The attribution ID of the current page
 * @type {string}
 */
let attributionID: string = null

let isInternalLinkFunction: (urlString: string) => boolean = null;


/**
 * The total attention time of the page except for time since the page has most recently
 * received attention if the page currently has attention
 * @type {number}
 */
let totalAttentionTime = 0;

/**
 * The previous start time of the page having attention.
 * Is null if there has not been such a start time yet.
 * @type {number}
 */
let previousAttentionStart = null;



/**
 * A map object that maps the URLs of clicked organic elements to their respective organic element and the index
 * of the organic element within the list of organic elements
 * @type {Map}
 */
const mousedownOrganicLinksMap = new Map<string, {
  element: Element,
  index: number,
}>();

/**
 * The set of URLs of clicked ad elements. We do not map to any details as we do with mousedownOrganicLinksMap
 * because we only track the number of ad clicks
 * @type {string}
 */
const mousedownAdLinks = new Set()


const mousedownInternalLinks = new Set()

/**
 * The number of advertisement clicks
 * @type {number}
 */
let numAdClicks = 0;

/**
 * The number of internal clicks
 * @type {number}
 */
let numInternalClicks = 0;

/**
 * An array of details for each organic link click
 * @type {Array}
 */
const organicClicks: Array<{
  Ranking: number,
  AttentionTime: number,
  Loaded: boolean,
}> = [];

interface LinkListenerDetails {
  element: Element;
  mousedownListener: (_event: Event) => void;
  clickListener: (_event: Event) => void;
}

const elementsWithInternalClickListeners: LinkListenerDetails[] = []

/**
 * An array of organic elements with listeners that have been added to determine organic element clicks
 * This array is used to remove these listeners if we would like to refresh the listeners (ie. because of a page change)
 * @type {Array}
 */
const organicLinksWithListeners: LinkListenerDetails[] = []

/**
 * An array of ad elements with listeners that have been added to determine ad element clicks
 * This array is used to remove these listeners if we would like to refresh the listeners (ie. because of a page change)
 * @type {Array}
 */
const adLinksWithListeners: LinkListenerDetails[] = []

/**
 * Retrieves the first matching element given an xpath query
 * @param {string} xpath - The xpath query
 * @param {Node} contextNode - The context node for the query
 * @returns {Element} The first element matching the xpath
 */
function getXPathElement(xpath: string, contextNode: Node = document): Element {
  const matchingElement = document.evaluate(
    xpath, contextNode,
    null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
  ).singleNodeValue
  return (matchingElement as Element)
}

/**
 * Retrieves an array of all elements matching a given xpath query
 * @param {string} xpath - The xpath query
 * @param {Node} contextNode - The context node for the query
 * @returns {Element} An array of all elements matching the xpath query
 */
function getXPathElements(xpath: string, contextNode: Node = document): Element[] {
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
 * Determines the offset from the top of the document for the element
 * @param {string} element - The element
 * @returns {number} The offset from the top
 */
function getElementTopHeight(element: Element) {
  if (!element) return null
  return window.pageYOffset + element.getBoundingClientRect().top
}


/**
 * Determines the offset from the top of the document for the next element
 * @param {string} element - The element
 * @returns {number} The offset from the top
 */
function getNextElementTopHeight(element: Element) {
  return getElementTopHeight(getNextElement(element))
}

/**
 * Sends a message to the background script and receives page attribution information as a response
 * @param {string} searchEngine - The search engine of the SERP content script, used for validation in the background
 */
function getAttributionDetailsFromBackground(searchEngine: string) {
  if (!attributionID) {
    browser.runtime.sendMessage({ type: "GetPageAttribution", searchEngine: searchEngine }).then(
      response => {
        if (response) {
          if ("attribution" in response) {
            attribution = response["attribution"];
          }
          if ("attributionID" in response) {
            attributionID = response["attributionID"];
          }
        }
      },
      error => {
        console.error(`Error: ${error}`);
      });
  }
}

/**
 * Initializes the PageManager listeners and variables
 */
function initPageManagerListeners(asyncLoads = true) {
  function initModule() {
    registerAttentionListener();
    if (asyncLoads) {
      registerPageVisitEndListener();
      registerPageVisitStartListener();
    }
  }

  if (("webScience" in window) && ("pageManager" in window.webScience)) {
    initModule();
  }
  else {
    if (!("pageManagerHasLoaded" in window)) {
      window.pageManagerHasLoaded = [];
    }
    window.pageManagerHasLoaded.push(initModule);
  }
}


function pageVisitEndListener() {
  if (lastClickTime && Date.now() - lastClickTime < 500) {
    numInternalClicks++;
  }
  reportResults();
}
/**
 * Registers a listener for page visit end events that reports results
 * and resets attention tracking
 */
function registerPageVisitEndListener() {
  webScience.pageManager.onPageVisitStop.addListener(pageVisitEndListener);
}

function pageVisitStartListener({ timeStamp }) {
  timestamp = timeStamp
  resetAttentionTracking();
}

/**
 * Registers a listener for page visit start events
 */
function registerPageVisitStartListener() {
  webScience.pageManager.onPageVisitStart.addListener(pageVisitStartListener);

  // In case we miss an initial pageVisitStart event
  if (webScience.pageManager.pageVisitStarted) {
    pageVisitStartListener({ timeStamp: webScience.pageManager.pageVisitStartTime });
  }
}

/**
 * Retrieves the total attention time of the page
 * @returns {number} The total attention time of the page
 */
function getAttentionTime() {
  if (webScience.pageManager.pageHasAttention && previousAttentionStart) {
    return totalAttentionTime + (performance.now() - previousAttentionStart)
  }
  else {
    return totalAttentionTime;
  }
}

/**
 * Registers the page attention listener that updates total attention time
 */
function registerAttentionListener() {
  // Update previous start on registration because we might have missed
  // the initial pageAttentionUpdate event
  if (webScience.pageManager.pageHasAttention) {
    previousAttentionStart = performance.now()
  }
  webScience.pageManager.onPageAttentionUpdate.addListener(() => {
    // If the update is for the page gaining attention, update the previous attention start time.
    // Otherwise, update total attention time with the time since the previous attention start
    if (webScience.pageManager.pageHasAttention) {
      previousAttentionStart = performance.now()
    } else if (previousAttentionStart) {
      totalAttentionTime = totalAttentionTime + (performance.now() - previousAttentionStart)
    }
  });
}

/**
 * Resets attention tracking for new page visits.
 */
function resetAttentionTracking() {
  totalAttentionTime = 0
  if (webScience.pageManager.pageHasAttention) {
    previousAttentionStart = performance.now()
  } else {
    previousAttentionStart = false
  }
}

/**
 * Retrieve a query string variable from a URL
 * @param {string} url - the URL to retrieve the query string variable from
 * @param {string} parameter - the parameter of the variable in the URL you want to retrieve
 * @returns {string} The query string variable in url for the given parameter. If the parameter
 * does not exist in the URL, returns null.
 */
function getQueryVariable(url, variable) {
  url = url ? url : window.location.href
  variable = variable.replace(/[[\]]/g, "\\$&");
  const regex = new RegExp("[?&]" + variable + "(=([^&#]*)|&|#|$)"),
    results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return "";
  return decodeURIComponent(results[2].replace(/\+/g, " "));
}

/**
 * Gets a query from the URL and sends it to the background page to save
 * @param {string} engine - The search engine that the query was made to
 * @param {string[]} urlKeys - A list of parameters that the query variable could associated with in the URL
 */
function sendQueryToBackground(engine, urlKeys: Array<string>) {
  for (const key of urlKeys) {
    const query = getQueryVariable(window.location.href, key);
    if (query) {
      browser.runtime.sendMessage({ type: "SERPQuery", engine: engine, query: query });
      return;
    }
  }
}

function determineOrganicElementsAndAddListeners(
  organicResults: Element[],
  getPageNumForElement: (Element) => number = () => { return pageNum }) {

  // Removes any existing listeners from organic elements that we previously added
  for (const organicLinkWithListeners of organicLinksWithListeners) {
    organicLinkWithListeners.element.removeEventListener("mousedown", organicLinkWithListeners.mousedownListener, true);
    organicLinkWithListeners.element.removeEventListener("click", organicLinkWithListeners.clickListener, true);
  }

  organicDetails = []

  // For each organic element, adds mousedown and click listeners to any elements with an href attribute
  // Also adds the listeners to a list so that we can later remove them if we want to refresh these listeners                           
  for (let i = 0; i < organicResults.length; i++) {
    const organicResult = organicResults[i]
    organicDetails.push({ TopHeight: getElementTopHeight(organicResult), BottomHeight: getNextElementTopHeight(organicResult), PageNum: getPageNumForElement(organicResult) })

    organicResult.querySelectorAll("[href]").forEach(organicLinkElement => {
      function organicMousedownListener(_event: Event) {
        if ((organicLinkElement as any).href) {
          const organicLinkElementHref = urlFilter(encodeURI((organicLinkElement as any).href))
          mousedownOrganicLinksMap.set(organicLinkElementHref, { element: organicLinkElement, index: i })
        }
      }

      function organicClickListener(event: MouseEvent) {
        if (!(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) {
          organicClicks.push({ Ranking: i, AttentionTime: getAttentionTime(), Loaded: pageLoaded })
        }
      }

      organicLinkElement.addEventListener("mousedown", organicMousedownListener, true);
      organicLinkElement.addEventListener("click", organicClickListener, true);
      organicLinksWithListeners.push({ element: organicLinkElement, mousedownListener: organicMousedownListener, clickListener: organicClickListener })
    });
  }
}

function getIsAdLinkDefault(adLinkElement: Element): boolean {
  return !!(adLinkElement as any).href;
}

/**
 * Get organic and ad results and add listeners for clicks
 * @param {callback} getOrganicResults - Callback to get the organic results of the SERP
 * @param {callback} getAdResults - Callback to get the ad results of the SERP
 */
function determineAdElementsAndAddListeners(
  adResults: Element[],
  getIsAdLinkElement: (adLink: Element) => boolean = getIsAdLinkDefault) {
  // Removes any existing listeners from ad elements that we previously added
  for (const adLinkWithListeners of adLinksWithListeners) {
    adLinkWithListeners.element.removeEventListener("mousedown", adLinkWithListeners.mousedownListener, true);
    adLinkWithListeners.element.removeEventListener("click", adLinkWithListeners.clickListener, true);
  }

  numAdResults = adResults.length

  // For each ad element, adds mousedown and click listeners to any elements with an href attribute
  // Also adds the listeners to a list so that we can later remove them if we want to refresh these listeners  


  for (const adResult of adResults) {
    const fnAdMousedownListener = function adMousedownListener(event: Event) {
      console.log(event.target)
      let adLinkElement = (event.target as any)
      if (getIsAdLinkElement(adLinkElement)) {
        const adLink = adLinkElement.href
        console.log(numAdResults)
        console.log("AD MOUSEDOWN")
        console.log(adLink)
        const adLinkElementHref = urlFilter(encodeURI(adLink))
        mousedownAdLinks.add(encodeURI(adLinkElementHref))
      }
    }

    const fnAdClickListener = function adClickListener(event: MouseEvent) {
      if (!(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) {
        if ((event.target as any).href) {
          numAdClicks++;
        }

      }
    }

    adResult.addEventListener("mousedown", fnAdMousedownListener, true);
    adResult.addEventListener("click", fnAdClickListener, true);
    adLinksWithListeners.push({ element: adResult, mousedownListener: fnAdMousedownListener, clickListener: fnAdClickListener })
  }

}

function isValidURL(url: string): boolean {
  const res = url.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/g);
  return (res !== null)
}


function addInternalClickListeners(
  exclude: string,
  isInternalLink: (urlString: string) => boolean,
  searchAreaElements: NodeListOf<Element>) {

  // Removes any existing listeners for internal clicks that we previously added
  for (const elementWithInternalClickListeners of elementsWithInternalClickListeners) {
    elementWithInternalClickListeners.element.removeEventListener("mousedown", elementWithInternalClickListeners.mousedownListener, true);
    elementWithInternalClickListeners.element.removeEventListener("click", elementWithInternalClickListeners.clickListener, true);
  }

  function resultsAreaMousedownListener(event: Event) {
    if ((event.target as Element).matches(exclude)) {
      return
    }

    const linkElement = (event.target as Element).closest("[href]")
    const link = linkElement ? (linkElement as any).href : null

    if (!linkElement || !isValidURL(link) || (linkElement as any).getAttribute("href")[0] === "#") {
      return
    }

    if (isInternalLink(link)) {
      mousedownInternalLinks.add(urlFilter(encodeURI(link)))
    }
  }

  function resultsAreaClickListener(event: MouseEvent) {
    if ((event.target as Element).matches(exclude)) {
      return
    }

    const linkElement = (event.target as Element).closest("[href]")
    const link = linkElement ? (linkElement as any).href : null

    if (linkElement && isValidURL(link) && (linkElement as any).getAttribute("href")[0] !== "#") {
      if (isInternalLink(link)) {
        if (!(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) {
          numInternalClicks++;
        } else {
          lastClickTime = Date.now()
        }
      }
    } else {
      lastClickTime = Date.now()
    }
  }

  for (const searchAreaElement of searchAreaElements) {
    searchAreaElement.addEventListener("mousedown", resultsAreaMousedownListener, true);
    searchAreaElement.addEventListener("click", resultsAreaClickListener, true);
    elementsWithInternalClickListeners.push({ element: searchAreaElement, mousedownListener: resultsAreaMousedownListener, clickListener: resultsAreaClickListener })
  }
}


/**
 * A default URL filter for matching against URLs of new tabs opened from a SERP page
 * @param {string} url - The URL to filter
 * @return {string} The filtered URL
 */
function urlFilter(url: string) {
  return url.substring(0, 60)
}

/**
 * Registers listener that will receive the target of navigation of tabs opened from the tab of the SERP page and match the URL
 * with clicked elements from the SERP page to determine if an element link was opened in a tab
 */
function registerNewTabListener() {
  browser.runtime.onMessage.addListener((message) => {
    if (message.type === "NewTabURL") {
      const encodedMessageURL = urlFilter(encodeURI(message.url))
      if (mousedownAdLinks.has(encodedMessageURL)) {
        numAdClicks++;
        return
      }
      if (mousedownInternalLinks.has(encodedMessageURL)) {
        numInternalClicks++;
        return
      }
      if (mousedownOrganicLinksMap.has(encodedMessageURL)) {
        const mousedownOrganicLinkValue = mousedownOrganicLinksMap.get(encodedMessageURL)
        const x = { Ranking: mousedownOrganicLinkValue.index, AttentionTime: getAttentionTime(), Loaded: pageLoaded }
        organicClicks.push(x)
        return;
      }
    }
  });
}

function getNextElement(element: Element) {
  while (element) {
    while (element.nextElementSibling && (
      !(element.nextElementSibling as HTMLElement).offsetParent ||
      !(element.nextElementSibling as HTMLElement).offsetHeight ||
      !(element.nextElementSibling as HTMLElement).offsetWidth
    )) {
      element = element.nextElementSibling
    }

    if (element.nextElementSibling) {
      break
    }

    element = element.parentElement
  }

  return element.nextElementSibling
}
