/**
 * This file contains js objects that detail which content scripts should be loaded for which pages.
 */

/**
 * The following objects contain:
 *  -- matches: matches which URL fragments to match
 *  -- js: content script to load
 */
export const serpScripts = [
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
      matches: ["*://*.search.brave.com/search*"],
      js: [{ file: "dist/content-scripts/serp-scripts/brave.js" }]
    }
  },
  {
    args: {
      matches: ["*://*.ask.com/web?*"],
      js: [{ file: "dist/content-scripts/serp-scripts/ask.js" }]
    }
  },
  // This is the content scripts for advertisements on Ask.com SERPs.
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

// Content script for Google that does not modify self preferenced results
export const googleDefaultScript = {
  args: {
    matches: ["*://*.google.com/search?*"],
    js: [{ code: "const selfPreferencingType = null;" }, { file: "dist/content-scripts/serp-scripts/google.js" }]
  }
};

// Content script for Google that removes self preferenced results
export const googleRemoveScript = {
  args: {
    matches: ["*://*.google.com/search?*"],
    js: [{ code: "const selfPreferencingType = 'Remove';" }, { file: "dist/content-scripts/serp-scripts/google.js" }]
  }
};

// Content script for Google that replaces self preferenced results
export const googleReplaceScript = {
  args: {
    matches: ["*://*.google.com/search?*"],
    js: [{ code: "const selfPreferencingType = 'Replace';" }, { file: "dist/content-scripts/serp-scripts/google.js" }]
  }
};
