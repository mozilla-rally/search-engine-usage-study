import * as webScience from "@mozilla/web-science";

let searchEngineDomains = {
  Google: {
    domains: ["google.com"],
    regExp: /(?:^(?:https?|wss?):\/\/(?:www\.)?google\.com(?::[0-9]+)?\/search\W.*(?:\?.*)?(?:#.*)?$)/i
  },
  DuckDuckGo: {
    domains: ["duckduckgo.com"],
    regExp: /(?:^(?:https?|wss?):\/\/(?:www\.)?duckduckgo\.com(?::[0-9]+)?(?:\/.*)?(?:\?.*)?(?:#.*)?$)/i
  },
  Bing: {
    domains: ["bing.com"],
    regExp: /(?:^(?:https?|wss?):\/\/(?:www\.)?bing\.com(?::[0-9]+)?\/search\W.*(?:\?.*)?(?:#.*)?$)/i
  },
  Yahoo: {
    domains: ["yahoo.com"],
    regExp: /(?:^(?:https?|wss?):\/\/(?:www\.)?search\.yahoo\.com(?::[0-9]+)?\/search\W.*(?:\?.*)?(?:#.*)?$)/i
  },
  Ecosia: {
    domains: ["ecosia.org"],
    regExp: /(?:^(?:https?|wss?):\/\/(?:www\.)?ecosia\.org(?::[0-9]+)?\/search\W.*(?:\?.*)?(?:#.*)?$)/i
  },
  Ask: {
    domains: ["ask.com"],
    regExp: /(?:^(?:https?|wss?):\/\/(?:www\.)?ask\.com(?::[0-9]+)?\/web\W.*(?:\?.*)?(?:#.*)?$)/i
  },
  Baidu: {
    domains: ["baidu.com"],
    regExp: /(?:^(?:https?|wss?):\/\/(?:www\.)?baidu\.com(?::[0-9]+)?\/s\W.*(?:\?.*)?(?:#.*)?$)/i
  },
  Yandex: {
    domains: ["yandex.com", "yandex.ru"],
    regExp: /(?:^(?:https?|wss?):\/\/(?:www\.)?yandex\.(?:ru|com)(?::[0-9]+)?\/search\W.*(?:\?.*)?(?:#.*)?$)/i
  },
}

/**
 * An object that maps each tracked engine to the match pattern set for its domains.
 * @type {Object}
 * @private
 */
let domainMatchPatternSets = {}

let allTrackedEngineMatchPatterns = []

export function initialize(): void {
  for (let searchEngine in searchEngineDomains) {
    const domainMatchPatterns = webScience.matching.domainsToMatchPatterns(searchEngineDomains[searchEngine].domains)
    domainMatchPatternSets[searchEngine] = webScience.matching.createMatchPatternSet(domainMatchPatterns)
    allTrackedEngineMatchPatterns = allTrackedEngineMatchPatterns.concat(domainMatchPatterns)
  }
}

export function getTrackedEnginesMatchPatterns(): string[] {
  return allTrackedEngineMatchPatterns;
}

/**
 * Returns the search engine that the URL matches
 * @param {string} url - the URL of the page that is being checked
 * @returns {string|null} The name of the search engine that the URL belongs to or
 * null if the URL does not belong to any of the tracked engines
 */
export function getEngineFromURL(url: string): string {
  for (let searchEngine in domainMatchPatternSets) {
    const matchPatternSetForEngine = domainMatchPatternSets[searchEngine]
    if (matchPatternSetForEngine.matches(url)) {
      return searchEngine;
    }
  }
  return null;
}

function getEngineFromSearchURL(url: string): string {
  for (let searchEngine in searchEngineDomains) {
    if (url.match(searchEngineDomains[searchEngine].regExp)) {
      return searchEngine;
    }
  }
  return null;
}

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

function getGoogleQuery(url: string): string {
  console.log(url)
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
function getBingQuery(url: string): string {
  const query = getQueryVariable(url, "q");
  if (query) {
    return query.toLowerCase();
  }
  return null;
}
function getYahooQuery(url: string): string {
  for (const key of ["p", "q", "query"]) {
    const query = getQueryVariable(url, key);
    if (query) {
      return query.toLowerCase();
    }
  }
  return null;
}
function getEcosiaQuery(url: string): string {
  const query = getQueryVariable(url, "q");
  if (query) {
    return query.toLowerCase();
  }
  return null;
}
function getAskQuery(url: string): string {
  for (const key of ["q", "query"]) {
    const query = getQueryVariable(url, key);
    if (query) {
      return query.toLowerCase();
    }
  }
  return null;
}
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
 * Retrieve a query string variable from a URL
 * @param {string} url - the URL to retrieve the query string variable from
 * @param {string} parameter - the parameter of the variable in the URL you want to retrieve
 * @returns {string} The query string variable in url for the given parameter. If the parameter
 * does not exist in the URL, returns null.
 */
function getQueryVariable(urlString, variable) {
  let url = new URL(urlString);
  let params = new URLSearchParams(url.search);
  return params.get(variable);
}