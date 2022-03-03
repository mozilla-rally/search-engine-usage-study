import { getElementBottomHeight, getElementTopHeight, getXPathElement, getXPathElements } from "./common.js";

function getGoogleOrganicResults(): Element[] {
    return Array.from(document.querySelectorAll("#rso .g:not(.related-question-pair .g):not(.g .g):not(.kno-kp *):not(.kno-kp):not(.g-blk):not(.replacement-result):not([data-async-type='editableDirectionsSearch'] .g)")).filter(element => {
        // Remove shopping results
        return !element.querySelector(":scope > g-card")
    });
}

/**
 * An object that maps self preferenced result types that have a possible replacement
 * to metadata for the result. A self preferenced result type has a possible replacement if
 * Google has a competing service for the self preferenced result type. For example, travel
 * self preferenced results have a competing service (Google Flights), while lyrics do not.
 * @type {Array}
 */
const selfPreferencedResultMetadataReplacement: {
    [type: string]: {
        // The cite element content for a replacement result.
        cite: string;
        // The cite span element content for a replacement result.
        citeSpan: string;
        // Gets the self preferenced results for the result type.
        getResults: () => Element[],
        // Gets fallback data for a replacement result.
        getReplacementData: (element: Element) => ReplacementDataVariableSubset,
        // Gets fallback data for a replacement result.
        getDefaultReplacementData: () => ReplacementDataVariableSubset,
    }
} = {
    thingsToDo: {
        cite: "https://www.google.com",
        citeSpan: " › travel › things-to-do",
        getResults: function (): Element[] {
            return getXPathElements("//*[@id='rso']/*[descendant::*[@role='heading' and starts-with(text(), 'Top sights in')]]");
        },
        getReplacementData: function (element: Element): ReplacementDataVariableSubset {
            return {
                header: getXPathElement(".//*[@role='heading' and starts-with(text(), 'Top sights in')]", element).textContent + " - Google Travel",
                link: getLink(element),
                description: "Plan your trip with Google. Find flights, hotels, vacation rentals, things to do, and more.",
            };
        },
        getDefaultReplacementData: function (): ReplacementDataVariableSubset {
            // From duckduckgo.com search of "Google Things to Do"
            return {
                header: "Things to do - Google Search",
                link: "https://www.google.com/travel/things-to-do",
                description: "Plan your trip with Google. Find flights, hotels, vacation rentals, things to do, and more.",
            };
        },
    },
    vacationRental: {
        cite: "https://www.google.com",
        citeSpan: " › travel › hotels",
        getResults: function (): Element[] {
            return getXPathElements("//*[@id='rso']/*[descendant::*[@role='heading' and starts-with(text(), 'Vacation Rentals |')]]");
        },
        getReplacementData: function (element: Element): ReplacementDataVariableSubset {
            return {
                header: getXPathElement(".//*[@role='heading' and starts-with(text(), 'Vacation Rentals |')]", element).textContent + " - Google Travel",
                link: getLink(element),
                description: "Plan your trip with Google. Find flights, hotels, vacation rentals, things to do, and more.",
            };
        },
        getDefaultReplacementData: function (): ReplacementDataVariableSubset {
            // duckduckgo.com search of "Google Vacation Rentals" does not provide a search result specifically for
            // Google Vacation Rentals so we instead used HTML tags on the Google Vacation Rentals homepage.
            return {
                // From the HTML <title> tag on the Google Vacation Rentals homepage.
                header: "Google Hotel Search",
                // This URL takes you to the Google Vacation Rentals homepage.
                link: "https://www.google.com/travel/hotels?ts=CAI",
                // From the HTML <meta name="description"> tag on the Google Vacation Rentals homepage.
                description: "Plan your trip with Google. Find flights, hotels, vacation rentals, things to do, and more.",
            };
        },
    },
    hotel: {
        cite: "https://www.google.com",
        citeSpan: " › travel › hotels",
        getResults: function (): Element[] {
            return getXPathElements("//*[@id='rso']/*[descendant::*[@role='heading' and starts-with(text(), 'Hotels |')]]");
        },
        getReplacementData: function (element: Element): ReplacementDataVariableSubset {
            return {
                // The tail is from a DuckDuckGo search of "Google Hotels in Detroit"
                header: getXPathElement(".//*[@role='heading' and starts-with(text(), 'Hotels |')]", element).textContent + " - Google Hotel Search",
                link: getLink(element),
                description: "Find a place to stay quickly and easily. Browse hotel photos and reviews, compare rates and availability, and book a room on Google Hotel Search.",
            };
        },
        getDefaultReplacementData: function (): ReplacementDataVariableSubset {
            // From duckduckgo.com search of "Google Hotels"
            return {
                header: "Google Hotel Search",
                link: "https://www.google.com/travel/hotels",
                description: "Find a place to stay quickly and easily. Browse hotel photos and reviews, compare rates and availability, and book a room on Google Hotel Search.",
            };
        },
    },
    localSearch: {
        cite: "https://maps.google.com",
        citeSpan: "",
        getResults: function (): Element[] {
            const localSearchResultsType1 = getXPathElements("//*[@id='rso']/*[descendant::*[starts-with(@aria-label, 'Location Results')]]");

            const localSearchResultsType2 = getXPathElements("//*[@id='rcnt']/div/div[descendant::*[starts-with(@aria-label, 'Location Results') and not(ancestor::*[@id='center_col'])]]");

            return localSearchResultsType1.concat(localSearchResultsType2);
        },
        getReplacementData: function (element: Element): ReplacementDataVariableSubset {
            return {
                // The tail is from a DuckDuckGo search of "Google Hotels in Detroit"
                header: getXPathElement(".//*[starts-with(@aria-label, 'Location Results')]", element).textContent + " - Google Maps",
                link: getLink(element),
                description: "Find local businesses, view maps and get driving directions in Google Maps.",
            };
        },
        getDefaultReplacementData: function (): ReplacementDataVariableSubset {
            // From duckduckgo.com search of "Google Maps"
            return {
                header: "Google Maps",
                link: "https://maps.google.com",
                description: "Find local businesses, view maps and get driving directions in Google Maps.",
            };
        },
    },
    map: {
        cite: "https://maps.google.com",
        citeSpan: "",
        getResults: function (): Element[] {
            return getXPathElements("//*[@id='rso']/*[descendant::*[@aria-label= 'From'] and descendant::*[@aria-label= 'To']]");
        },
        getReplacementData: function (element: Element): ReplacementDataVariableSubset {
            // Attempt to get the origin.
            let origin = null;
            try {
                origin = (getXPathElement(".//*[@aria-label='From']", element) as any).placeholder as string;
                if (origin == "My location") {
                    origin = "Your location";
                }
            } catch (error) {
                // Do nothing
            }

            // Attempt to get the destination.
            let dest = null;
            try {
                dest = (getXPathElement(".//*[@aria-label='To']", element) as any).placeholder as string;
                if (dest == "My location") {
                    dest = null;
                }
            } catch (error) {
                // Do nothing
            }

            const header = origin && dest ? `${origin} to ${dest} - Google Maps` : null;
            const dataUrl = element.querySelector('[data-url]').getAttribute('data-url');
            const url = dataUrl ? "https://www.google.com" + dataUrl : null;

            return {
                header: header,
                link: url,
                description: "Find local businesses, view maps and get driving directions in Google Maps.",
            };
        },
        getDefaultReplacementData: function (): ReplacementDataVariableSubset {
            // From duckduckgo.com search of "Google Maps"
            return {
                header: "Google Maps",
                link: "https://maps.google.com",
                description: "Find local businesses, view maps and get driving directions in Google Maps.",
            };
        },
    },
    flight: {
        cite: "https://www.google.com",
        citeSpan: " › travel › flights",
        getResults: function (): Element[] {
            return getXPathElements("//*[@id='rso']/*[descendant::div[@role='button' and descendant::span[text()='Show flights']]]");
        },
        getReplacementData: function (element: Element): ReplacementDataVariableSubset {
            // Attempt to get the origin city.
            let originCity = null;
            try {
                const originValue = (getXPathElement(".//*[@placeholder='Enter an origin']", element) as any).value as string;
                originCity = originValue.substring(0, originValue.indexOf(","));
            } catch (error) {
                // Do nothing
            }

            // Attempt to get the destination city.
            let destCity = null;
            try {
                const destValue = (getXPathElement(".//*[@placeholder='Enter a destination']", element) as any).value as string;
                destCity = destValue.substring(0, destValue.indexOf(","));
            } catch (error) {
                // Do nothing
            }

            let header = null;
            let link = null;
            let description = null;
            if (originCity && destCity) {
                header = `Flights from ${originCity} to ${destCity}` + " - Google Flights";
                link = `https://www.google.com/travel/flights/flights-from-${originCity.replace(/ /g, "-")}-to-${destCity.replace(/ /g, "-")}.html`;
                description = `Find the best flights from ${originCity} to ${destCity} fast, track prices, and book with confidence.`;
            } else if (originCity) {
                header = `Flights from ${originCity}` + " - Google Flights";
                link = `https://www.google.com/travel/flights/flights-from-${originCity.replace(/ /g, "-")}.html`;
                description = `Find the best flights from ${originCity} fast, track prices, and book with confidence.`;
            } else if (destCity) {
                header = `Flights to ${destCity}` + " - Google Flights";
                link = `https://www.google.com/travel/flights/flights-to-${destCity.replace(/ /g, "-")}.html`;
                description = `Find the best flights to ${destCity} fast, track prices, and book with confidence.`;
            }

            return { header, link, description };
        },
        getDefaultReplacementData: function (): ReplacementDataVariableSubset {
            // From duckduckgo.com search of "Google Flights"
            return {
                header: "Book flights with confidence | Google Flights",
                link: "https://www.google.com/flights",
                description: "Find cheap flights and airline tickets. Google Flights helps you compare and track airfares on hundreds of airlines to help you find the best flight deals.",
            };
        },
    },
    // Searching "Flights to Texas" gets this result
    flight2: {
        cite: "https://www.google.com",
        citeSpan: " › travel › flights",
        getResults: function (): Element[] {
            return getXPathElements("//*[@id='rso']/*[descendant::div[@role='button' and descendant::span[text()='More destinations']]]");
        },
        getReplacementData: function (element: Element): ReplacementDataVariableSubset {
            const linkElement = element.querySelector("[href]");
            const link = (linkElement as any).href;

            let destCity = null;
            if (!linkElement.querySelector("div").querySelector("*")) {
                destCity = linkElement.querySelector("div").textContent;
            }

            const header = `Flights to ${destCity} - Google Flights`

            const description = `Find the best flights to ${destCity} fast, track prices, and book with confidence.`;

            return { header, link, description };
        },
        getDefaultReplacementData: function (): ReplacementDataVariableSubset {
            // From duckduckgo.com search of "Google Flights"
            return {
                header: "Book flights with confidence | Google Flights",
                link: "https://www.google.com/flights",
                description: "Find cheap flights and airline tickets. Google Flights helps you compare and track airfares on hundreds of airlines to help you find the best flight deals.",
            };
        },
    },
}

/**
 * An object that maps self preferenced result types that do not have a possible replacement
 * to metadata for the result. A self preferenced result type does not has a possible replacement
 * if Google does not have a competing service for the self preferenced result type. For example,
 * lyrics self preferenced results do not have have a competing service, while travel does (Google Flights).
 * @type {Array}
 */
const selfPreferencedResultMetadataNoReplacement: {
    [type: string]: {
        // Gets the self preferenced results for the result type.
        getResults: () => Element[],
    }
} = {
    lyric: {
        getResults: function (): Element[] {
            // Gets lyrics in the 'Lyrics' tab of a tabbed knowledge panel.
            let lyricsElements: Element[] = Array.from(document.querySelectorAll("[aria-label='Lyrics']"));

            // If there is not a knowledge panel, gets the standard lyrics result.
            if (!document.querySelector("[id^='kp-wp-tab']")) {
                lyricsElements = lyricsElements.concat(getXPathElements("//*[@id='rso']/*[descendant::*[@data-lyricid]]"));
            }

            return lyricsElements;
        },
    },
    weather: {
        getResults: function (): Element[] {
            return getXPathElements("//*[@id='rso']/*[descendant::h2[text()='Weather Result']]");
        },
    },
    shoppingMainResults: {
        getResults: function (): Element[] {
            // Get the self preferenced shopping results in the main results column that are labeled as 'Ads'
            // and generally at the top of the page.
            const adSelfPreferencedProductResult: Element[] = Array.from(document.querySelectorAll(".cu-container")).filter(element => {
                return !element.closest("#rhs") && !element.querySelector(".commercial-unit-desktop-rhs")
            });

            // Get the self preferenced shopping results in the main results column that are not labeled as 'Ads'
            // and generally not at the top of the page.
            const nonAdSelfPreferencedProductResult: Element[] = Array.from(document.querySelectorAll(".g")).filter(element => {
                return !!element.querySelector("[data-enable-product-traversal]") && !element.closest("#rhs");
            });

            return adSelfPreferencedProductResult.concat(nonAdSelfPreferencedProductResult);
        },
    },
    shoppingRhsResults: {
        getResults: function (): Element[] {
            // Get the self preferenced shopping results in the column to the right of the main results.
            return Array.from(document.querySelectorAll(".cu-container")).filter(element => {
                return !!element.closest("#rhs") || !!element.querySelector(".commercial-unit-desktop-rhs")
            });
        },
    }
}

function elementFilter(element: Element) {
    if (element.querySelector("#rso") || element.querySelector("[id^='kp-wp-tab']") || element.querySelectorAll("div.g").length > 1) {
        return false;
    }

    return true;
}

/**
 * Attempts to create a basic organic result based on the organic results on the SERP.
 * @returns {string} The created element.
 */
function getCreatedTemplateSER(): Element {
    // Gets the organic results
    const organicResults = getGoogleOrganicResults().filter(elementFilter);

    // Gets the organic element with the smallest height. We are assuming the smallest height element will be
    // the most basic organic result.
    let minTemplateSearchResultHeight = Number.MAX_VALUE;
    let templateSearchResult: Element = null;
    for (const organicResult of organicResults) {
        const resultOffsetHeight = (organicResult as HTMLElement).offsetHeight;
        if (resultOffsetHeight && resultOffsetHeight > 0 && resultOffsetHeight < minTemplateSearchResultHeight) {
            templateSearchResult = organicResult;
            minTemplateSearchResultHeight = resultOffsetHeight;
        }
    }

    if (!templateSearchResult) {
        return null;
    }

    const linkElement = getXPathElement(".//a[@href and descendant::h3 and descendant::cite and not(ancestor::g-expandable-container)]", templateSearchResult);

    const headerElement = linkElement.querySelector("h3");
    const citeElement = linkElement.querySelector("cite");
    const description = Array.from(templateSearchResult.querySelectorAll("div:not(g-expandable-container *)")).filter(element => {
        return !element.querySelector("*:not(span):not(em)")
    }).reduce((largestElement, currentElement) => {
        return currentElement.textContent.length > largestElement.textContent.length ?
            currentElement :
            largestElement
    });

    if (!headerElement || !citeElement || !description) {
        return null;
    }

    const replacementSearchResult = templateSearchResult.cloneNode() as Element;
    const elementsToReplace = [headerElement, citeElement, description];

    const templateToReplacementElementMap = new Map();
    templateToReplacementElementMap.set(templateSearchResult, replacementSearchResult);

    let loopCounter = 0;

    for (const elementToReplace of elementsToReplace) {
        let childReplacementNode = null;
        let currentNode = elementToReplace;

        while (!templateToReplacementElementMap.has(currentNode)) {
            loopCounter += 1;
            if (loopCounter >= 30) {
                return null;
            }

            const newReplacementNode = currentNode.cloneNode();
            if (currentNode == description) {
                (newReplacementNode as Element).classList.add("self-preferenced-replacement-description");
            }

            if (childReplacementNode) {
                (newReplacementNode as Element).append(childReplacementNode);
            }

            childReplacementNode = newReplacementNode;
            templateToReplacementElementMap.set(currentNode, newReplacementNode);

            currentNode = currentNode.parentElement;
        }

        if (childReplacementNode) {
            templateToReplacementElementMap.get(currentNode).append(childReplacementNode)
        }
    }

    if (linkElement.children[0].matches("br")) {
        replacementSearchResult.querySelector("a").prepend(document.createElement('br'))
    }

    let templateSpan = templateSearchResult.querySelector("a cite > span");
    if (!templateSpan) {
        templateSpan = document.querySelector(".g a cite > span");
    }

    if (templateSpan) {
        replacementSearchResult.querySelector("cite").append(templateSpan.cloneNode())
    } else {
        return null;
    }

    return replacementSearchResult;
}

/**
 * Creates a basic organic result with hardcoded HTML.
 * @returns {string} The created element.
 */
function getDefaultTemplateSER(): HTMLDivElement {
    const replacementSER = document.createElement('div');
    replacementSER.classList.add('g', 'replacement-result');
    replacementSER.innerHTML = `
<div class="jtfYYd">
	<div class="NJo7tc Z26q7c jGGQ5e" data-header-feature="0">
		<div class="yuRUbf">
			<a href="">
				<br>
				<h3 class="LC20lb MBeuO DKV0Md"></h3>
				<div class="TbwUpd NJjxre">
					<cite class="iUh30 qLRx3b tjvcx" role="text">
						<span class="dyjrff qzEoUe" role="text"></span>
					</cite>
				</div>
			</a>
		</div>
	</div>
	<div class="NJo7tc Z26q7c uUuwM" data-content-feature="1">
		<div class="VwiC3b yXK7lf MUxGbd yDYNvb lyLwlc lEBKkf self-preferenced-replacement-description">
		</div>
	</div>
</div>
`;

    // Get all of the CSS selectors for the document.
    const selectors: string[] = [];
    for (const sheet of document.styleSheets) {
        try {
            selectors.push(...Object.values(sheet.cssRules).map(x => { return x["selectorText"] }).filter(selectorText => !!selectorText));
        } catch (error) {
            // Do nothing
        }
    }
    const selectorsString = selectors.join(" ");


    // A list of all the classes in the hardcoded HTML above
    const classes = ["jtfYYd", "NJo7tc", "Z26q7c", "jGGQ5e", "yuRUbf", "LC20lb", "MBeuO", "DKV0Md", "TbwUpd", "NJjxre", "iUh30", "qLRx3b", "tjvcx", "dyjrff", "qzEoUe", "NJo7tc", "Z26q7c", "uUuwM", "VwiC3b", "yXK7lf", "MUxGbd", "yDYNvb", "lyLwlc", "lEBKkf",];

    // Check that each of the classes in the default template HTML is either in the CSS or in the DOM.
    for (const className of classes) {
        if (!selectorsString.includes(className) && !document.querySelector(`.${className}`)) {
            console.log(`Class not found: ${className}`);
            return null;
        }
    }

    return replacementSER;
}



/**
 * Creates a replacement result from the given parameters.
 * @param {string} header - The header for the replacement result.
 * @param {string} link - The link for the replacement result.
 * @param {string} description - The description for the replacement result.
 * @param {string} cite - The cite for the replacement result.
 * @param {string} citeSpan - The cite span for the replacement result.
 * @returns the replacement result created with the given parameters.
 */
function generateReplacementResult(header: string, link: string, description: string, cite: string, citeSpan: string): Element {
    try {
        const replacementSER = getCreatedTemplateSER();
        if (replacementSER) {
            replacementSER.querySelector("a h3").innerHTML = header;
            replacementSER.querySelector("a").href = link;
            replacementSER.querySelector(".self-preferenced-replacement-description").innerHTML = description;
            replacementSER.querySelector("a cite").prepend(document.createTextNode(cite));
            replacementSER.querySelector("a cite > span").innerHTML = citeSpan;

            console.log("Created from template")
            return replacementSER;
        }


    } catch (error) {
        // Do nothing
    }


    try {
        const replacementSER = getDefaultTemplateSER();
        if (replacementSER) {
            replacementSER.querySelector("h3").innerHTML = header;
            replacementSER.querySelector("a").href = link;
            replacementSER.querySelector(".self-preferenced-replacement-description").innerHTML = description;
            replacementSER.querySelector("cite").prepend(document.createTextNode(cite));
            replacementSER.querySelector("cite > span").innerHTML = citeSpan;

            console.log("Created from hardcode")
            return replacementSER;
        }

    } catch (error) {
        // Do nothing
    }

    return null;
}

/**
 * @returns the main link for a self preferenced result (e.g., the "More Places" button link) if it can be found.
 * Otherwise, null.
 */
function getLink(element: Element): string {
    let link = null;

    // Sometimes the g-more-link element is within the a element and sometimes the a element is within
    // g-more-link element so we try both ways here.
    try {
        link = (getXPathElement(".//a[@href and descendant::g-more-link]", element) as any).href;
    } catch (error) {
        // Do nothing
    }
    if (!link) {
        try {
            link = (getXPathElement(".//g-more-link//a[@href]", element) as any).href;
        } catch (error) {
            // Do nothing
        }
    }
    return link;
}

/**
 * @returns the data for a replacement result for all self preferenced result types except Google Flights.
 */
function getReplacementData(element, type): ReplacementData {
    const cite = selfPreferencedResultMetadataReplacement[type].cite;
    const citeSpan = selfPreferencedResultMetadataReplacement[type].citeSpan;

    try {
        const replacementData = selfPreferencedResultMetadataReplacement[type].getReplacementData(element);
        if (replacementData.description && replacementData.header && replacementData.link) {
            return { ...replacementData, cite, citeSpan };
        }
    } catch (error) {
        // Do nothing
    }

    return {
        ...selfPreferencedResultMetadataReplacement[type].getDefaultReplacementData(),
        cite,
        citeSpan
    };
}

/**
 * An HTML class that identifies results that have previously been retrieved by 
 * getSelfPreferencedElements if noRepeats is true.
 */
const trackedElementClass = "rally-study-self-preferenced-tracking";

/**
 * @param {boolean} noRepeats - Whether to get the results that were retrieved with a previous
 * call to this function.
 * @returns an object where each key is a self preferenced result type and each value
 * is the self preferenced results on the SERP of that type.
 */
function getSelfPreferencedElements(noRepeats: boolean): {
    [type: string]: { elements: Element[], possibleReplacementResult: boolean }
} {

    // Get the self preferenced results for each of the types we are tracking.
    const selfPreferencedResults: {
        [type: string]: { elements: Element[], possibleReplacementResult: boolean }
    } = {};
    for (const selfPreferencedResultType in selfPreferencedResultMetadataReplacement) {
        selfPreferencedResults[selfPreferencedResultType] = {
            elements: selfPreferencedResultMetadataReplacement[selfPreferencedResultType].getResults().filter(elementFilter),
            possibleReplacementResult: true,
        }
    }
    for (const selfPreferencedResultType in selfPreferencedResultMetadataNoReplacement) {
        selfPreferencedResults[selfPreferencedResultType] = {
            elements: selfPreferencedResultMetadataNoReplacement[selfPreferencedResultType].getResults().filter(elementFilter),
            possibleReplacementResult: false,
        }
    }

    if (noRepeats) {
        // Filter out the results that have previously been returned by this function.
        for (const selfPreferencedResultType in selfPreferencedResults) {
            selfPreferencedResults[selfPreferencedResultType].elements = selfPreferencedResults[selfPreferencedResultType].elements.filter(element => {
                return !element.classList.contains(trackedElementClass);
            });
        }

        // Add trackedElementClass to the results that will be returned by this function call so that they can be identified
        // on subsequent calls to this function.
        for (const selfPreferencedResultType in selfPreferencedResults) {
            const elements = selfPreferencedResults[selfPreferencedResultType].elements;
            for (const element of elements) {
                element.classList.add(trackedElementClass);
            }
        }
    }

    return selfPreferencedResults;
}

// A list of self preferenced result details that have been removed from the SERP.
const removedSelfPreferencedElementDetails: SelfPreferencedDetail[] = [];
/**
 * Removes the self preferenced results on the SERP.
 * @returns {string} An array of the details of the self preferenced results that were removed from the page.
 */
export function removeSelfPreferenced(): SelfPreferencedDetail[] {
    // Remove lyric tabs
    const lyricsTabs = getXPathElements("//span[@role='tab' and descendant::span[text()='Lyrics']]");
    for (const lyricsTab of lyricsTabs) {
        (lyricsTab as any).style.setProperty("display", "none");
    }

    const selfPreferencedResults: {
        [type: string]: { elements: Element[], possibleReplacementResult: boolean }
    } = getSelfPreferencedElements(true);

    // Get details of all self preferenced results
    for (const selfPreferencedResultType in selfPreferencedResults) {
        const elements = selfPreferencedResults[selfPreferencedResultType].elements;
        for (const element of elements) {
            removedSelfPreferencedElementDetails.push({
                topHeight: getElementTopHeight(element),
                bottomHeight: getElementBottomHeight(element),
                type: selfPreferencedResultType
            });
        }
    }

    // Remove all self preferenced results
    // This is in separate loop from the one above that gets the details so that
    // any removal will not affect the heights
    for (const selfPreferencedResultType in selfPreferencedResults) {
        const elements = selfPreferencedResults[selfPreferencedResultType].elements;
        for (const element of elements) {
            (element as any).style.setProperty("display", "none");
        }
    }

    return removedSelfPreferencedElementDetails;
}

/**
 * @returns {string} An object containing an array of the details of the self preferenced results on the page and an array of
 * the self preferenced results. This is used if there will be no modification to the SERP.
 */
export function getSelfPreferencedDetailsAndElements(): { selfPreferencedElementDetails: SelfPreferencedDetail[], selfPreferencedElements: Element[] } {

    // We pass false to getSelfPreferencedElements because we want to return details for all self preferenced elements on the page,
    // even if details for a particular element were previously returned by a call to this function.
    const selfPreferencedResults: {
        [type: string]: { elements: Element[], possibleReplacementResult: boolean }
    } = getSelfPreferencedElements(false);

    const selfPreferencedElementDetails: SelfPreferencedDetail[] = [];
    const selfPreferencedElements: Element[] = [];

    // Get the details of all the self preferenced results.
    for (const selfPreferencedResultType in selfPreferencedResults) {
        const elements = selfPreferencedResults[selfPreferencedResultType].elements;
        for (const element of elements) {
            selfPreferencedElements.push(element);
            selfPreferencedElementDetails.push({
                topHeight: getElementTopHeight(element),
                bottomHeight: getElementBottomHeight(element),
                type: selfPreferencedResultType
            });
        }
    }

    return { selfPreferencedElementDetails, selfPreferencedElements };
}

// A list of replacement results that have been added to the SERP.
const replacedSelfPreferencedElementsAndType: { selfPreferencedType: string, selfPreferencedElement: Element }[] = [];

/**
 * Replaces the self preferenced results on the page that are for a Google service and removes
 * the other self preferenced results for which Google does not have a competing own service.
 * @returns {string} An object containing:
 *      1) An array of the details of the replacement results created and of the self preferenced results that were
 *         removed without replacement
 *      2) An array of the replacement results that have been created.
 * the self preferenced results.
 */
export function replaceSelfPreferenced(): { selfPreferencedElementDetails: SelfPreferencedDetail[], selfPreferencedElements: Element[] } {
    const selfPreferencedResults: {
        [type: string]: { elements: Element[], possibleReplacementResult: boolean }
    } = getSelfPreferencedElements(true);

    const selfPreferencedResultsToRemove: {
        [type: string]: Element[]
    } = {};
    const selfPreferencedResultsToReplace: {
        [type: string]: Element[]
    } = {};

    // Get all the self preferenced elements that will be removed and all the elements that will be replaced.
    for (const selfPreferencedResultType in selfPreferencedResults) {
        if (selfPreferencedResults[selfPreferencedResultType].possibleReplacementResult) {
            selfPreferencedResultsToReplace[selfPreferencedResultType] = selfPreferencedResults[selfPreferencedResultType].elements;
        } else {
            selfPreferencedResultsToRemove[selfPreferencedResultType] = selfPreferencedResults[selfPreferencedResultType].elements;
        }
    }

    // Get the details of all the self preferenced results that do not have a competing Google service and will be removed.
    for (const selfPreferencedResultsToRemoveType in selfPreferencedResultsToRemove) {
        const elements = selfPreferencedResultsToRemove[selfPreferencedResultsToRemoveType];
        for (const element of elements) {
            removedSelfPreferencedElementDetails.push({
                topHeight: getElementTopHeight(element),
                bottomHeight: getElementBottomHeight(element),
                type: selfPreferencedResultsToRemoveType
            });
        }
    }

    // Remove all the self preferenced results that do not have a competing Google service
    for (const selfPreferencedResultsToRemoveType in selfPreferencedResultsToRemove) {
        const elements = selfPreferencedResultsToRemove[selfPreferencedResultsToRemoveType];
        for (const element of elements) {
            (element as any).style.setProperty("display", "none");
        }
    }

    // Creates the replacement results and removes the self preferenced results they are replacing.
    for (const typeOfSelfPreferencedResultToReplace in selfPreferencedResultsToReplace) {
        for (const selfPreferencedResultToReplace of selfPreferencedResultsToReplace[typeOfSelfPreferencedResultToReplace]) {
            // Get the data used to populate a replacement result from the self preferenced result.
            const replacementData = getReplacementData(selfPreferencedResultToReplace, typeOfSelfPreferencedResultToReplace);

            // Generate a replacement result.
            const replacementResult = generateReplacementResult(replacementData.header, replacementData.link, replacementData.description, replacementData.cite, replacementData.citeSpan);

            // Insert the replacement result right before the self preferenced result and then remove the self preferenced result.
            if (replacementResult) {
                selfPreferencedResultToReplace.parentElement.insertBefore(replacementResult, selfPreferencedResultToReplace);
                (selfPreferencedResultToReplace as any).style.setProperty("display", "none");
            }

            // Add the replacement result to the list of replacement results that is built up across different runs of this function.
            // We do this because if a future run adds more replacement results, we will want to recalculate the position of
            // all the previously added replacement results.
            replacedSelfPreferencedElementsAndType.push({
                selfPreferencedType: typeOfSelfPreferencedResultToReplace,
                selfPreferencedElement: replacementResult,
            })
        }
    }


    const replacedSelfPreferencedElements: Element[] = [];
    const replacedSelfPreferencedElementDetails: SelfPreferencedDetail[] = [];

    // Gets the details of replacement results from all runs of this function. We wait until the end of this function call
    // to get these details because replacing/removing a self preferenced result may change the top height and bottom height
    // of a replacement result.
    for (const { selfPreferencedType, selfPreferencedElement } of replacedSelfPreferencedElementsAndType) {
        replacedSelfPreferencedElementDetails.push({
            topHeight: selfPreferencedElement ? getElementTopHeight(selfPreferencedElement) : Number.MAX_SAFE_INTEGER,
            bottomHeight: selfPreferencedElement ? getElementBottomHeight(selfPreferencedElement) : Number.MAX_SAFE_INTEGER,
            type: selfPreferencedType
        });
        replacedSelfPreferencedElements.push(selfPreferencedElement);
    }

    return {
        selfPreferencedElementDetails: replacedSelfPreferencedElementDetails.concat(removedSelfPreferencedElementDetails), selfPreferencedElements: replacedSelfPreferencedElements
    };
}
