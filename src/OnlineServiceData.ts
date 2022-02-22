/**
 * This object contains information for tracking online services and determining
 * completed transactions.
 */
export const onlineServicesMetadata: {
  // The name of the online service.
  serviceName: string,
  // The domain of the service used to create a match pattern for navigation tracking. Each element
  // should have either a domain or a matchPatterns property.
  domain?: string,
  // Match patterns for navigation tracking. Each element should have either a domain or a
  // matchPatterns property.
  matchPatterns?: string[],
  // A string that identifies a completed transaction confirmation page URL.
  confirmationIncludesString?: string,
  // An array of strings that identify the referrer URL for a completed transaction confirmation page.
  confirmationReferrerIncludesStringArray?: string[],

}[] = [
    {
      serviceName: "Agoda",
      domain: "agoda.com",
      // https://www.agoda.com/thankyou/?bookingId=XXXXXXXXX
      confirmationIncludesString: "/thankyou",
    },
    {
      serviceName: "Booking.Com",
      domain: "booking.com",
      // https://secure.booking.com/confirmation.html?aid=XXX...
      confirmationIncludesString: "/confirmation.html",
    },
    {
      serviceName: "Choice Hotels",
      domain: "choicehotels.com",
      // https://www.choicehotels.com/confirmation
      confirmationIncludesString: "/confirmation",
    },
    {
      serviceName: "Expedia",
      domain: "expedia.com",
      // https://expedia.com/HotelBookingConfirmation
      // https://expedia.com/Checkout/V1/MultiItemBookingConfirmation
      confirmationIncludesString: "Confirmation",
    },
    {
      serviceName: "Hotels.com",
      domain: "hotels.com",
      // https://hotels.com/booking/confirmation.html
      confirmationIncludesString: "/confirmation.html",
    },
    {
      serviceName: "Hotwire",
      domain: "hotwire.com",
      // https://vacation.hotwire.com/Checkout/V1/HotelBookingConfirmation?tripid=XXX...
      confirmationIncludesString: "/Confirmation",
    },
    {
      serviceName: "Kayak",
      domain: "kayak.com",
      // Does not handle bookings
    },
    {
      serviceName: "Orbitz",
      domain: "orbitz.com",
      // https://orbitz.com/Checkout/V1/MultiItemBookingConfirmation
      // https://orbitz.com/Checkout/V1/HotelBookingConfirmation
      confirmationIncludesString: "Confirmation",
    },
    {
      serviceName: "Priceline",
      domain: "priceline.com",
      // Referrer: https://www.priceline.com/cart/checkout/usp/fly/XXX...
      // Flight: https://www.priceline.com/travel-itinerary/?offertoken=XXX...&accepted=y&vrid=XXX...
      // Referrer: https://www.priceline.com/cart/checkout/retail/2022-05-17/2022-05-18/1/XXX/XXX.../single?adultocc=2&country-code=US&covid=true&currency-code=USD&tax-display-mode=false&vrid=XXX...
      // Hotel: https://www.priceline.com/travel-itinerary/?offertoken=XXX...&accepted=y&vrid=XXX...
      confirmationIncludesString: "/travel-itinerary/",
      confirmationReferrerIncludesStringArray: ["/cart/checkout"],
    },
    {
      serviceName: "Skyscanner",
      domain: "skyscanner.com",
      // https://www.skyscanner.com/hotels/book/XXXXXXXXX/d_ct/checkout/XXXXXXXXX/XXX...?adults=2&bookingData=XXX...&checkin=2022-06-15&checkout=2022-06-16&impression_id=XXX...&localCurrency=USD&paymentCode=XXX...&priceAmount=155&priceCurrency=USD&requestId=XXX...&rooms=1&searchCycleId=XXX...&searchEntityId=XXXXXXXX&stack=last
      confirmationIncludesString: "/checkout",
    },
    {
      serviceName: "Travelocity",
      domain: "travelocity.com",
      // https://travelocity.com/Checkout/V1/HotelBookingConfirmation
      confirmationIncludesString: "Confirmation",
    },
    {
      serviceName: "Tripadvisor",
      domain: "tripadvisor.com",
      // Does not handle bookings
    },
    {
      serviceName: "Trivago",
      domain: "trivago.com",
      // Does not handle bookings, is owned by Expedia and transfers to expedia.com for hotel bookings
    },

    {
      serviceName: "Yelp",
      domain: "yelp.com",
      // Does not handle bookings
    },

    {
      serviceName: "Alaska Airlines",
      domain: "alaskaair.com",
      // Referrer: https://www.alaskaair.com/Booking/Seats/SelectSeats or https://www.alaskaair.com/booking/travelers
      // https://www.alaskaair.com/booking/payment
      confirmationIncludesString: "/booking/payment",
      confirmationReferrerIncludesStringArray: ["/Booking/Seats/SelectSeats", "/booking/travelers"],
    },
    {
      serviceName: "Allegiant",
      domain: "allegiantair.com",
      // https://www.allegiantair.com/booking/XXX.../confirmation
      confirmationIncludesString: "/confirmation",
    },
    {
      serviceName: "American",
      domain: "aa.com",
      // https://www.aa.com/booking/confirm?uuid=XXX...&cid=XXX...
      confirmationIncludesString: "/confirm",
    },
    {
      serviceName: "Delta",
      domain: "delta.com",
      // https://www.delta.com/complete-purchase/confirmation?cacheKeySuffix=XXX...&cartId=XXX...
      confirmationIncludesString: "/confirmation",
    },
    {
      serviceName: "Frontier",
      domain: "flyfrontier.com",
      // Referrer: https://booking.flyfrontier.com/Payment/New
      // https://booking.flyfrontier.com/Booking/Index
      confirmationIncludesString: "/Booking/Index",
      confirmationReferrerIncludesStringArray: ["/Payment/New"],
    },
    {
      serviceName: "Hawaiian",
      domain: "hawaiianairlines.com",
      // https://www.hawaiianairlines.com/book/Confirmation
      confirmationIncludesString: "/Confirmation",
    },
    {
      serviceName: "Jet Blue",
      domain: "jetblue.com",
      // https://www.jetblue.com/booking/confirmation
      confirmationIncludesString: "/confirmation",
    },
    {
      serviceName: "Southwest",
      domain: "southwest.com",
      // https://www.southwest.com/air/booking/confirmation.html
      confirmationIncludesString: "/confirmation.html",
    },
    {
      serviceName: "Spirit",
      domain: "spirit.com",
      // https://www.spirit.com/book/confirmation
      confirmationIncludesString: "/confirmation",
    },
    {
      serviceName: "United",
      domain: "united.com",
      // https://www.united.com/ual/en/US/flight-search/book-a-flight/confirmation/rev?CartId=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
      confirmationIncludesString: "/confirmation",
    },

    {
      serviceName: "Hilton",
      domain: "hilton.com",
      // https://www.hilton.com/en/book/reservation/confirmation/
      confirmationIncludesString: "/confirmation",
    },
    {
      serviceName: "Hyatt",
      domain: "hyatt.com",
      // https://www.hyatt.com/en-US/book/confirm/XXX...
      confirmationIncludesString: "/confirm",
    },
    {
      serviceName: "IHG",
      domain: "ihg.com",
      // https://www.ihg.com/hotels/us/en/pay/confirmation?confirmationNumber=XXXXXXXX&lastName=Kandula
      // https://www.ihg.com/holidayinn/hotels/us/en/pay/confirmation?confirmationNumber=XXXXXXXX&lastName=Kandula
      confirmationIncludesString: "/confirmation",
    },
    {
      serviceName: "Marriott",
      domain: "marriott.com",
      // https://www.marriott.com/reservation/confirmation.mi
      confirmationIncludesString: "/confirmation.mi",
    },
    {
      serviceName: "Wyndham",
      domain: "wyndhamhotels.com",
      // https://www.wyndhamhotels.com/wyndham-garden/reservation/confirm
      // https://www.wyndhamhotels.com/dolce/reservation/confirm
      confirmationIncludesString: "/confirm",
    },

    {
      serviceName: "AZLyrics",
      domain: "azlyrics.com",
    },
    {
      serviceName: "Genius",
      domain: "genius.com",
    },
    {
      serviceName: "Lyrics.com",
      domain: "lyrics.com",
    },
    {
      serviceName: "Musixmatch",
      domain: "musixmatch.com",
    },
    {
      serviceName: "SongLyrics",
      domain: "songlyrics.com",
    },

    {
      serviceName: "AccuWeather",
      domain: "accuweather.com",
    },
    {
      serviceName: "National Weather Service",
      domain: "weather.gov",
    },
    {
      serviceName: "Weather Channel",
      domain: "weather.com",
    },
    {
      serviceName: "WeatherBug",
      domain: "weatherbug.com",
    },
    {
      serviceName: "Weather Underground",
      domain: "wunderground.com",
    },
    {
      serviceName: "Windy",
      domain: "windy.com",
    },

    {
      serviceName: "Amazon",
      domain: "amazon.com",
    },
    {
      serviceName: "Apple",
      domain: "apple.com",
    },
    {
      serviceName: "BestBuy",
      domain: "bestbuy.com",
    },
    {
      serviceName: "Costco",
      domain: "costco.com",
    },
    {
      serviceName: "eBay",
      domain: "ebay.com",
    },
    {
      serviceName: "Etsy",
      domain: "etsy.com",
    },
    {
      serviceName: "HomeDepot",
      domain: "homedepot.com",
    },
    {
      serviceName: "Kroger",
      domain: "kroger.com",
    },
    {
      serviceName: "Lowes",
      domain: "Lowes.com",
    },
    {
      serviceName: "Target",
      domain: "target.com",
    },
    {
      serviceName: "Walmart",
      domain: "walmart.com",
    },
    {
      serviceName: "Wayfair",
      domain: "wayfair.com",
    },

    {
      serviceName: "GoogleMaps",
      matchPatterns: ["*://*.google.com/maps*", "*://*.maps.google.com/*"],
    },
    {
      serviceName: "GoogleTravel",
      matchPatterns: ["*://*.google.com/travel*", "*://*.google.com/flights*", "*://*.google.com/hotels*"],
    },
    {
      serviceName: "YouTube",
      domain: "youtube.com",
    },
  ]

/**
 * This object matches service types to a regular expression string for identifying
 * navigational queries.
 */
export const navigationalQueryData: {
  name: string;
  matchTerms: string[];
}[] = [
    {
      name: "Airline",
      matchTerms: [
        "alaska air",
        "allegiant",
        "aa.com", "american",
        "delta",
        "frontier",
        "hawaiian",
        "jetblue", "jet blue",
        "southwest", "south west",
        "spirit",
        "united"
      ]
    },
    {
      name: "Hotel",
      matchTerms: [
        "hilton", "waldorf astoria", "hampton inn", "doubletree",
        "hyatt",
        "ihg", "holiday inn", "intercontinental",
        "marriott", "ritz carlton", "ritz-carlton", "sheraton", "westin", "fairfield inn", "residence inn",
        "wyndham", "dolce hotels"
      ]
    },
    {
      name: "OtherTravel",
      matchTerms: [
        "agoda",
        "booking.com",
        "choicehotels", "choice hotels",
        "expedia",
        "hotels.com",
        "kayak",
        "orbitz",
        "priceline", "price line",
        "skyscanner",
        "travelocity",
        "tripadvisor", "trip advisor",
        "trivago"
      ]
    },
    {
      name: "RestaurantAndBusiness",
      matchTerms: [
        "yelp"
      ]
    },
    {
      name: "Lyrics",
      matchTerms: [
        "azlyrics", "az lyrics",
        "genius",
        "lyrics.com",
        "musixmatch", "musix match", "musicmatch", "music match",
        "songlyrics"
      ]
    },
    {
      name: "Weather",
      matchTerms: [
        "accu weather", "accuweather",
        "weather.gov", "national weather service",
        "weather.com", "weather channel",
        "weather bug", "weatherbug",
        "wunderground", "weather underground", "weatherunderground",
        "windy"
      ]
    },
    {
      name: "Google",
      matchTerms: [
        "google",
        "youtube"
      ]
    }
  ]
