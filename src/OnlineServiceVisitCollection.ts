import { onlineServicesMetadata } from "./OnlineServiceData"
import * as Utils from "./Utils.js"

import * as onlineServiceNavigationMetrics from "../src/generated/onlineServiceNavigation";
import * as studyPings from "../src/generated/pings";

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
    totalAttentionTime: number,
    totalDwellTime: number,
    pageVisitCount: number,
    completedTransactionCount: number,
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
      aggregateData[metadata.serviceName].totalAttentionTime += pageNavigationDetails.attentionDuration;
      aggregateData[metadata.serviceName].totalDwellTime += pageNavigationDetails.pageVisitStopTime - pageNavigationDetails.pageVisitStartTime;
      aggregateData[metadata.serviceName].pageVisitCount += 1;

      const confirmationIncludesString = metadata.confirmationIncludesString;
      const confirmationReferrerIncludesStringArray = metadata.confirmationReferrerIncludesStringArray;

      // Determine if the page navigation was to a confirmation page
      try {
        if (confirmationIncludesString) {
          // Determine if the referrer matches what is expected for a confirmation page. If there are no
          // items in confirmationReferrerIncludesStringArray, then we do not care about the referrer page
          // and set this value to true.
          let referrerMatches = false;

          if (confirmationReferrerIncludesStringArray && confirmationReferrerIncludesStringArray.length > 0) {
            const referrerUrl = new URL(pageNavigationDetails.referrer);

            // Determine if the referrer matches what is expected for the referrer to a confirmation page.
            for (const confirmationReferrerIncludesString of confirmationReferrerIncludesStringArray) {
              if (referrerUrl.pathname.includes(confirmationReferrerIncludesString)) {
                referrerMatches = true;
              }
              break;
            }

          } else {
            referrerMatches = true;
          }

          if (referrerMatches) {
            // Determine if the url matches what is expected for a confirmation page.
            const url = new URL(pageNavigationDetails.url);
            if (url.pathname.includes(confirmationIncludesString)) {
              aggregateData[metadata.serviceName].completedTransactionCount += 1;
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
    totalAttentionTime: number,
    totalDwellTime: number,
    pageVisitCount: number,
    completedTransactionCount: number,
  }
} {
  const newAggregateDataObject = {}
  for (const metadata of onlineServicesMetadata) {
    newAggregateDataObject[metadata.serviceName] = {
      totalAttentionTime: 0,
      totalDwellTime: 0,
      pageVisitCount: 0,
      completedTransactionCount: 0,
    }
  }

  return newAggregateDataObject;
}

/**
 * The callback for the onIdleDaily listener that reports the aggregated
 * data over the current aggregation period.
 **/
function reportOnlineServiceVisitData() {
  onlineServiceNavigationMetrics.aggregationPeriodStartTime.set(new Date(aggregationPeriodStartTime));
  onlineServiceNavigationMetrics.pingTime.set();

  for (const [serviceName, serviceData] of Object.entries(aggregateData)) {

    // Only report data for services where there was an interaction over the aggregation period.
    if (!!serviceData.totalAttentionTime || !!serviceData.totalDwellTime ||
      !!serviceData.pageVisitCount || !!serviceData.completedTransactionCount) {

      onlineServiceNavigationMetrics.onlineServiceData.record({
        service_name: serviceName ? serviceName : "",
        attention_time: Utils.getPositiveInteger(serviceData.totalAttentionTime),
        dwell_time: Utils.getPositiveInteger(serviceData.totalDwellTime),
        page_visit_count: Utils.getPositiveInteger(serviceData.pageVisitCount),
        completed_transaction_count: Utils.getPositiveInteger(serviceData.completedTransactionCount)
      });
    }

  }

  studyPings.onlineServiceNavigation.submit();

  if (__ENABLE_DEVELOPER_MODE__) {
    const onlineServiceVisitData = {
      // Convert aggregate data into array
      AggregateData: Object.keys(aggregateData)
        .filter(serviceName => {
          return !!aggregateData[serviceName].totalAttentionTime ||
            !!aggregateData[serviceName].totalDwellTime ||
            !!aggregateData[serviceName].pageVisitCount ||
            !!aggregateData[serviceName].completedTransactionCount;
        })
        .map(serviceName => {
          return { serviceName, ...aggregateData[serviceName] };
        }),
      AggregationPeriodStartTime: aggregationPeriodStartTime,
      PingTime: webScience.timing.now(),
    };
    console.log(onlineServiceVisitData);
  }

  // Reset the aggregate data object for the new aggregation period starting now.
  aggregateData = createNewAggregateDataObject();
  storage.set("OnlineServiceAggregateData", aggregateData);

  // Reset the aggregation period start time for the new aggregation period starting now.
  aggregationPeriodStartTime = webScience.timing.now();
  storage.set("OnlineServiceAggregationPeriodStartTime", aggregationPeriodStartTime);
}
