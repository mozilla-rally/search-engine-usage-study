/**
 * This module enables registering SERP content scripts and collecting 
 * data for SERP visits.
 * 
 * @module OnlineServiceVisitCollection
 */

import * as webScience from "@mozilla/web-science";

/**
 * A persistent key-value storage object for the study
 * @type {Object}
 */
let storage;

let aggregateData: {
  // The name of the online service.
  [serviceName: string]: {
    TotalAttentionTime: number,
    TotalDwellTime: number,
    PageVisitCount: number,
    CompletedTransactionCount: number,
  }
} = {};

let aggregationPeriodStartTime: number = null;

export const onlineServices: {
  // The name of the online service.
  [serviceName: string]: string[]
} = {
  Agoda: ["agoda.com"],
  BookingCom: ["booking.com"],
  ChoiceHotels: ["choicehotels.com"],
  Expedia: ["expedia.com"],
  HotelsCom: ["hotels.com"],
  Hotwire: ["hotwire.com"],
  Kayak: ["kayak.com"],
  Orbitz: ["orbitz.com"],
  Priceline: ["priceline.com"],
  Skyscanner: ["skyscanner.com"],
  Travelocity: ["travelocity.com"],
  Tripadvisor: ["tripadvisor.com"],
  Trivago: ["trivago.com"],
  Yelp: ["yelp.com"],

  Alaska: ["alaskaair.com"],
  Allegiant: ["allegiantair.com"],
  American: ["aa.com"],
  Delta: ["delta.com"],
  Frontier: ["flyfrontier.com"],
  Hawaiian: ["hawaiianairlines.com"],
  JetBlue: ["jetblue.com"],
  Southwest: ["southwest.com"],
  Spirit: ["spirit.com"],
  United: ["united.com"],

  Hilton: ["hilton.com"],
  Hyatt: ["hyatt.com"],
  IHG: ["ihg.com"],
  Marriott: ["marriott.com"],
  Wyndham: ["wyndhamhotels.com"],

  AZLyrics: ["azlyrics.com"],
  Genius: ["genius.com"],
  LyricsCom: ["lyrics.com"],
  Musixmatch: ["musixmatch.com"],
  SongLyrics: ["songlyrics.com"],

  AccuWeather: ["accuweather.com"],
  NationalWeatherService: ["weather.gov"],
  WeatherChannel: ["weather.com"],
  WeatherBug: ["weatherbug.com"],
  WeatherUnderground: ["wunderground.com"],
  Windy: ["windy.com"],
}

/**
 * Start SERP visit collection
 * @async
 **/
export async function initializeCollection(storageArg): Promise<void> {
  storage = storageArg;

  aggregateData = await storage.get("OnlineServiceAggregateData");
  if (!aggregateData) {
    aggregateData = createNewAggregateDataObject();
    storage.set("OnlineServiceAggregateData", aggregateData);
  }

  aggregationPeriodStartTime = await storage.get("OnlineServiceAggregationPeriodStartTime");
  if (!aggregationPeriodStartTime) {
    aggregationPeriodStartTime = webScience.timing.now();
    storage.set("OnlineServiceAggregationPeriodStartTime", aggregationPeriodStartTime);
  }

  initializeOnlineServicePageNavigationListeners();
  webScience.scheduling.onIdleDaily.addListener(reportOnlineServiceVisitData);
}

function initializeOnlineServicePageNavigationListeners() {
  for (const onlineServiceName in onlineServices) {
    console.log(onlineServiceName);
    const domainMatchPatterns = webScience.matching.domainsToMatchPatterns(onlineServices[onlineServiceName]);

    webScience.pageNavigation.onPageData.addListener(pageNavigationDetails => {

      aggregateData[onlineServiceName].TotalAttentionTime += pageNavigationDetails.attentionDuration;
      aggregateData[onlineServiceName].TotalDwellTime += pageNavigationDetails.pageVisitStopTime - pageNavigationDetails.pageVisitStartTime;
      aggregateData[onlineServiceName].PageVisitCount += 1;

      storage.set("OnlineServiceAggregateData", aggregateData);
    },
      {
        matchPatterns: domainMatchPatterns,
      }
    );
  }
}

function createNewAggregateDataObject(): {
  [serviceName: string]: {
    TotalAttentionTime: number,
    TotalDwellTime: number,
    PageVisitCount: number,
    CompletedTransactionCount: number,
  }
} {
  const newAggregateDataObject = {}
  for (const onlineServiceName in onlineServices) {
    newAggregateDataObject[onlineServiceName] = {
      TotalAttentionTime: 0,
      TotalDwellTime: 0,
      PageVisitCount: 0,
      CompletedTransactionCount: 0,
    }
  }

  return newAggregateDataObject;
}


function reportOnlineServiceVisitData() {
  const currentTime = webScience.timing.now();

  const onlineServiceVisitData = {
    AggregateData: aggregateData,
    AggregationPeriodStartTime: aggregationPeriodStartTime,
    AggregationPeriodEndTime: currentTime,
    PingTime: currentTime,
  };
  console.log(onlineServiceVisitData);

  aggregateData = createNewAggregateDataObject();
  storage.set("OnlineServiceAggregateData", aggregateData);

  aggregationPeriodStartTime = currentTime;
  storage.set("OnlineServiceAggregationPeriodStartTime", aggregationPeriodStartTime);
}
