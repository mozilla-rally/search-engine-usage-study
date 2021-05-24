import * as webScience from "@mozilla/web-science";
import * as Utils from "./Utils.js"

const maxResults = 1000;
let date30DaysAgo;


export async function reportInitialData(storage) {
  let initialData = {
    SurveyId: await webScience.userSurvey.getSurveyId(),
    Engine: await Utils.getSearchEngine(),
    Time: Date.now(),
    TimeOffset: new Date().getTimezoneOffset(),
    HistoryQueries: await getHistoryData()
  }

  console.log(initialData);

  storage.set("InitialDataReported", true);
}

async function getNumGoogleQueries(): Promise<number> {
  const searchEngineQuerySet = new Set()
  const historyItems = await browser.history.search({ text: "google.com search?", startTime: date30DaysAgo, maxResults: maxResults });
  for (const historyItem of historyItems) {
    if (historyItem.url) {
      const tbm = getQueryVariable(historyItem.url, "tbm")
      if (tbm) {
        continue
      }

      const tbs = getQueryVariable(historyItem.url, "tbs")
      if (tbs && !tbs.startsWith("qdr") && !tbs.startsWith("li") && !tbs.startsWith("cdr")) {
        continue
      }

      for (const key of ["q", "query"]) {
        const query = getQueryVariable(historyItem.url, key);
        if (query) {
          searchEngineQuerySet.add(query.toLowerCase());
          break;
        }
      }
    }
  }

  return searchEngineQuerySet.size;
}
async function getNumDuckDuckGoQueries(): Promise<number> {
  const searchEngineQuerySet = new Set()
  const historyItems = await browser.history.search({ text: "duckduckgo.com ia=web q=", startTime: date30DaysAgo, maxResults: maxResults });
  for (const historyItem of historyItems) {
    if (historyItem.url) {
      const query = getQueryVariable(historyItem.url, "q");
      if (query) {
        searchEngineQuerySet.add(query.toLowerCase());
        break;
      }
    }
  }

  return searchEngineQuerySet.size;
}
async function getNumBingQueries(): Promise<number> {
  const searchEngineQuerySet = new Set()
  const historyItems = await browser.history.search({ text: "bing.com/search?", startTime: date30DaysAgo, maxResults: maxResults });
  for (const historyItem of historyItems) {
    if (historyItem.url) {

      const query = getQueryVariable(historyItem.url, "q");
      if (query) {
        searchEngineQuerySet.add(query.toLowerCase());
        break;
      }
    }
  }

  return searchEngineQuerySet.size;
}
async function getNumYahooQueries(): Promise<number> {
  const searchEngineQuerySet = new Set()
  const historyItems = await browser.history.search({ text: "search.yahoo.com/search", startTime: date30DaysAgo, maxResults: maxResults });
  for (const historyItem of historyItems) {
    if (historyItem.url) {


      const url = new URL(historyItem.url)
      if (url.hostname !== "search.yahoo.com" && url.hostname !== "www.search.yahoo.com") {
        continue
      }


      for (const key of ["p", "q", "query"]) {
        const query = getQueryVariable(historyItem.url, key);
        if (query) {
          searchEngineQuerySet.add(query.toLowerCase());
          break;
        }
      }
    }
  }

  return searchEngineQuerySet.size;
}
async function getNumEcosiaQueries(): Promise<number> {
  const searchEngineQuerySet = new Set()
  const historyItems = await browser.history.search({ text: "ecosia.org/search?", startTime: date30DaysAgo, maxResults: maxResults });
  for (const historyItem of historyItems) {
    if (historyItem.url) {

      const query = getQueryVariable(historyItem.url, "q");
      if (query) {
        searchEngineQuerySet.add(query.toLowerCase());
        break;
      }
    }
  }

  return searchEngineQuerySet.size;
}
async function getNumYandexQueries(): Promise<number> {
  const searchEngineQuerySet = new Set()
  const historyItems = await browser.history.search({ text: "yandex. /search", startTime: date30DaysAgo, maxResults: maxResults });
  for (const historyItem of historyItems) {
    if (historyItem.url) {

      const url = new URL(historyItem.url)
      if (url.pathname.includes("direct")) {
        continue
      }

      const query = getQueryVariable(historyItem.url, "text");
      if (query) {
        searchEngineQuerySet.add(query.toLowerCase());
        break;
      }
    }
  }

  return searchEngineQuerySet.size;
}
async function getNumAskQueries(): Promise<number> {
  const searchEngineQuerySet = new Set()
  const historyItems = await browser.history.search({ text: "ask.com/web?", startTime: date30DaysAgo, maxResults: maxResults });
  for (const historyItem of historyItems) {
    if (historyItem.url) {

      for (const key of ["q", "query"]) {
        const query = getQueryVariable(historyItem.url, key);
        if (query) {
          searchEngineQuerySet.add(query.toLowerCase());
          break;
        }
      }
    }
  }

  return searchEngineQuerySet.size;
}
async function getNumBaiduQueries(): Promise<number> {
  const searchEngineQuerySet = new Set()
  const historyItems = await browser.history.search({ text: "baidu.com/s?", startTime: date30DaysAgo, maxResults: maxResults });
  for (const historyItem of historyItems) {
    if (historyItem.url) {

      const url = new URL(historyItem.url)
      if (url.hostname === "baidu.com" || url.hostname === "www.baidu.com") {
        const tn = getQueryVariable(historyItem.url, "tn")
        if (tn && tn !== "baidu") {
          continue
        }
      }


      for (const key of ["wd", "word"]) {
        const query = getQueryVariable(historyItem.url, key);
        if (query) {
          searchEngineQuerySet.add(query.toLowerCase());
          break;
        }
      }
    }
  }

  return searchEngineQuerySet.size;
}


/**
 * Collects the number of visits to SERP pages over the 
 * previous 30 days for each of the tracked search engines
 */
async function getHistoryData(): Promise<Array<{ SearchEngine: string, Queries: number }>> {
  date30DaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));
  const searchEnginesNumHistoryQueries: { SearchEngine: string, Queries: number }[] = [
    {
      SearchEngine: "Google",
      Queries: await getNumGoogleQueries()
    },
    {
      SearchEngine: "DuckDuckGo",
      Queries: await getNumDuckDuckGoQueries()
    },
    {
      SearchEngine: "Bing",
      Queries: await getNumBingQueries()
    },
    {
      SearchEngine: "Yahoo",
      Queries: await getNumYahooQueries()
    },
    {
      SearchEngine: "Ecosia",
      Queries: await getNumEcosiaQueries()
    },
    {
      SearchEngine: "Yandex",
      Queries: await getNumYandexQueries()
    },
    {
      SearchEngine: "Ask",
      Queries: await getNumAskQueries()
    },
    {
      SearchEngine: "Baidu",
      Queries: await getNumBaiduQueries()
    }
  ];

  return searchEnginesNumHistoryQueries;
}

/**
 * Retrieve a query string variable from a URL
 * @param {string} url - the URL to retrieve the query string variable from
 * @param {string} parameter - the parameter of the variable in the URL you want to retrieve
 * @returns {string} The query string variable in url for the given parameter. If the parameter
 * does not exist in the URL, returns null.
 */
function getQueryVariable(urlString, variable) {
  urlString = urlString ? urlString : window.location.href
  let url = new URL(urlString);
  let params = new URLSearchParams(url.search);
  return params.get(variable);
}