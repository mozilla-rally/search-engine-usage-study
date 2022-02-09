import { onlineServicesMetadata } from "./OnlineServiceData"

/**
 * This module enables tracking interaction with the tracked online services. Data is accumulated
 * for each tracked service and reported on around a daily basis.
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

/**
 * An object that maps each tracked service to its aggregated data for the current
 * aggregation period.
 * @type {Object}
 */
let aggregateData: {
  // The name of the online service.
  [serviceName: string]: {
    TotalAttentionTime: number,
    TotalDwellTime: number,
    PageVisitCount: number,
    CompletedTransactionCount: number,
  }
} = {};

/**
 * The start time of the current aggregation period.
 * @type {number}
 */
let aggregationPeriodStartTime: number = null;

/**
 * Start online service visit collection
 * @async
 **/
export async function initializeCollection(storageArg): Promise<void> {
  storage = storageArg;

  // Get the aggregate data object from storage.
  // If it does not exist in storage, create a new aggregate data object.
  aggregateData = await storage.get("OnlineServiceAggregateData");
  if (!aggregateData) {
    aggregateData = createNewAggregateDataObject();
    storage.set("OnlineServiceAggregateData", aggregateData);
  }

  // Get the start time of the current aggregation period.
  // If it does not exist in storage, then we set the start time to the current time.
  aggregationPeriodStartTime = await storage.get("OnlineServiceAggregationPeriodStartTime");
  if (!aggregationPeriodStartTime) {
    aggregationPeriodStartTime = webScience.timing.now();
    storage.set("OnlineServiceAggregationPeriodStartTime", aggregationPeriodStartTime);
  }

  initializeOnlineServicePageNavigationListeners();
  webScience.scheduling.onIdleDaily.addListener(reportOnlineServiceVisitData);
}

/**
 * Initializes the listeners for the tracked online services.
 **/
function initializeOnlineServicePageNavigationListeners() {
  for (const metadata of onlineServicesMetadata) {

    // Get the match patterns that will be used for the listener for this service.
    // Each element in onlineServicesMetadata should have either a domain or a 
    // matchPatterns property.
    const domainMatchPatterns = metadata.domain ?
      webScience.matching.domainsToMatchPatterns([metadata.domain]) :
      metadata.matchPatterns;

    webScience.pageNavigation.onPageData.addListener(pageNavigationDetails => {
      aggregateData[metadata.serviceName].TotalAttentionTime += pageNavigationDetails.attentionDuration;
      aggregateData[metadata.serviceName].TotalDwellTime += pageNavigationDetails.pageVisitStopTime - pageNavigationDetails.pageVisitStartTime;
      aggregateData[metadata.serviceName].PageVisitCount += 1;

      const confirmationIncludesString = metadata.confirmationIncludesString;
      const confirmationReferrerIncludesStringArray = metadata.confirmationReferrerIncludesStringArray;

      // Determine if the page navigation was to a confirmation page
      try {
        if (confirmationIncludesString) {
          if (confirmationReferrerIncludesStringArray) {
            const referrerUrl = new URL(pageNavigationDetails.referrer);

            // Determine if the referrer matches what is expected for the referrer to a confirmation page.
            for (const confirmationReferrerIncludesString of confirmationReferrerIncludesStringArray) {
              if (referrerUrl.pathname.includes(confirmationReferrerIncludesString)) {

                // Determine if the url matches what is expected for a confirmation page.
                const url = new URL(pageNavigationDetails.url);
                if (url.pathname.includes(confirmationIncludesString)) {
                  aggregateData[metadata.serviceName].CompletedTransactionCount += 1;
                }
              }
              break;
            }

          } else {
            // Determine if the url matches what is expected for a confirmation page.
            const url = new URL(pageNavigationDetails.url);
            if (url.pathname.includes(confirmationIncludesString)) {
              aggregateData[metadata.serviceName].CompletedTransactionCount += 1;
            }
          }
        }
      } catch (error) {
        // Do nothing
      }


      // Update the aggregate data object in storage
      storage.set("OnlineServiceAggregateData", aggregateData);
    },
      {
        matchPatterns: domainMatchPatterns,
      }
    );
  }
}

/**
 * @returns {Object} A new aggregate data object.
 **/
function createNewAggregateDataObject(): {
  [serviceName: string]: {
    TotalAttentionTime: number,
    TotalDwellTime: number,
    PageVisitCount: number,
    CompletedTransactionCount: number,
  }
} {
  const newAggregateDataObject = {}
  for (const metadata of onlineServicesMetadata) {
    newAggregateDataObject[metadata.serviceName] = {
      TotalAttentionTime: 0,
      TotalDwellTime: 0,
      PageVisitCount: 0,
      CompletedTransactionCount: 0,
    }
  }

  return newAggregateDataObject;
}

/**
 * The callback for the onIdleDaily listener that reports the aggregated
 * data over the current aggregation period.
 **/
function reportOnlineServiceVisitData() {
  const currentTime = webScience.timing.now();

  const onlineServiceVisitData = {
    // Convert aggregate data into array
    AggregateData: Object.keys(aggregateData).map(serviceName => {
      return { serviceName, ...aggregateData[serviceName] }
    }),
    AggregationPeriodStartTime: aggregationPeriodStartTime,
    PingTime: currentTime,
  };
  console.log(onlineServiceVisitData);

  // Reset the aggregate data object for the new aggregation period starting now.
  aggregateData = createNewAggregateDataObject();
  storage.set("OnlineServiceAggregateData", aggregateData);

  // Reset the aggregation period start time for the new aggregation period starting now.
  aggregationPeriodStartTime = currentTime;
  storage.set("OnlineServiceAggregationPeriodStartTime", aggregationPeriodStartTime);
}
