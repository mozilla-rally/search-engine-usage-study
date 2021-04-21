## Testing
In developer mode, output will be logged to the console.
View this (and other) output by going to `about:debugging`, then "This Firefox", then "Inspect" on the study, then the "Console" tab.

### InitialData
- InitialData is collected upon the first startup of the study extension and reported upon completion of the intervention.
- Start the extension for the first time.
- Complete the randomly chosen intervention and check that the initial data appears in the output.
- Here's an example of the output:
  ```json
  "InitialData"{
    "SurveyId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "Engine": "Google",
    "Time": 1618936823852,
    "TimeOffset": 240,
    "HistoryQueries": [
      {
        "SearchEngine": "Google",
        "Queries": 24
      },
      {
        "SearchEngine": "Bing",
        "Queries": 2
      },
      {
        "SearchEngine": "DuckDuckGo",
        "Queries": 1
      },
      {
        "SearchEngine": "Yahoo",
        "Queries": 0
      },
      {
        "SearchEngine": "Ecosia",
        "Queries": 0
      },
      {
        "SearchEngine": "Ask",
        "Queries": 0
      },
      {
        "SearchEngine": "Yandex",
        "Queries": 0
      },
      {
        "SearchEngine": "Baidu",
        "Queries": 0
      }
    ]
  }
  ```
- These values can be sanity-checked:
  - `SurveyId` is a unique ID to enable syncing of survey data from the external Qualtrics surveys with other data.
  - `Engine` is the default search engine.
  - `Time` is the time (milliseconds since epoch).
  - `TimeOffset` is the timezone offset in minutes. A value of 240 represents UTC-4.
  - `HistoryQueryData` is an array with one item for each of the tracked search engines.
    - `SearchEngine` is one of the tracked search engines.
    - `Queries` is the number of unique queries made to `SearchEngine` over the past 30 days.


### InterventionData
- InterventionData is reported upon completion of the intervention. Each participant will be randomly assigned 1 of 7 different intervention groups.
  - There is 1 control group
    - `Control`: no intervention occurs
  - There are 2 notice groups:
    - `NoticeDefault`: the participant's default search engine is changed and a notice is shown informing them of the change
    - `NoticeRevert`: the participant's default search engine is changed and a notice is shown informing them of the change. There is a button on the notice that allows for this change to be reverted with a single click.
  - There are 4 ballot groups:
    - `BallotDefault`: A search engine ballot is shown to the participant allowing them to choose their search engine from among four top search engines. The search engines do not have descriptions.
    - `BallotHidden`: A search engine ballot is shown to the participant allowing them to choose their search engine from among four top search engines. All of the search engines have a description but the descriptions are hidden behind dropdown toggles.
    - `BallotDescriptions`: A search engine ballot is shown to the participant allowing them to choose their search engine from among four top search engines. All of the search engines have description that is immediately visible.
    - `BallotExtended`: A search engine ballot is shown to the participant allowing them to choose their search engine from among eight top search engines, although four of the search engines are hidden behind a 'See More Search Engines' button. All of the visible search engines have a description that is immediately visible.
- Criteria for completion of interventions:
  - Control group: the intervention is immediately complete.
  - Notice groups: the intervention is complete when the notice page unloads or upon the next restart of the study extension, whichever occurs first.
  - Ballot groups: A ballot page is loaded upon study extension startup if the user has not completed the intervention. The intervention is complete when the participant selects an option on the ballot or upon study extension startup if a ballot has already been loaded 3 times for the participant.
- Upon the start of the study, complete the randomly chosen intervention and check that the intervention data appears in the output.
- Here's an example of the output for the `BallotExtended` group:
  ```json
  "InterventionData": {
    "InterventionType": "BallotExtended",
    "AttentionTime": 12345,
    "PreviousEngine": "Google",
    "NewEngine": "DuckDuckGo",
    "ButtonSelected": true,
    "BallotAttempts": 1,
    "Ordering": [
      "Google",
      "Bing",
      "Yahoo",
      "DuckDuckGo",
      "Ask",
      "Yandex",
      "Baidu",
      "Ecosia",
    ],
    "DetailsExpanded": null,
    "Time": 1618866488328,
    "TimeOffset": 240
  }
  ```
- These values can be sanity-checked:
  - `InterventionType` is the randomly chosen intervention group for the participant.
  - `AttentionTime`
    - Control group: this value is `null`.
    - Notice groups: this value is the milliseconds of attention to the notice page if the participant closes out of the notice page or selects the button to revert changes. Otherwise, this value is `null`.
    - Ballot groups: this value is the milliseconds of attention to the ballot page if the participant selects an option on the ballot. Otherwise, this value is `null`.
  - `PreviousEngine`
    - Control group: this value is the name of the initial engine.
    - Notice groups: this value is the name of the search engine that the participant's default is changed from.
    - Ballot groups: this value is the name of the search engine that the participant's default is changed from if the participant selects an option on the ballot. Otherwise, this value is `null`.
  - `NewEngine`
    - Control group: this value is the name of the initial engine.
    - Notice groups: this value is the name of the search engine that the participant's default is changed to.
    - Ballot groups: this value is the name of the search engine that the participant's default is changed to if the participant select an option on the ballot. Otherwise, this value is `null`.
  - `ButtonSelected`
    - `BallotExtended` group: Whether the participant selects the button to see more engines.
    - `NoticeRevert` group: Whether the participant selects the button to revert the change.
    - All other groups: `null`.
  - `BallotAttempts`
    - Ballot groups: the number of times that a ballot was shown to the participant.
    - All other groups: `null`.
  - `Ordering`
    - Ballot groups: An array of the names of all search engines on the ballot in the order they are displayed.
    - All other groups: `null`.
  - `DetailsExpanded`
    - `BallotHidden` group: An array of the names of all search engines on the ballot for which the participant expands details.
    - All other groups: `null`.
  - `Time` is the time (milliseconds since epoch) that the intervention is completed.
  - `TimeOffset` is the timezone offset in minutes. A value of 240 represents UTC-4.


### SearchPageVisit
- Upon completion of the intervention, SearchPageVisit data is collected for each tracked engine SERP and reported upon the end of the page visit.
- After completion of the intervention, navigate to a SERP on one of the tracked engines and interact with the page.
- Close the tab or navigate to a different page.
- The data for the visit to the SERP should appear in the output.
- Here's an example of the output for a visit to a Google SERP:
  ```json
  "SearchPageVisit": {
    "SearchEngine": "Google",
    "AttentionTime": 16882,
    "PageNum": 1,
    "Attribution": "generated",
    "AttributionID": "2Hk6q6VzJm",
    "OrganicDetails": [
      {
        "TopHeight": 697.3499755859375,
        "BottomHeight": 1128.699951171875,
        "PageNum": 1
      },
      {
        "TopHeight": 2313.283447265625,
        "BottomHeight": 2442.050048828125,
        "PageNum": 1
      }
    ],
    "OrganicClickDetails": [
      {
        "Ranking": 0,
        "AttentionTime": 13149,
        "Loaded": true
      },
      {
        "Ranking": 1,
        "AttentionTime": 17009,
        "Loaded": true
      }
    ],
    "NumAdResults": 2,
    "NumAdClicks": 1,
    "NumInternalClicks": 0,
    "SearchAreaTopHeight": 133,
    "SearchAreaBottomHeight": 3719.283447265625,
    "Time": 1618866488328,
    "TimeOffset": 240
  }
  ```
- These values can be sanity-checked:
  - `SearchEngine` is the engine of the SERP page (ie. Google, Bing, Yahoo, DuckDuckGo, etc).
  - `AttentionTime` is the milliseconds of attention for the page visit
  - `PageNum` is the page number of the SERP page. Note that in the case of DuckDuckGo (which uses an infinite scroll interface), this property represents the number of loaded pages.
  - `Attribution` is the type of navigation that the SERP visit can be attributed to. This is the navigation type that originally led the participant to the search engine.
  - `AttributionID` is the attribution sequence that the SERP visit is part of.
  - `OrganicDetails` is an array where each items represents details of an organic results.
    - `TopHeight` is the number of pixels between the top of the page and the top of the search result.
    - `BottomHeight` is the number of pixels between the top of the page and the bottom of the search result.
    - `ResultPageNum` is the page number that the search result was on. This should be the same as `PageNum` except for on DuckDuckGo (see above note regarding `PageNum` for DuckDuckGo).
  - `OrganicClickDetails` is an array where each item represents details of a click on an organic result.
    - `Ranking` is the ranking of the organic result among all the organic results on the page.
    - `AttentionTime` is the number of milliseconds of attention for the page visit when the click occurred.
    - `Loaded` is whether the window load event had fired when the click occurred.
  - `NumAdResults` is the number of advertisement results on the page
  - `NumAdClicks` is the number of clicks on advertisement links
  - `NumInternalClicks` is the number clicks on links in the search area that led to different pages on the same search engine.
  - `SearchAreaTopHeight` is the number of pixels between the top of the page and the top of the search area.
  - `SearchAreaBottomHeight` is the number of pixels between the top of the page and the bottom of the search area.
  - `Time` is the time (milliseconds since epoch) that the SERP visit started.
  - `TimeOffset` is the timezone offset in minutes. A value of 240 represents UTC-4.








### DailyCollectionData
- Upon completion of the intervention, DailyCollectionData data is reported on a daily basis.
- In developer mode, DailyCollectionData data is reported every seconds after 15 seconds of inactivity.
- Here's an example of the output:
  ```json
  "DailyCollectionData": {
    "CurrentEngine": "Bing",
    "SearchEngineQueries": [
      {
        "SearchEngine": "Google",
        "Queries": 24
      },
      {
        "SearchEngine": "Bing",
        "Queries": 2
      },
      {
        "SearchEngine": "DuckDuckGo",
        "Queries": 1
      },
      {
        "SearchEngine": "Yahoo",
        "Queries": 0
      },
      {
        "SearchEngine": "Ecosia",
        "Queries": 0
      },
      {
        "SearchEngine": "Ask",
        "Queries": 0
      },
      {
        "SearchEngine": "Yandex",
        "Queries": 0
      },
      {
        "SearchEngine": "Baidu",
        "Queries": 0
      }
    ],
    "Time": 1618866488328,
    "TimeOffset": 240
  }
  ```
- These values can be sanity-checked:
  - `CurrentEngine` is the name of the participant's default search engine at the time of reporting.
  - `SearchEngineQueries` is an array with one item for each of the tracked search engines.
    - `SearchEngine` is one of the tracked search engines.
    - `Queries` is the number of unique queries made to `SearchEngine` since the completion of the intervention.
   - `Time` is the time (milliseconds since epoch).
  - `TimeOffset` is the timezone offset in minutes. A value of 240 represents UTC-4.
