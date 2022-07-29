import { timing } from "@mozilla/web-science";

/**
 * How long the page has had the user's attention.
 * @type {number}
 */
let attentionDuration = 0;

/**
 * When the page attention state was last updated.
 * @type {number}
 */
let lastAttentionUpdateTime = 0;

/**
 * Whether the page currently has the user's attention.
 * @type {boolean}
 */
let pageHasAttention = false;

/**
 * Initializes attention tracking for the page.
 */
export function initializeAttentionTracking() {
    // Add listener to get page attention update messages.
    browser.runtime.onMessage.addListener(message => {
        if (message.type === "webScience.pageManager.pageAttentionUpdate") {
            if (pageHasAttention === message.pageHasAttention) {
                return;
            }

            pageHasAttention = message.pageHasAttention;

            // If the page has received attention, update lastAttentionUpdateTime.
            // If the page has lost attention, update attentionDuration
            if (pageHasAttention) {
                lastAttentionUpdateTime = message.timeStamp;
            } else {
                attentionDuration = attentionDuration + (message.timeStamp - lastAttentionUpdateTime);
            }
        }
    });

    // If the page is not hidden, set pageHasAttention to true and 
    // set the lastAttentionUpdateTime to the current time. We do this because 
    // we may miss an initial pageAttentionUpdate message.
    if (!document.hidden) {
        pageHasAttention = true;
        lastAttentionUpdateTime = timing.fromMonotonicClock(window.performance.timeOrigin, false)
    }
}

/**
 * @returns {number} How long the page has had the user's attention.
 */
export function getAttentionDuration(): number {
    // If the page has attention, we return attentionDuration plus the
    // difference between the current time and lastAttentionUpdateTime.
    // Otherwise, we return attentionDuration.
    if (pageHasAttention) {
        return attentionDuration + (timing.now() - lastAttentionUpdateTime);
    }
    else {
        return attentionDuration;
    }
}

const millisecondsPerSecond = 1000;
export function registerAttentionAndDwellTimeMessageOnInterval(): void {
    setInterval(() => {
        browser.runtime.sendMessage({
            type: "AttentionAndDwellTimeUpdate",
            attentionDuration: getAttentionDuration(),
            dwellTime: getDwellTime(),
        });
    }, millisecondsPerSecond);
}

export function getDwellTime(timeStamp?: number): number {
    if (timeStamp) {
        return timing.fromMonotonicClock(timeStamp, true) - timing.fromMonotonicClock(window.performance.timeOrigin, false);
    } else {
        return timing.now() - timing.fromMonotonicClock(window.performance.timeOrigin, false);
    }
}
