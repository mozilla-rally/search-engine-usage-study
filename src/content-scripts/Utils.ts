import { matching } from "@mozilla/web-science";

export function getNormalizedUrl(url: string): string {
  try {
    return matching.normalizeUrl(url);
  } catch (error) {
    return "";
  }
}

/**
 * Determines the offset from the top of the document for the element
 * @param {string} element - The element
 * @returns {number} The offset from the top
 */
export function getElementTopHeight(element: Element): number {
  if (!element) return null
  return window.pageYOffset + element.getBoundingClientRect().top
}

/**
 * Determines the offset from the top of the document for the next element
 * @param {string} element - The element
 * @returns {number} The offset from the top
 */
export function getNextElementTopHeight(element: Element) {
  return getElementTopHeight(getNextElement(element))
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

/**
 * Retrieves the first matching element given an xpath query
 * @param {string} xpath - The xpath query
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
 * @param {string} xpath - The xpath query
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
 * Retrieve a query string variable from a URL
 * @param {string} urlString - the URL to retrieve the query string variable from
 * @param {string} parameter - the parameter of the variable in the URL you want to retrieve
 * @returns {string} The query string variable in url for the given parameter. If the parameter
 * does not exist in the URL, returns null.
 */
export function getQueryVariable(urlString, variable) {
  const url = new URL(urlString);
  const params = new URLSearchParams(url.search);
  return params.get(variable);
}

/**
 * A default URL filter for matching against URLs of new tabs opened from a SERP page
 * @param {string} url - The URL to filter
 * @return {string} The filtered URL
 */
export function urlFilter(url: string) {
  return url.substring(0, 60)
}

function isValidURL(url: string): boolean {
  const res = url.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/g);
  return (res !== null)
}

export function isLinkToDifferentPage(urlString: string): boolean {
  if (!isValidURL(urlString)) return false;
  const url = new URL(urlString);
  if (
    url.protocol === window.location.protocol &&
    url.host === window.location.host &&
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  ) {
    return false;
  }
  return true;
}

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