import { getElementBottomHeight, getElementTopHeight, getXPathElement, getXPathElements } from "./common.js";

function getGoogleOrganicResults(): Element[] {
    return Array.from(document.querySelectorAll("#rso .g:not(.related-question-pair .g):not(.g .g):not(.kno-kp *):not(.kno-kp):not(.g-blk)")).filter(element => {
        // Remove shopping results
        return !element.querySelector(":scope > g-card")
    });
}
/**
 * An object that maps each self preferenced result type to metadata for the result.
 * @type {Array}
 */
const selfPreferencedResultMetadata: {
    [type: string]: {
        // Whether Google has a competing service for this type of self preferenced result.
        // If it does not, then these types of results will be removed even if we are in
        // the self preferencing replacement condition.
        competingGoogleService: boolean;
        // A fallback header for a replacement result.
        defaultHeader: string;
        // An xpath to get the text for the header of a replacement result
        // from the self preferenced result.
        headerXpath: string;
        // The header tail for a replacement results.
        headerTail: string;
        // A fallback link for a replacement result.
        defaultLink: string;
        // A fallback description for a replacement result.
        defaultDescription: string;
        // The cite element content for a replacement result.
        cite: string;
        // The cite span element content for a replacement result.
        citeSpan: string;
        // Gets the self preferenced results for the result type.
        getResults: () => Element[],
    }
} = {
    thingsToDo: {
        competingGoogleService: true,
        defaultHeader: "Things to do - Google Search",
        headerXpath: "//*[@role='heading' and starts-with(text(), 'Top sights in')]",
        headerTail: " | Google Travel",
        defaultLink: "https://www.google.com/travel/things-to-do",
        defaultDescription: "Plan your trip with Google. Find flights, hotels, vacation rentals, things to do, and more.",
        cite: "https://www.google.com",
        citeSpan: " › travel › things-to-do",
        getResults: function (): Element[] {
            return getXPathElements("//*[@id='rso']/*[descendant::*[@role='heading' and starts-with(text(), 'Top sights in')]]");
        },
    },
    vacationRental: {
        competingGoogleService: true,
        defaultHeader: "Google Hotel Search",
        headerXpath: "//*[@role='heading' and starts-with(text(), 'Vacation Rentals |')]",
        headerTail: " - Google Vacation Rentals",
        defaultLink: "https://www.google.com/travel/hotels",
        defaultDescription: "Plan your trip with Google. Find flights, hotels, vacation rentals, things to do, and more.",
        cite: "https://www.google.com",
        citeSpan: " › travel › hotels",
        getResults: function (): Element[] {
            return getXPathElements("//*[@id='rso']/*[descendant::*[@role='heading' and starts-with(text(), 'Vacation Rentals |')]]");
        },
    },
    hotel: {
        competingGoogleService: true,
        defaultHeader: "Google Hotel Search",
        headerXpath: "//*[@role='heading' and starts-with(text(), 'Hotels |')]",
        headerTail: " - Google Hotels",
        defaultLink: "https://www.google.com/travel/hotels",
        defaultDescription: "Find a place to stay quickly and easily. Browse hotel photos and reviews, compare rates and availability, and book a room on Google Hotel Search.",
        cite: "https://www.google.com",
        citeSpan: " › travel › hotels",
        getResults: function (): Element[] {
            return getXPathElements("//*[@id='rso']/*[descendant::*[@role='heading' and starts-with(text(), 'Hotels |')]]");
        },
    },
    map: {
        competingGoogleService: true,
        defaultHeader: "Google Maps",
        headerXpath: "//*[starts-with(@aria-label, 'Location Results')]",
        headerTail: " - Google Maps",
        defaultLink: "https://www.google.com/maps",
        defaultDescription: "Find local businesses, view maps and get driving directions in Google Maps.",
        cite: "https://maps.google.com",
        citeSpan: "",
        getResults: function (): Element[] {
            const mapResultsType1 = getXPathElements("//*[@id='rso']/*[descendant::*[starts-with(@aria-label, 'Location Results')]]");

            const mapResultsType2 = getXPathElements("//*[@id='rcnt']/div/div[descendant::*[starts-with(@aria-label, 'Location Results') and not(ancestor::*[@id='center_col'])]]");

            return mapResultsType1.concat(mapResultsType2);
        },
    },
    flight: {
        competingGoogleService: true,
        defaultHeader: "Google Flights",
        headerXpath: "//*[starts-with(@aria-label, 'Location Results')]",
        headerTail: " - Google Flights",
        defaultLink: "https://www.google.com/travel/flights",
        defaultDescription: "Find the best flights fast, track prices, and book with confidence.",
        cite: "https://www.google.com",
        citeSpan: " › travel › flights",
        getResults: function (): Element[] {
            return getXPathElements("//*[@id='rso']/*[descendant::div[@role='button' and descendant::span[text()='Show flights']]]");
        },
    },
    lyric: {
        competingGoogleService: false,
        defaultHeader: "",
        headerXpath: "",
        headerTail: "",
        defaultLink: "",
        defaultDescription: "",
        cite: "",
        citeSpan: "",
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
        competingGoogleService: false,
        defaultHeader: "",
        headerXpath: "",
        headerTail: "",
        defaultLink: "",
        defaultDescription: "",
        cite: "",
        citeSpan: "",
        getResults: function (): Element[] {
            return getXPathElements("//*[@id='rso']/*[descendant::h2[text()='Weather Result']]");
        },
    },
    shoppingMainResults: {
        competingGoogleService: false,
        defaultHeader: "",
        headerXpath: "",
        headerTail: "",
        defaultLink: "",
        defaultDescription: "",
        cite: "",
        citeSpan: "",
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
        competingGoogleService: false,
        defaultHeader: "",
        headerXpath: "",
        headerTail: "",
        defaultLink: "",
        defaultDescription: "",
        cite: "",
        citeSpan: "",
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
    const minHeight = Number.MAX_VALUE;
    let templateElement: Element = null;
    for (const organicResult of organicResults) {
        const resultOffsetHeight = (organicResult as HTMLElement).offsetHeight;
        if (resultOffsetHeight && resultOffsetHeight > 0 && resultOffsetHeight < minHeight) {
            templateElement = organicResult;
        }
    }

    if (!templateElement) {
        return null;
    }

    // There are two types of organic SERs I have seen
    //  1. The header and description containers are within a div element within another div element within
    //     the encapsulating .g element
    //  2. The header and description containers are within a div element within the encapsulating .g element

    // Attempt to create type 1 organic SER
    try {
        const replacementElement = templateElement.cloneNode();

        const templateInnerDiv = templateElement.querySelector('div');
        const replacementInnerDiv = templateInnerDiv.cloneNode();
        replacementElement.appendChild(replacementInnerDiv);

        const templateInnerDivLevel2 = templateInnerDiv.querySelector('div');
        const replacementInnerDivLevel2 = templateInnerDivLevel2.cloneNode();
        replacementInnerDiv.appendChild(replacementInnerDivLevel2);

        const templateInnerDivsLevel3 = templateInnerDivLevel2.querySelectorAll('div');
        const templateHeaderDiv = templateInnerDivsLevel3[0];
        const templateDescriptionDiv = templateInnerDivsLevel3[1];

        const replacementHeaderDiv = templateHeaderDiv.cloneNode();
        replacementInnerDivLevel2.appendChild(replacementHeaderDiv);
        const replacementDescriptionDiv = templateDescriptionDiv.cloneNode();
        replacementInnerDivLevel2.appendChild(replacementDescriptionDiv);

        const templateHeader = templateHeaderDiv.querySelector('a');
        const replacementHeader = templateHeader.cloneNode(true);
        replacementHeaderDiv.appendChild(replacementHeader);

        const templateDescription = templateDescriptionDiv.querySelector('div');
        const replacementDescription = templateDescription.cloneNode();
        replacementDescriptionDiv.appendChild(replacementDescription);

        return replacementElement as Element;
    } catch (error) {
        // Creation of SER element type 1 did not work
    }

    // Attempt to create type 2 organic SER
    try {
        const replacementElement = templateElement.cloneNode();

        const templateInnerDiv = templateElement.querySelector('div');
        const replacementInnerDiv = templateInnerDiv.cloneNode();
        replacementElement.appendChild(replacementInnerDiv);

        const templateInnerDivsLevel2 = templateInnerDiv.querySelectorAll('div');
        const templateHeaderDiv = templateInnerDivsLevel2[0];
        const templateDescriptionDiv = templateInnerDivsLevel2[1];

        const replacementHeaderDiv = templateHeaderDiv.cloneNode();
        replacementInnerDiv.appendChild(replacementHeaderDiv);
        const replacementDescriptionDiv = templateDescriptionDiv.cloneNode();
        replacementInnerDiv.appendChild(replacementDescriptionDiv);

        const templateHeader = templateHeaderDiv.querySelector('a');
        const replacementHeader = templateHeader.cloneNode(true);
        replacementHeaderDiv.appendChild(replacementHeader);

        const templateDescription = templateDescriptionDiv.querySelector('div');
        const replacementDescription = templateDescription.cloneNode();
        replacementDescriptionDiv.appendChild(replacementDescription);

        return replacementElement as Element;
    } catch (error) {
        // Creation of SER element type 2 did not work
    }

    return null;
}

/**
 * Creates a basic organic result with hardcoded HTML.
 * @returns {string} The created element.
 */
function getDefaultTemplateSER(): HTMLDivElement {
    const replacementSER = document.createElement('div');
    replacementSER.classList.add('g');
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
		<div class="VwiC3b yXK7lf MUxGbd yDYNvb lyLwlc lEBKkf">
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
    let replacementSER = getCreatedTemplateSER();
    if (!replacementSER) replacementSER = getDefaultTemplateSER();
    if (!replacementSER) return null;

    try {
        replacementSER.querySelector("h3").innerHTML = header;
        replacementSER.querySelector("a").href = link;
        replacementSER.querySelector("div > span").innerHTML = description;
        replacementSER.querySelector("cite").prepend(document.createTextNode(cite));
        replacementSER.querySelector("cite > span").innerHTML = citeSpan;
        return replacementSER;
    } catch (error) {
        return null;
    }

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
        link = (getXPathElement("//a[@href and descendant::g-more-link]", element) as any).href;
    } catch (error) {
        // Do nothing
    }
    if (!link) {
        try {
            link = (getXPathElement("//g-more-link//a[@href]", element) as any).href;
        } catch (error) {
            // Do nothing
        }
    }
    return link;
}

/**
 * @returns the data for a replacement result for a Google Flights self preferenced result.
 */
function getFlightReplacementData(element: Element): ReplacementData {
    // Attempt to get the origin city.
    let originCity = null;
    try {
        const originValue = (getXPathElement("//*[@placeholder='Enter an origin']", element) as any).value as string;
        originCity = originValue.substring(0, originValue.indexOf(","));
    } catch (error) {
        // Do nothing
    }

    // Attempt to get the destination city.
    let destCity = null;
    try {
        const destValue = (getXPathElement("//*[@placeholder='Enter a destination']", element) as any).value as string;
        destCity = destValue.substring(0, destValue.indexOf(","));
    } catch (error) {
        // Do nothing
    }

    let header = null;
    let link = null;
    if (originCity && destCity) {
        header = `Flights from ${originCity} to ${destCity}` + selfPreferencedResultMetadata["flight"].headerTail;
        link = `https://www.google.com/travel/flights/flights-from-${originCity.replace(/ /g, "-")}-to-${destCity.replace(/ /g, "-")}.html`;
    } else if (originCity) {
        header = `Flights from ${originCity}` + selfPreferencedResultMetadata["flight"].headerTail;
        link = `https://www.google.com/travel/flights/flights-from-${originCity.replace(/ /g, "-")}.html`;
    } else if (destCity) {
        header = `Flights to ${destCity}` + selfPreferencedResultMetadata["flight"].headerTail;
        link = `https://www.google.com/travel/flights/flights-to-${destCity.replace(/ /g, "-")}.html`;
    } else {
        link = selfPreferencedResultMetadata["flight"].defaultLink;
        header = selfPreferencedResultMetadata["flight"].defaultHeader;
    }

    let description = null;
    if (destCity) {
        description = `Find the best flights to ${destCity} fast, track prices, and book with confidence.`;
    } else {
        description = selfPreferencedResultMetadata["flight"].defaultDescription;
    }

    const cite = selfPreferencedResultMetadata["flight"].cite;
    const citeSpan = selfPreferencedResultMetadata["flight"].citeSpan;

    return { header, link, description, cite, citeSpan };
}

/**
 * @returns the data for a replacement result for all self preferenced result types except Google Flights.
 */
function getReplacementData(element, type): ReplacementData {
    const defaultHeader = selfPreferencedResultMetadata[type].defaultHeader;
    let header = null;

    let link = getLink(element);
    if (!link) {
        link = selfPreferencedResultMetadata[type].defaultLink;
        header = defaultHeader
    } else {
        try {
            header = getXPathElement(selfPreferencedResultMetadata[type].headerXpath, element).textContent + selfPreferencedResultMetadata[type].headerTail;
        } catch (error) {
            // Do nothing
        }
    }

    if (!header) header = defaultHeader;
    const description = selfPreferencedResultMetadata[type].defaultDescription;
    const cite = selfPreferencedResultMetadata[type].cite;
    const citeSpan = selfPreferencedResultMetadata[type].citeSpan;

    return { header, link, description, cite, citeSpan };
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
    [type: string]: { elements: Element[], competingGoogleService: boolean }
} {

    // Get the self preferenced results for each of the types we are tracking.
    const selfPreferencedResults: {
        [type: string]: { elements: Element[], competingGoogleService: boolean }
    } = {};
    for (const selfPreferencedResultType in selfPreferencedResultMetadata) {
        selfPreferencedResults[selfPreferencedResultType] = {
            elements: selfPreferencedResultMetadata[selfPreferencedResultType].getResults().filter(elementFilter),
            competingGoogleService: selfPreferencedResultMetadata[selfPreferencedResultType].competingGoogleService
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
        [type: string]: { elements: Element[], competingGoogleService: boolean }
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
        [type: string]: { elements: Element[], competingGoogleService: boolean }
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
        [type: string]: { elements: Element[], competingGoogleService: boolean }
    } = getSelfPreferencedElements(true);

    const selfPreferencedResultsToRemove: {
        [type: string]: Element[]
    } = {};
    const selfPreferencedResultsToReplace: {
        [type: string]: Element[]
    } = {};

    // Get all the self preferenced elements that will be removed because Google does not have a competing Service
    // and all the elements that will be replaced.
    for (const selfPreferencedResultType in selfPreferencedResults) {
        if (selfPreferencedResults[selfPreferencedResultType].competingGoogleService) {
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
            const replacementData = typeOfSelfPreferencedResultToReplace === "flight" ?
                getFlightReplacementData(selfPreferencedResultToReplace) :
                getReplacementData(selfPreferencedResultToReplace, typeOfSelfPreferencedResultToReplace);

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
            topHeight: selfPreferencedElement ? getElementTopHeight(selfPreferencedElement) : -1,
            bottomHeight: selfPreferencedElement ? getElementBottomHeight(selfPreferencedElement) : -1,
            type: selfPreferencedType
        });
        replacedSelfPreferencedElements.push(selfPreferencedElement);
    }

    return {
        selfPreferencedElementDetails: replacedSelfPreferencedElementDetails.concat(removedSelfPreferencedElementDetails), selfPreferencedElements: replacedSelfPreferencedElements
    };
}
