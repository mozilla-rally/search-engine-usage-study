import { getXPathElement, getXPathElements } from "./common.js";

const replacementSERPData: {
    [type: string]: {
        defaultHeader: string;
        headerXpath: string;
        headerTail: string;
        defaultLink: string;
        description: string;
        cite: string;
        citeSpan: string;
    }
} = {
    thingsToDo: {
        defaultHeader: "Things to do - Google",
        headerXpath: "//*[@role='heading' and starts-with(text(), 'Top sights in')]",
        headerTail: " | Google Travel",
        defaultLink: "https://www.google.com/travel/things-to-do",
        description: "Plan your trip with Google. Find flights, hotels, vacation rentals, things to do, and more.",
        cite: "https://www.google.com",
        citeSpan: " › travel › things-to-do",
    },
    vacationRental: {
        defaultHeader: "Google Hotel Search",
        headerXpath: "//*[@role='heading' and starts-with(text(), 'Vacation Rentals |')]",
        headerTail: " - Google Vacation Rentals",
        defaultLink: "https://www.google.com/travel/hotels",
        description: "Plan your trip with Google. Find flights, hotels, vacation rentals, things to do, and more.",
        cite: "https://www.google.com",
        citeSpan: " › travel › hotels",
    },
    hotel: {
        defaultHeader: "Google Hotel Search",
        headerXpath: "//*[@role='heading' and starts-with(text(), 'Hotels |')]",
        headerTail: " - Google Hotels",
        defaultLink: "https://www.google.com/travel/hotels",
        description: "Find a place to stay quickly and easily. Browse hotel photos and reviews, compare rates and availability, and book a room on Google Hotel Search.",
        cite: "https://www.google.com",
        citeSpan: " › travel › hotels",
    },
    map: {
        defaultHeader: "Google Maps",
        headerXpath: "//*[starts-with(@aria-label, 'Location Results')]",
        headerTail: " - Google Maps",
        defaultLink: "https://www.google.com/maps",
        description: "Find local businesses, view maps and get driving directions in Google Maps.",
        cite: "https://maps.google.com",
        citeSpan: "",
    },
    flight: {
        defaultHeader: "Google Flights",
        headerXpath: "//*[starts-with(@aria-label, 'Location Results')]",
        headerTail: " - Google Flights",
        defaultLink: "https://www.google.com/travel/flights",
        description: "Find the best flights fast, track prices, and book with confidence.",
        cite: "https://www.google.com",
        citeSpan: " › travel › flights",
    }
}

function generateReplacementResult(header: string, link: string, description: string, cite: string, citeSpan: string) {
    const replacementSER = document.createElement('div');
    replacementSER.classList.add('g');
    replacementSER.innerHTML = `
    <div>
        <div class="tF2Cxc">
            <div class="yuRUbf">
                <a href="">
                    <br>
                    <h3 class="LC20lb DKV0Md"></h3>
                    <div class="TbwUpd NJjxre">
                        <cite class="iUh30 Zu0yb qLRx3b tjvcx">
                            <span class="dyjrff qzEoUe"></span>
                        </cite>
                    </div>
                </a>
            </div>
            <div class="IsZvec">
                <div class="VwiC3b yXK7lf MUxGbd yDYNvb lyLwlc lEBKkf" style="-webkit-line-clamp:2"><span></span></div>
            </div>
        </div>
    </div>
`;

    replacementSER.querySelector("h3").innerHTML = header;
    replacementSER.querySelector("a").href = link;
    replacementSER.querySelector("div > span").innerHTML = description;
    replacementSER.querySelector("cite").prepend(document.createTextNode(cite));
    replacementSER.querySelector("cite > span").innerHTML = citeSpan;
    return replacementSER;
}

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

function getThingsToDoResults(): Element[] {
    return getXPathElements("//*[@id='rso']/*[descendant::*[@role='heading' and starts-with(text(), 'Top sights in')]]");
}


function getMapResults(): Element[] {
    const mapResultsType1 = getXPathElements("//*[@id='rso']/*[descendant::*[starts-with(@aria-label, 'Location Results')]]");

    // Map results that do not show up at top of page. Search "malls in new york" for example
    const mapResultsType2 = getXPathElements("//*[@id='rcnt']/div/div[descendant::*[starts-with(@aria-label, 'Location Results')]]");

    return mapResultsType1.concat(mapResultsType2);
}

function getWeatherResults(): Element[] {
    return getXPathElements("//*[@id='rso']/*[descendant::h2[text()='Weather Result']]")
}

function getLyricResults(): Element[] {
    let lyricsElements: Element[] = Array.from(document.querySelectorAll("[aria-label='Lyrics']"));

    if (!document.querySelector("[id^='kp-wp-tab']")) {
        lyricsElements = lyricsElements.concat(getXPathElements("//*[@id='rso']/*[descendant::*[@data-lyricid]]"));
    }

    return lyricsElements;
}

function getHotelResults(): Element[] {
    return getXPathElements("//*[@id='rso']/*[descendant::*[@role='heading' and starts-with(text(), 'Hotels |')]]");
}

function getVacationRentalResults(): Element[] {
    return getXPathElements("//*[@id='rso']/*[descendant::*[@role='heading' and starts-with(text(), 'Vacation Rentals |')]]");
}

function getFlightResults(): Element[] {
    return getXPathElements("//*[@id='rso']/*[descendant::div[@role='button' and descendant::span[text()='Show flights']]]");
}

function getFlightReplacementData(element: Element): ReplacementData {
    let originCity = null;
    try {
        const originValue = (getXPathElement("//*[@placeholder='Enter an origin']", element) as any).value as string;
        originCity = originValue.substring(0, originValue.indexOf(","));
    } catch (error) {
        // Do nothing
    }

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
        header = `Flights from ${originCity} to ${destCity}` + replacementSERPData["flight"].headerTail;
        link = `https://www.google.com/travel/flights/flights-from-${originCity.replace(/ /g, "-")}-to-${destCity.replace(/ /g, "-")}.html`;
    } else if (originCity) {
        header = `Flights from ${originCity}` + replacementSERPData["flight"].headerTail;
        link = `https://www.google.com/travel/flights/flights-from-${originCity.replace(/ /g, "-")}.html`;
    } else if (destCity) {
        header = `Flights to ${destCity}` + replacementSERPData["flight"].headerTail;
        link = `https://www.google.com/travel/flights/flights-to-${destCity.replace(/ /g, "-")}.html`;
    } else {
        link = replacementSERPData["flight"].defaultLink;
        header = replacementSERPData["flight"].defaultHeader;
    }

    let description = null;
    if (destCity) {
        description = `Find the best flights to ${destCity} fast, track prices, and book with confidence.`;
    } else {
        description = replacementSERPData["flight"].description;
    }

    const cite = replacementSERPData["flight"].cite;
    const citeSpan = replacementSERPData["flight"].citeSpan;

    return { header, link, description, cite, citeSpan };
}

function getReplacementData(element, type): ReplacementData {
    const defaultHeader = replacementSERPData[type].defaultHeader;
    let header = null;

    let link = getLink(element);
    if (!link) {
        link = replacementSERPData[type].defaultLink;
        header = defaultHeader
    } else {
        try {
            header = getXPathElement(replacementSERPData[type].headerXpath, element).textContent + replacementSERPData[type].headerTail;
        } catch (error) {
            // Do nothing
        }
    }

    if (!header) header = defaultHeader;
    const description = replacementSERPData[type].description;
    const cite = replacementSERPData[type].cite;
    const citeSpan = replacementSERPData[type].citeSpan;

    return { header, link, description, cite, citeSpan };
}

function getSelfPreferencedResults(): Element[] {
    return [].concat(
        getThingsToDoResults(),
        getHotelResults(),
        getFlightResults(),
        getVacationRentalResults(),
        getMapResults(),
        getLyricResults(),
        getWeatherResults()
    );
}

export function removeSelfPreferencedResults() {
    const selfPreferencedResults: Element[] = getSelfPreferencedResults();
    for (const selfPreferencedResult of selfPreferencedResults) {
        (selfPreferencedResult as any).style.setProperty("display", "none");
    }

    // Remove lyric tabs
    const lyricsTabs = getXPathElements("//span[@role='tab' and descendant::span[text()='Lyrics']]");
    for (const lyricsTab of lyricsTabs) {
        (lyricsTab as any).style.setProperty("display", "none");
    }
}

export function replaceSelfPreferencedResults() {
    // Remove lyrics and weather results because Google does not offer
    // its own service for these to replace with.
    const lyricAndWeatherResults = [].concat(
        getLyricResults(),
        getWeatherResults()
    );
    for (const lyricAndWeatherResult of lyricAndWeatherResults) {
        (lyricAndWeatherResult as any).style.setProperty("display", "none");
    }

    const flightResults = getFlightResults();
    for (const flightResult of flightResults) {
        const replacementData = getFlightReplacementData(flightResult);
        const replacementResult = generateReplacementResult(replacementData.header, replacementData.link, replacementData.description, replacementData.cite, replacementData.citeSpan);

        flightResult.parentElement.insertBefore(replacementResult, flightResult);
        (flightResult as any).style.setProperty("display", "none");
    }

    const otherSelfPreferencedResults: {
        [type: string]: Element[]
    } = {
        thingsToDo: getThingsToDoResults(),
        vacationRental: getVacationRentalResults(),
        hotel: getHotelResults(),
        map: getMapResults(),
    }
    for (const typeOfSelfPreferencedResult in otherSelfPreferencedResults) {
        for (const selfPreferencedResult of otherSelfPreferencedResults[typeOfSelfPreferencedResult]) {
            const replacementData = getReplacementData(selfPreferencedResult, typeOfSelfPreferencedResult);
            const replacementResult = generateReplacementResult(replacementData.header, replacementData.link, replacementData.description, replacementData.cite, replacementData.citeSpan);

            selfPreferencedResult.parentElement.insertBefore(replacementResult, selfPreferencedResult);
            (selfPreferencedResult as any).style.setProperty("display", "none");

        }
    }
}
