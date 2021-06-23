import { matching } from "@mozilla/web-science";

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
 * @returns {number} The number of pixels between the top of the page and the top of the next element
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
 * Retrieve a query string variable from a URL
 * @param {string} urlString - the URL string to retrieve the query string variable from
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
 * @param {string} url - a URL string
 * @returns {boolean} Whether the URL string is a valid URL.
 */
function isValidURL(url: string): boolean {
  const res = url.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/g);
  return (res !== null)
}

/**
 * @param {string} urlString - a URL string
 * @returns {boolean} Whether the URL string is a valid URL to a different page than the current page.
 */
export function isValidLinkToDifferentPage(urlString: string): boolean {
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
