/**
 * This module provides various utilities used by background modules. The initialize function must be called
 * before any of the other exported functions in this module.
 * 
 * @module Utils
 */
import * as webScience from "@mozilla/web-science";
import * as Privileged from "./Privileged.js"
import { pbkdf2Sync } from "browser-crypto"

/**
 * An object that maps each search engine to metadata for the engine.
 * @type {Array}
 */
export const searchEnginesMetadata: {
  // The name of the search engine
  [engine: string]: {
    // Whether or not the search engine is one of the four primary options.
    primary: boolean,
    // A list of domains for the search engine.
    domains: string[],
    // The possible search query parameters in the URL
    searchQueryParameters: string[],
    /**
     * @param {string} url - a URL string.
     * @returns {boolean} Whether the URL is for a SERP page of the search engine.
     */
    getIsSerpPage: (url: string) => boolean,
  }
} = {
  Google: {
    primary: true,
    domains: ["google.com"],
    searchQueryParameters: ["q", "query"],
    getIsSerpPage: function (url: string): boolean {
      if (url.match(/(?:^(?:https?):\/\/(?:www\.)?google\.com(?::[0-9]+)?\/search(?:\/\?|\?))/i)) {
        // "tbm" parameter is present on search types that are not web (ie, images, videos, books, etc.)
        const tbm = getQueryVariable(url, "tbm")
        if (!tbm) {
          return true;
        }
      }
      return false;
    },
  },
  DuckDuckGo: {
    primary: true,
    domains: ["duckduckgo.com"],
    searchQueryParameters: ["q"],
    getIsSerpPage: function (url: string): boolean {
      if (url.match(/(?:^(?:https?):\/\/(?:www\.)?duckduckgo\.com)/i)) {
        const iaType = getQueryVariable(url, "ia");
        const iaxType = getQueryVariable(url, "iax");
        const iaxmType = getQueryVariable(url, "iaxm");
        const iarType = getQueryVariable(url, "iaxm");

        // "ia" parameter is present on web searches. We do not check if "ia" is web because
        // there are other search types that are general web search eg. https://duckduckgo.com/Example?ia=definition
        // If "iax" parameter is present, it is not a general web search (it is images search video search, etc.).
        // If "iaxm" parameter is present, it is a local search.
        if (iaType && !iaxType && !iaxmType && !iarType) {
          return true;
        }
      }
      return false;
    },
  },
  Bing: {
    primary: true,
    domains: ["bing.com"],
    searchQueryParameters: ["q"],
    getIsSerpPage: function (url: string): boolean {
      return !!url.match(/(?:^(?:https?):\/\/(?:www\.)?bing\.com(?::[0-9]+)?\/search(?:\/\?|\?))/i);
    },
  },
  Yahoo: {
    primary: false,
    domains: ["yahoo.com"],
    searchQueryParameters: ["p", "q", "query"],
    getIsSerpPage: function (url: string): boolean {
      return !!url.match(/(?:^(?:https?):\/\/(?:www\.)?search\.yahoo\.com(?::[0-9]+)?\/search(?:\/\?|\?|\/;_ylt|;_ylt))/i);
    },
  },
  Ecosia: {
    primary: false,
    domains: ["ecosia.org"],
    searchQueryParameters: ["q"],
    getIsSerpPage: function (url: string): boolean {
      return !!url.match(/(?:^(?:https?):\/\/(?:www\.)?ecosia\.org(?::[0-9]+)?\/search(?:\/\?|\?))/i);
    },
  },
  Ask: {
    primary: false,
    domains: ["ask.com"],
    searchQueryParameters: ["q", "query"],
    getIsSerpPage: function (url: string): boolean {
      return !!url.match(/(?:^(?:https?):\/\/(?:www\.)?ask\.com(?::[0-9]+)?\/web(?:\/\?|\?))/i);
    },
  },
  Baidu: {
    primary: false,
    domains: ["baidu.com"],
    searchQueryParameters: ["wd", "word"],
    getIsSerpPage: function (url: string): boolean {
      if (url.match(/(?:^(?:https?):\/\/(?:www\.)?baidu\.com(?::[0-9]+)?\/s(?:\/\?|\?))/i)) {
        // "tn" specifies the search type. It is a web search if
        // the parameter does not exist or if the value is "baidu".
        const tn = getQueryVariable(url, "tn")
        if (!tn || tn === "baidu") {
          return true;
        }
      }
      return false;
    },
  },
  Brave: {
    primary: false,
    domains: ["brave.com"],
    searchQueryParameters: ["q"],
    getIsSerpPage: function (url: string): boolean {
      return !!url.match(/(?:^(?:https?):\/\/(?:www\.)?search\.brave\.com(?::[0-9]+)?\/search(?:\/\?|\?))/i);
    },
  },
}

/**
 * @param {string} query - The query to normalize.
 * @returns {string} A normalization of the query to account for minor variations. The normalization consists of
 * converting the query to its compatibility decomposition form, removing all non-alphanumeric characters, and lowercasing everything.
 */
export function normalizeQuery(query: string): string {
  try {
    if (!query) return query;
    return query.normalize('NFKD').replace(/[^a-z0-9]/gi, '').toLowerCase();
  } catch (error) {
    return null;
  }

}

/**
 * @param {string} url - a URL string.
 * @param {string} engine - a search engine.
 * @returns {string} The search query parameter for url if it is a SERP page for engine. Otherwise, an empty string.
 */
export function getSerpQuery(url: string, engine: string): string {
  try {
    if (!url || !engine) {
      return "";
    }

    // Get the possible search query parameters for the engine.
    const searchQueryParameters = searchEnginesMetadata[engine].searchQueryParameters;

    // If any of the search query parameters are in the URL, return the query.
    for (const parameter of searchQueryParameters) {
      const query = getQueryVariable(url, parameter);
      if (query) {
        return query;
      }
    }

    // For DuckDuckGo, the search parameter can be specified in the pathname.
    // eg. https://duckduckgo.com/Example?ia=web
    if (engine === "DuckDuckGo") {
      const pathname = (new URL(url)).pathname
      const pathnameSplit = pathname.split("/")
      if (pathnameSplit.length === 2 && pathnameSplit[1]) {
        const query = decodeURIComponent(pathnameSplit[1].replace(/_/g, " "))
        if (query) {
          return query;
        }
      }
    }
    return "";
  } catch (error) {
    return null;
  }

}

/**
 * An object that maps each tracked engine to the match pattern set for its domains.
 * @type {Object}
 */
const domainMatchPatternSets = {}

/**
 * An array of match pattern strings for all the tracked search engines.
 * @type {Array}
 */
let allTrackedEngineMatchPatterns = []

/**
 * Initializes the domainMatchPatternSets object and the allTrackedEngineMatchPatterns array.
 * This function must be called before getEngineFromURL and getTrackedEnginesMatchPatterns are called.
 */
export function initializeMatchPatterns(): void {
  for (const engine in searchEnginesMetadata) {
    const engineMetadata = searchEnginesMetadata[engine];
    const domainMatchPatterns = webScience.matching.domainsToMatchPatterns(engineMetadata.domains)
    domainMatchPatternSets[engine] = webScience.matching.createMatchPatternSet(domainMatchPatterns)
    allTrackedEngineMatchPatterns = allTrackedEngineMatchPatterns.concat(domainMatchPatterns)
  }
}

/**
 * @returns {Array} An array of match pattern strings for all the tracked search engines.
 */
export function getTrackedEnginesMatchPatterns(): string[] {
  return allTrackedEngineMatchPatterns;
}

/**
 * @param {string} url - the url of a page.
 * @returns {string} Matches a URL to a search engine by hostname and returns the name of the search engine.
 */
export function getEngineFromURL(url: string): string {
  for (const searchEngine in domainMatchPatternSets) {
    const matchPatternSetForEngine = domainMatchPatternSets[searchEngine]
    if (matchPatternSetForEngine.matches(url)) {
      return searchEngine;
    }
  }
  return null;
}

/**
 * @returns {string[]} Returns the name of the primary tracked search engines in the study.
 */
export function getPrimarySearchEngineNames(): string[] {
  return Object.keys(searchEnginesMetadata).filter(engine => searchEnginesMetadata[engine].primary);
}

/**
 * @returns {string[]} Returns the name of all the tracked search engines in the study.
 */
export function getAllSearchEngineNames(): string[] {
  return Object.keys(searchEnginesMetadata);
}

/**
 * @param {string} homepage - The current browser homepage.
 * @returns {boolean} Returns whether the homepage needs to be changed (if 
 * the current homepage is a search engine page)
 */
export function getHomepageChangeNeeded(homepage: string): boolean {
  if (!homepage) {
    return false;
  }

  // If the participant has multiple homepages (multiple tabs open on browser startup
  // and new window), the homepage string will consist of multiple URLs separated by
  // the "|" character. In this case, we do not want to change the participant's homepages
  // even if one of them is a search engine page because this implies a more involved effort
  // by the participant in setting their homepage and we do not want to frustrate this effort.
  if (homepage.includes("|")) {
    return false;
  }

  // Add a protocol to the url if it does not have one. This is needed for
  // the match pattern checking to work in getEngineFromURL.
  if (!/^(?:f|ht)tps?:\/\//.test(homepage)) {
    homepage = "http://" + homepage;
  }
  if (getEngineFromURL(homepage)) {
    return true;
  }
  return false;
}

/**
 * Changes the default homepage to Firefox Home.
 */
export async function changeHomepageToDefault(): Promise<void> {
  await Privileged.changeHomepage("about:home");
}

/**
 * The salt to be used for the hashing function in getQueryHash.
 */
let salt = null;

/**
 * @param {string} query - A search query for a SERP page.
 * @param {Object} storageArg - A persistent key-value storage object for the study
 * @returns {string} A salted hash of the query that will be reported to the backend analysis environment.
 * This salted hash will allow for identification of requeries over time without knowledge of what the queries
 * actually were.
 */
export async function getQueryHash(query, storage) {
  try {
    if (!salt) {
      salt = await storage.get("QueryHashSalt");
      if (!salt) {
        const byteArray = new Uint8Array(16);
        crypto.getRandomValues(byteArray);
        salt = Array.prototype.map.call(byteArray, function (byte) {
          return ('0' + (byte & 0xFF).toString(16)).slice(-2);
        }).join('');

        storage.set("QueryHashSalt", salt);
      }
    }

    const iterations = 1000;
    const hash = pbkdf2Sync(query, salt, iterations, 32, 'sha256');
    return hash.toString('hex');
  } catch (error) {
    return "";
  }
}

/**
 * Retrieve a query string variable from a url.
 * @param {string} url - the url to retrieve the query string variable from.
 * @param {string} parameter - the parameter of the variable in the URL you want to retrieve
 * @returns {string} The query variable in the url for the given parameter. If the parameter
 * does not exist in the URL, returns null.
 */
export function getQueryVariable(url, parameter) {
  const urlObject = new URL(url);
  return urlObject.searchParams.get(parameter);
}

/**
 * Retrieve a positive integer from an input number. If the number is less than 0, returns
 * Number.MAX_SAFE_INTEGER. Otherwise, returns the number rounded to the nearest integer.
 * @param {number} inputNumber - The number we are getting a positive integer from.
 * @returns {number} A positive integer.
 */
export function getPositiveInteger(inputNumber: number): number {
  try {
    if (inputNumber == null) {
      return Number.MAX_SAFE_INTEGER;
    }
    if (inputNumber < 0) {
      return Number.MAX_SAFE_INTEGER
    } else {
      return Math.round(inputNumber);
    }
  } catch (error) {
    // Do nothing
  }
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Set a timeout. setTimeout uses a 32 bit into to store delay so the max delay value allowed
 * is 2147483647 (0x7FFFFFFF) which is slightly under 25 days. This method allows for larger
 * timeouts.
 * @param {CallableFunction} callback - the callback to execute after the delay.
 * @param {number} delay - the delay in milliseconds before callback is executed.
 */
export function setExtendedTimeout(callback, delay) {
  if (delay > 0x7FFFFFFF) {
    setTimeout(() => {
      setExtendedTimeout(callback, delay - 0x7FFFFFFF);
    }, 0x7FFFFFFF);
  } else {
    setTimeout(callback, delay);
  }
}

/**
 * @param {Document} doc - A Google SERP page.
 * @returns {number} The number of results produced for a query extracted from a Google SERP page.
 */
export function getNumResultsGoogle(doc = document) {
  try {
    // The DOM element that contains the count
    const element = doc.querySelector("#result-stats");

    // If the DOM element doesn't exist, we assume this means there are no results.
    if (!element) {
      return 0;
    } else {
      // Format of string on Google is "About 1 results (0.34 seconds)" or "Page 2 of about 313 results (0.28 seconds)"
      let sentence = element.textContent.replace(/[.,\s]/g, '');

      // Remove the text within parentheses
      sentence = sentence.replace(/\([^()]*\)/g, '');

      const matches = sentence.match(/[0-9]+/g);
      if (!matches || matches.length == 0) {
        return null;
      } else {
        let maximum = 0;
        for (const match of matches) {
          if (Number(match) > maximum) {
            maximum = Number(match)
          }
        }

        return maximum;
      }
    }
  } catch (error) {
    return null;
  }
}