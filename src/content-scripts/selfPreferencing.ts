import { getElementBottomHeight, getElementTopHeight, getXPathElement, getXPathElements } from "./common.js";

/**
 * An object that maps each self preferenced result type to metadata for the result.
 * @type {Array}
 */
const selfPreferencedResultMetadata: {
    [type: string]: {
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
        defaultHeader: "Things to do - Google",
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
        defaultHeader: "Google Maps",
        headerXpath: "//*[starts-with(@aria-label, 'Location Results')]",
        headerTail: " - Google Maps",
        defaultLink: "https://www.google.com/maps",
        defaultDescription: "Find local businesses, view maps and get driving directions in Google Maps.",
        cite: "https://maps.google.com",
        citeSpan: "",
        getResults: function (): Element[] {
            const mapResultsType1 = getXPathElements("//*[@id='rso']/*[descendant::*[starts-with(@aria-label, 'Location Results')]]");

            // Map results that do not show up at top of page. Search "malls in new york" for example
            const mapResultsType2 = getXPathElements("//*[@id='rcnt']/div/div[descendant::*[starts-with(@aria-label, 'Location Results')]]");

            return mapResultsType1.concat(mapResultsType2);
        },
    },
    flight: {
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
        defaultHeader: "",
        headerXpath: "",
        headerTail: "",
        defaultLink: "",
        defaultDescription: "",
        cite: "",
        citeSpan: "",
        getResults: function (): Element[] {
            let lyricsElements: Element[] = Array.from(document.querySelectorAll("[aria-label='Lyrics']"));

            if (!document.querySelector("[id^='kp-wp-tab']")) {
                lyricsElements = lyricsElements.concat(getXPathElements("//*[@id='rso']/*[descendant::*[@data-lyricid]]"));
            }

            return lyricsElements;
        },
    },
    weather: {
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
    }
}

/**
 * Attempts to create a basic organic result based on the organic results on the SERP.
 * @returns {string} The created element.
 */
function getCreatedTemplateSER(): Element {
    // Gets the organic results
    const organicResults = document.querySelectorAll("#rso .g:not(.related-question-pair .g):not(.g .g):not(.kno-kp *):not(.kno-kp):not(.g-blk)");

    // Gets the organic element with the smallest height. We are assuming the smallest height element will be
    // the most basic organic result.
    const minHeight = 9999;
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
function generateReplacementResult(header: string, link: string, description: string, cite: string, citeSpan: string) {
    let replacementSER = getCreatedTemplateSER();
    if (!replacementSER) replacementSER = getDefaultTemplateSER();

    replacementSER.querySelector("h3").innerHTML = header;
    replacementSER.querySelector("a").href = link;
    replacementSER.querySelector("div > span").innerHTML = description;
    replacementSER.querySelector("cite").prepend(document.createTextNode(cite));
    replacementSER.querySelector("cite > span").innerHTML = citeSpan;
    return replacementSER;
}

/**
 * @returns the main link for a self preferenced result (e.g., the "More Places" button link) if it can be found.
 * Otherwise, null.
 */
function getLink(element: Element): string {
    let link = null;
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
    [type: string]: Element[]
} {

    const selfPreferencedResults = {};
    for (const selfPreferencedResultType in selfPreferencedResultMetadata) {
        selfPreferencedResults[selfPreferencedResultType] = selfPreferencedResultMetadata[selfPreferencedResultType].getResults();
    }

    if (noRepeats) {
        // Filter out the results that have previously been returned by this function.
        for (const selfPreferencedResultType in selfPreferencedResults) {
            selfPreferencedResults[selfPreferencedResultType] = selfPreferencedResults[selfPreferencedResultType].filter(element => {
                return !element.classList.contains(trackedElementClass);
            });
        }

        // Add trackedElementClass to the results that will be returned by this function call so that they can be identified
        // on subsequent calls to this function.
        for (const selfPreferencedResultType in selfPreferencedResults) {
            const elements = selfPreferencedResults[selfPreferencedResultType];
            for (const element of elements) {
                element.classList.add(trackedElementClass);
            }
        }
    }

    return selfPreferencedResults;
}

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
        [type: string]: Element[]
    } = getSelfPreferencedElements(true);

    // Get details of all self preferenced results
    for (const selfPreferencedResultType in selfPreferencedResults) {
        const elements = selfPreferencedResults[selfPreferencedResultType];
        for (const element of elements) {
            removedSelfPreferencedElementDetails.push({
                TopHeight: getElementTopHeight(element),
                BottomHeight: getElementBottomHeight(element),
                Type: selfPreferencedResultType
            });
        }
    }

    // Remove all self preferenced results
    // This is in separate loop from the one above that gets the details so that
    // any removal will not affect the heights
    for (const selfPreferencedResultType in selfPreferencedResults) {
        const elements = selfPreferencedResults[selfPreferencedResultType];
        for (const element of elements) {
            (element as any).style.setProperty("display", "none");
        }
    }

    return removedSelfPreferencedElementDetails;
}

/**
 * @returns {string} An object containing an array of the details of the self preferenced results on the page and an array of
 * the self preferenced results.
 */
export function getSelfPreferencedDetailsAndElements(): { selfPreferencedElementDetails: SelfPreferencedDetail[], selfPreferencedElements: Element[] } {

    const selfPreferencedResults: {
        [type: string]: Element[]
    } = getSelfPreferencedElements(false);

    const selfPreferencedElementDetails: SelfPreferencedDetail[] = [];
    const selfPreferencedElements: Element[] = [];

    for (const selfPreferencedResultType in selfPreferencedResults) {
        const elements = selfPreferencedResults[selfPreferencedResultType];
        for (const element of elements) {
            selfPreferencedElements.push(element);
            selfPreferencedElementDetails.push({
                TopHeight: getElementTopHeight(element),
                BottomHeight: getElementBottomHeight(element),
                Type: selfPreferencedResultType
            });
        }
    }

    return { selfPreferencedElementDetails, selfPreferencedElements };
}

const replacedSelfPreferencedElementsAndType: { selfPreferencedType: string, selfPreferencedElement: Element }[] = [];

/**
 * Replaces the self preferenced results on the page that are for a Google service and removes
 * the other self preferenced results for which Google does not have its own service (weather and lyrics).
 * @returns {string} An object containing:
 *      1) An array of the details of the replacement results created and of the self preferenced results that were
 *         removed without replacement
 *      2) An array of the replacement results that have been created.
 * the self preferenced results.
 */
export function replaceSelfPreferenced(): { selfPreferencedElementDetails: SelfPreferencedDetail[], selfPreferencedElements: Element[] } {
    const selfPreferencedResults: {
        [type: string]: Element[]
    } = getSelfPreferencedElements(true);


    const lyricAndWeatherResults: {
        [type: string]: Element[]
    } = {};
    const selfPreferencedResultsToReplace: {
        [type: string]: Element[]
    } = {};

    // Get all the lyrics and weather results, which will be removed because Google does not
    // have a competing service, and all the other tracked self preferenced results, which will
    // be replaced.
    for (const selfPreferencedResultType in selfPreferencedResults) {
        if (['lyric', 'weather'].includes(selfPreferencedResultType)) {
            lyricAndWeatherResults[selfPreferencedResultType] = selfPreferencedResults[selfPreferencedResultType];
        } else {
            selfPreferencedResultsToReplace[selfPreferencedResultType] = selfPreferencedResults[selfPreferencedResultType];
        }
    }

    // Get the details of all the lyrics and weather results.
    for (const lyricAndWeatherResultType in lyricAndWeatherResults) {
        const elements = lyricAndWeatherResults[lyricAndWeatherResultType];
        for (const element of elements) {
            removedSelfPreferencedElementDetails.push({
                TopHeight: getElementTopHeight(element),
                BottomHeight: getElementBottomHeight(element),
                Type: lyricAndWeatherResultType
            });
        }
    }

    // Remove all the lyrics and weather results.
    for (const lyricAndWeatherResultType in lyricAndWeatherResults) {
        const elements = lyricAndWeatherResults[lyricAndWeatherResultType];
        for (const element of elements) {
            (element as any).style.setProperty("display", "none");
        }
    }

    // Creates the replacement results and removes the self preferenced results they are replacing.
    for (const typeOfSelfPreferencedResultToReplace in selfPreferencedResultsToReplace) {
        for (const selfPreferencedResultToReplace of selfPreferencedResultsToReplace[typeOfSelfPreferencedResultToReplace]) {
            const replacementData = typeOfSelfPreferencedResultToReplace === "flight" ?
                getFlightReplacementData(selfPreferencedResultToReplace) :
                getReplacementData(selfPreferencedResultToReplace, typeOfSelfPreferencedResultToReplace);

            const replacementResult = generateReplacementResult(replacementData.header, replacementData.link, replacementData.description, replacementData.cite, replacementData.citeSpan);

            selfPreferencedResultToReplace.parentElement.insertBefore(replacementResult, selfPreferencedResultToReplace);
            (selfPreferencedResultToReplace as any).style.setProperty("display", "none");

            replacedSelfPreferencedElementsAndType.push({
                selfPreferencedType: typeOfSelfPreferencedResultToReplace,
                selfPreferencedElement: replacementResult,
            })
        }
    }


    const replacedSelfPreferencedElements: Element[] = [];
    const replacedSelfPreferencedElementDetails: SelfPreferencedDetail[] = [];

    // Gets the details of the newly added replacement results
    for (const { selfPreferencedType, selfPreferencedElement } of replacedSelfPreferencedElementsAndType) {
        replacedSelfPreferencedElementDetails.push({
            TopHeight: getElementTopHeight(selfPreferencedElement),
            BottomHeight: getElementBottomHeight(selfPreferencedElement),
            Type: selfPreferencedType
        });
        replacedSelfPreferencedElements.push(selfPreferencedElement);
    }

    return {
        selfPreferencedElementDetails: replacedSelfPreferencedElementDetails.concat(removedSelfPreferencedElementDetails), selfPreferencedElements: replacedSelfPreferencedElements
    };
}
