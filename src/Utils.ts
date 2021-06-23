/**
 * This module provides various utilities used by background modules. The initialize function must be called
 * before any of the other exported functions in this module.
 */

import * as webScience from "@mozilla/web-science";

/**
 * @type {Array}
 * An array of the names of the tracked search engines.
 */
const searchEngines = ["Google", "DuckDuckGo", "Bing", "Yahoo", "Ecosia", "Yandex", "Ask", "Baidu"]

/**
 * @type {Object}
 * An object that maps each tracked engine to its domain and a regular expression for the SERP page urls of the engine.
 */
const searchEngineDomains = {
  Google: {
    domains: ["google.com"],
    serpUrlRegExp: /(?:^(?:https?):\/\/(?:www\.)?google\.com(?::[0-9]+)?\/search\W.*(?:\?.*)?(?:#.*)?$)/i
  },
  DuckDuckGo: {
    domains: ["duckduckgo.com"],
    serpUrlRegExp: /(?:^(?:https?):\/\/(?:www\.)?duckduckgo\.com(?::[0-9]+)?(?:\/.*)?(?:\?.*)?(?:#.*)?$)/i
  },
  Bing: {
    domains: ["bing.com"],
    serpUrlRegExp: /(?:^(?:https?):\/\/(?:www\.)?bing\.com(?::[0-9]+)?\/search\W.*(?:\?.*)?(?:#.*)?$)/i
  },
  Yahoo: {
    domains: ["yahoo.com"],
    serpUrlRegExp: /(?:^(?:https?):\/\/(?:www\.)?search\.yahoo\.com(?::[0-9]+)?\/search\W.*(?:\?.*)?(?:#.*)?$)/i
  },
  Ecosia: {
    domains: ["ecosia.org"],
    serpUrlRegExp: /(?:^(?:https?):\/\/(?:www\.)?ecosia\.org(?::[0-9]+)?\/search\W.*(?:\?.*)?(?:#.*)?$)/i
  },
  Ask: {
    domains: ["ask.com"],
    serpUrlRegExp: /(?:^(?:https?):\/\/(?:www\.)?ask\.com(?::[0-9]+)?\/web\W.*(?:\?.*)?(?:#.*)?$)/i
  },
  Baidu: {
    domains: ["baidu.com"],
    serpUrlRegExp: /(?:^(?:https?):\/\/(?:www\.)?baidu\.com(?::[0-9]+)?\/s\W.*(?:\?.*)?(?:#.*)?$)/i
  },
  Yandex: {
    domains: ["yandex.com", "yandex.ru"],
    serpUrlRegExp: /(?:^(?:https?):\/\/(?:www\.)?yandex\.(?:ru|com)(?::[0-9]+)?\/search\W.*(?:\?.*)?(?:#.*)?$)/i
  },
}

/**
 * @type {Object}
 * An object that maps each tracked engine to the match pattern set for its domains.
 */
const domainMatchPatternSets = {}

/**
 * @type {Array}
 * An array of match pattern strings for all the tracked search engines.
 */
let allTrackedEngineMatchPatterns = []

/**
 * Initializes the domainMatchPatternSets object and the allTrackedEngineMatchPatterns array.
 * This function must be called before any of the other exported functions in this module.
 */
export function initialize(): void {
  for (const searchEngine in searchEngineDomains) {
    const domainMatchPatterns = webScience.matching.domainsToMatchPatterns(searchEngineDomains[searchEngine].domains)
    domainMatchPatternSets[searchEngine] = webScience.matching.createMatchPatternSet(domainMatchPatterns)
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
 * @returns {string} If the url is for one of the tracked search engines, the name
 * of the engine. Otherwise, null.
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
 * @param {string} url - the url of a page.
 * @returns {string} If the url is a SERP page for one of the tracked search engines, the name
 * of the engine. Otherwise, null.
 */
function getEngineFromSearchURL(url: string): string {
  for (const searchEngine in searchEngineDomains) {
    if (url.match(searchEngineDomains[searchEngine].serpUrlRegExp)) {
      return searchEngine;
    }
  }
  return null;
}

/**
 * @param {string} url - the url of a page
 * @returns {Object} If the url is for a SERP page for one of the tracked engines, returns the engine and
 * the search query. Otherwise, null.
 */
export function getEngineAndQueryFromUrl(url: string): { engine: string, query: string } {
  const searchEngine = getEngineFromSearchURL(url);
  if (searchEngine) {
    let query = null;
    if (searchEngine === "Google") {
      query = getGoogleQuery(url);
    } else if (searchEngine === "DuckDuckGo") {
      query = getDuckDuckGoQuery(url);
    } else if (searchEngine === "Bing") {
      query = getBingQuery(url);
    } else if (searchEngine === "Yahoo") {
      query = getYahooQuery(url);
    } else if (searchEngine === "Ecosia") {
      query = getEcosiaQuery(url);
    } else if (searchEngine === "Ask") {
      query = getAskQuery(url);
    } else if (searchEngine === "Baidu") {
      query = getBaiduQuery(url);
    } else if (searchEngine === "Yandex") {
      query = getYandexQuery(url);
    }

    if (query) {
      return { engine: searchEngine, query: query };
    }
  }

  return null;
}

/**
 * @param {string} url - a Google SERP url.
 * @returns {string} The query from a Google SERP url.
 */
function getGoogleQuery(url: string): string {
  const tbm = getQueryVariable(url, "tbm")
  if (!tbm) {
    for (const key of ["q", "query"]) {
      const query = getQueryVariable(url, key);
      if (query) {
        return query.toLowerCase();
      }
    }
  }
  return null;
}

/**
 * @param {string} url - a DuckDuckGo SERP url.
 * @returns {string} The query from a DuckDuckGo SERP url.
 */
function getDuckDuckGoQuery(url: string): string {
  const iaType = getQueryVariable(url, "ia")
  const iaxType = getQueryVariable(url, "iax")
  const iaxmType = getQueryVariable(url, "iaxm")

  if (iaType && !iaxType && !iaxmType) {
    const pathname = (new URL(url)).pathname
    const pathnameSplit = pathname.split("/")
    if (pathnameSplit.length === 2 && pathnameSplit[1]) {
      const query = decodeURIComponent(pathnameSplit[1].replace(/_/g, " "))
      if (query) {
        return query.toLowerCase();
      }
    }

    const query = getQueryVariable(url, "q");
    if (query) {
      return query.toLowerCase();
    }
  }
  return null;
}

/**
 * @param {string} url - a Bing SERP url.
 * @returns {string} The query from a Bing SERP url.
 */
function getBingQuery(url: string): string {
  const query = getQueryVariable(url, "q");
  if (query) {
    return query.toLowerCase();
  }
  return null;
}

/**
 * @param {string} url - a Yahoo SERP url.
 * @returns {string} The query from a Yahoo SERP url.
 */
function getYahooQuery(url: string): string {
  for (const key of ["p", "q", "query"]) {
    const query = getQueryVariable(url, key);
    if (query) {
      return query.toLowerCase();
    }
  }
  return null;
}

/**
 * @param {string} url - a Ecosia SERP url.
 * @returns {string} The query from a Ecosia SERP url.
 */
function getEcosiaQuery(url: string): string {
  const query = getQueryVariable(url, "q");
  if (query) {
    return query.toLowerCase();
  }
  return null;
}

/**
 * @param {string} url - a Ask SERP url.
 * @returns {string} The query from a Ask SERP url.
 */
function getAskQuery(url: string): string {
  for (const key of ["q", "query"]) {
    const query = getQueryVariable(url, key);
    if (query) {
      return query.toLowerCase();
    }
  }
  return null;
}

/**
 * @param {string} url - a Baidu SERP url.
 * @returns {string} The query from a Baidu SERP url.
 */
function getBaiduQuery(url: string): string {
  const tn = getQueryVariable(url, "tn")
  if (!tn || tn === "baidu") {
    for (const key of ["wd", "word"]) {
      const query = getQueryVariable(url, key);
      if (query) {
        return query.toLowerCase();
      }
    }
  }
  return null;
}

/**
 * @param {string} url - a Yandex SERP url.
 * @returns {string} The query from a Yandex SERP url.
 */
function getYandexQuery(url: string): string {
  if (!webScience.matching.normalizeUrl(url).includes("direct")) {
    const query = getQueryVariable(url, "text");
    if (query) {
      return query.toLowerCase();
    }
  }
  return null;
}

/**
 * Retrieve a query string variable from a url.
 * @param {string} url - the url to retrieve the query string variable from.
 * @param {string} parameter - the parameter of the variable in the URL you want to retrieve
 * @returns {string} The query variable in the url for the given parameter. If the parameter
 * does not exist in the URL, returns null.
 */
function getQueryVariable(url, parameter) {
  const urlObject = new URL(url);
  const params = new URLSearchParams(urlObject.search);
  return params.get(parameter);
}

/**
 * Collects the number of unique queries made to each of the tracked search engines since the start time from history.
 * @param {number} startTime - the earliest time from which to get history results.
 * @returns {Array} An array that, for each of the tracked search engines, has the number of unique queries made to the engine
 * since the start time from history.
 */
export async function getHistoryData(startTime: number): Promise<Array<{ SearchEngine: string, Queries: number }>> {
  const historyItems = await browser.history.search({ text: "", startTime: startTime, maxResults: Number.MAX_SAFE_INTEGER });

  const searchEngineQuerySets = {}

  for (const searchEngine of searchEngines) {
    searchEngineQuerySets[searchEngine] = new Set();
  }

  for (const historyItem of historyItems) {
    const engineAndQuery = getEngineAndQueryFromUrl(historyItem.url);
    if (engineAndQuery) {
      searchEngineQuerySets[engineAndQuery.engine].add(engineAndQuery.query);
    }
  }

  const searchEnginesNumHistoryQueries: { SearchEngine: string, Queries: number }[] = [
    { SearchEngine: "Google", Queries: searchEngineQuerySets["Google"].size },
    { SearchEngine: "DuckDuckGo", Queries: searchEngineQuerySets["DuckDuckGo"].size },
    { SearchEngine: "Bing", Queries: searchEngineQuerySets["Bing"].size },
    { SearchEngine: "Yahoo", Queries: searchEngineQuerySets["Yahoo"].size },
    { SearchEngine: "Ecosia", Queries: searchEngineQuerySets["Ecosia"].size },
    { SearchEngine: "Yandex", Queries: searchEngineQuerySets["Yandex"].size },
    { SearchEngine: "Ask", Queries: searchEngineQuerySets["Ask"].size },
    { SearchEngine: "Baidu", Queries: searchEngineQuerySets["Baidu"].size }
  ];

  return searchEnginesNumHistoryQueries;
}