/**
 * This file contains js objects that detail which content scripts should be loaded for which pages.
 */

/**
 * The following objects contain:
 *  -- matches which URL fragments to match
 *  -- js: content script to load
 */
export const serpScripts = [
  {
    args: {
      matches: ["*://*.google.com/search?*"],
      js: [{ file: "dist/content-scripts/serp-scripts/google.js" }]
    }
  },
  {
    args: {
      matches: ["*://*.duckduckgo.com/*"],
      js: [{ file: "dist/content-scripts/serp-scripts/duckduckgo.js" }]
    }
  },
  {
    args: {
      matches: ["*://*.bing.com/search?*"],
      js: [{ file: "dist/content-scripts/serp-scripts/bing.js" }]
    }
  },
  {
    args: {
      matches: ["*://*.search.yahoo.com/search*"],
      js: [{ file: "dist/content-scripts/serp-scripts/yahoo.js" }]
    }
  },
  {
    args: {
      matches: ["*://*.ecosia.org/search*"],
      js: [{ file: "dist/content-scripts/serp-scripts/ecosia.js" }]
    }
  },
  {
    args: {
      matches: ["*://*.yandex.com/search*", "*://*.yandex.ru/search*"],
      js: [{ file: "dist/content-scripts/serp-scripts/yandex.js" }]
    }
  },
  {
    args: {
      matches: ["*://*.ask.com/web?*"],
      js: [{ file: "dist/content-scripts/serp-scripts/ask.js" }]
    }
  },
  {
    args: {
      matches: ["*://*.google.com/afs/ads*"],
      js: [{ file: "dist/content-scripts/serp-scripts/askgoogleads.js" }],
      "allFrames": true,
    }
  },
  {
    args: {
      matches: ["*://*.baidu.com/*"],
      js: [{ file: "dist/content-scripts/serp-scripts/baidu.js" }]
    }
  },
]