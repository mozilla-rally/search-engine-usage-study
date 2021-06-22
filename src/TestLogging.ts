/**
 * This module provides utilities for logging testing events.
 * The module currently just outputs events with `console.log`.
 * 
 * @module debugging
 */

/**
 * Whether to log testing events.
 * @private
 * @type {boolean}
 * @default
 */
let testing = false;

/**
 * Enable logging for testing events.
 */
export function enableTesting() {
  testing = true;
}

/**
 * A function that outputs a message to `console.log` in a consistent format.
 * @callback testingLogger
 * @param {string} type - An identifying type of the object being output.
 * @param {string} object - The object to output to `console.log`.
 */

/**
 * Create a testing logger, a function that logs events to be tested (as strings).
 * @returns {testingLogger} - A testing logger.
 */
export function getTestingLog() {
  return ((type, object) => {
    if (testing) console.log("rallyTestingOutput." + type + ":" + JSON.stringify(object));
  });
}