/**
 * This module provides various utilities used by background modules. The initialize function must be called
 * before any of the other exported functions in this module.
 * 
 * @module Utils
 */
import * as webScience from "@mozilla/web-science";
import * as Privileged from "./Privileged.js"

/**
 * The number of milliseconds in an hour.
 * (1000 milliseconds/second * 60 seconds/minute  * 60 minutes/hour)
 * @type {number}
 */
const millisecondsPerHour = 3600000;

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
      return !!url.match(/(?:^(?:https?):\/\/(?:www\.)?search\.yahoo\.com(?::[0-9]+)?\/search(?:\/\?|\?))/i);
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
  Yandex: {
    primary: false,
    domains: ["yandex.com", "yandex.ru"],
    searchQueryParameters: ["text"],
    getIsSerpPage: function (url: string): boolean {
      return !!url.match(/(?:^(?:https?):\/\/(?:www\.)?yandex\.(?:ru|com)(?::[0-9]+)?\/search(?:\/\?|\?))/i);
    },
  },
}

/**
 * @param {string} url - a URL string.
 * @param {string} engine - a search engine.
 * @returns {string} The search query parameter for url if it is a SERP page for engine. Otherwise, null.
 */
export function getSerpQuery(url: string, engine: string): string {
  if (!url || !engine) {
    return;
  }

  // Get the possible search query parameters for the engine.
  const searchQueryParameters = searchEnginesMetadata[engine].searchQueryParameters;

  // If any of the search query parameters are in the URL, return the query.
  for (const parameter of searchQueryParameters) {
    const query = getQueryVariable(url, parameter);
    if (query) {
      return query.toLowerCase();
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
        return query.toLowerCase();
      }
    }
  }
  return null;
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
 * @param {number} timeStamp - A timestamp, in milliseconds since the epoch.
 * @returns {number} Returns the timestamp rounded down to the nearest hour.
 */
export function getCoarsenedTimeStamp(timeStamp: number): number {
  return Math.trunc(timeStamp / millisecondsPerHour) * millisecondsPerHour;
}

/**
 * @param {string} homepages - A "|" separated string of the browser homepages
 * @returns {boolean} Returns whether the homepage needs to be changed (if 
 * one of the homepages is a search engine page)
 */
export function getHomepageChangeNeeded(homepages: string): boolean {
  const homepageList = homepages.split("|");
  for (const homepage of homepageList) {
    if (homepage && getEngineFromURL(homepage)) {
      return true;
    }
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