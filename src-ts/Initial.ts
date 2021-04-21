import * as webScience from "@mozilla/web-science";
import * as Utils from "./Utils.js"

export async function reportInitialData(storage) {
  let initialData = {
    SurveyId: await webScience.userSurvey.getSurveyId(),
    Engine: await Utils.getSearchEngine(),
    Time: Date.now(),
    TimeOffset: new Date().getTimezoneOffset(),
    HistoryQueries: await getHistoryData()
  }

  console.log(initialData)

  storage.set("InitialDataReported", true);
}


/**
 * Collects the number of visits to SERP pages over the 
 * previous 30 days for each of the tracked search engines
 */
async function getHistoryData(): Promise<Array<{ SearchEngine: string, Queries: number }>> {
  const date30DaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));

  // TODO: update these values
  const searchEngineToSerpUrlDetailsObject = {
    Google: { searchQuery: "google.com search?", parameters: ["q", "query"] },
    DuckDuckGo: { searchQuery: "duckduckgo.com ia=web q=", parameters: ["q"] },
    Bing: { searchQuery: "bing.com/search?", parameters: ["q"] },
    Yahoo: { searchQuery: "search.yahoo.com/search", parameters: ["p", "q", "query"] },
    Ecosia: { searchQuery: "ecosia.org/search?", parameters: ["q"] },
    Yandex: { searchQuery: "yandex. /search", parameters: ["text"] },
    Ask: { searchQuery: "ask.com/web?", parameters: ["q", "query"] },
    Baidu: { searchQuery: "baidu.com/s?", parameters: ["wd", "word"] },
  }

  const searchEnginesNumHistoryQueries: { SearchEngine: string, Queries: number }[] = []

  // Collects the number of unique queries made to each search engine over the past 30 days
  for (const engine in searchEngineToSerpUrlDetailsObject) {
    const searchEngineQuerySet = new Set()
    const historyItems = await browser.history.search({ text: searchEngineToSerpUrlDetailsObject[engine].searchQuery, startTime: date30DaysAgo, maxResults: 1000 });
    for (const historyItem of historyItems) {
      if (historyItem.url) {
        if (engine === "Google") {
          const tbm = getQueryVariableUtil(historyItem.url, "tbm")
          if (tbm) {
            continue
          }

          const tbs = getQueryVariableUtil(historyItem.url, "tbs")
          if (tbs && !tbs.startsWith("qdr") && !tbs.startsWith("li") && !tbs.startsWith("cdr")) {
            continue
          }
        }

        if (engine === "Yahoo") {
          const url = new URL(historyItem.url)
          if (url.hostname !== "search.yahoo.com" && url.hostname !== "www.search.yahoo.com") {
            continue
          }
        }

        if (engine === "Yandex") {
          const url = new URL(historyItem.url)
          if (url.pathname.includes("direct")) {
            continue
          }
        }

        if (engine === "Baidu") {
          const url = new URL(historyItem.url)
          if (url.hostname === "baidu.com" || url.hostname === "www.baidu.com") {
            const tn = getQueryVariableUtil(historyItem.url, "tn")
            if (tn && tn !== "baidu") {
              continue
            }
          }
        }

        for (const key of searchEngineToSerpUrlDetailsObject[engine].parameters) {
          const query = getQueryVariableUtil(historyItem.url, key);
          if (query) {
            searchEngineQuerySet.add(query);
            break;
          }
        }
      }
    }

    searchEnginesNumHistoryQueries.push({
      SearchEngine: engine,
      Queries: searchEngineQuerySet.size
    })
  }

  return searchEnginesNumHistoryQueries;
}

/**
 * Retrieve a query string variable from a URL
 * @param {string} url - the URL to retrieve the query string variable from
 * @param {string} parameter - the parameter of the variable in the URL you want to retrieve
 * @returns {string} The query string variable in url for the given parameter. If the parameter
 * does not exist in the URL, returns null.
 */
function getQueryVariableUtil(url, parameter) {
  parameter = parameter.replace(/[[\]]/g, "\\$&");
  const regex = new RegExp("[?&]" + parameter + "(=([^&#]*)|&|#|$)"),
    results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return "";
  return decodeURIComponent(results[2].replace(/\+/g, " "));
}