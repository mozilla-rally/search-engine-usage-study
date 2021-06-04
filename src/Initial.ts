import * as webScience from "@mozilla/web-science";
import * as Utils from "./Utils.js"
import * as SearchEngineUtils from "./SearchEngineUtils.js"

const maxResults = 1000;


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

const searchEngines = ["Google", "DuckDuckGo", "Bing", "Yahoo", "Ecosia", "Yandex", "Ask", "Baidu"]

/**
 * Collects the number of visits to SERP pages over the 
 * previous 30 days for each of the tracked search engines
 */
async function getHistoryData(): Promise<Array<{ SearchEngine: string, Queries: number }>> {
  // const date30DaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));
  const date30DaysAgo = new Date(new Date().setDate(new Date().getDate() - 1));
  const historyItems = await browser.history.search({ text: "", startTime: date30DaysAgo, maxResults: maxResults });

  const searchEngineQuerySets = {}

  for (const searchEngine of searchEngines) {
    searchEngineQuerySets[searchEngine] = new Set();
  }

  for (const historyItem of historyItems) {
    const engineAndQuery = SearchEngineUtils.getEngineAndQueryFromUrl(historyItem.url);
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