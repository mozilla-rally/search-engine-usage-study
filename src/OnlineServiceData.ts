/**
 * This object contains information for tracking online services and determining
 * completed transactions.
 */
export const onlineServicesMetadata: {
  // The name of the online service.
  [serviceName: string]: {
    // The domain of the service used to create a match pattern for navigation tracking. Each element
    // should have either a domain or a matchPatterns property.
    domain?: string,
    // Match patterns for navigation tracking. Each element should have either a domain or a
    // matchPatterns property.
    matchPatterns?: string[],
    // A string that identifies a completed transaction confirmation page URL.
    confirmationIncludesString?: string,
    // A string that identifies the referrer URL for a completed transaction confirmation page.
    confirmationReferrerIncludesStringArray?: string[],
  }
} = {
  // https://www.agoda.com/thankyou/?bookingId=XXXXXXXXX
  Agoda: {
    domain: "agoda.com",
    confirmationIncludesString: "/thankyou",
  },
  // https://secure.booking.com/confirmation.html?aid=XXX...
  BookingCom: {
    domain: "booking.com",
    confirmationIncludesString: "/confirmation.html",
  },
  // https://www.choicehotels.com/confirmation
  ChoiceHotels: {
    domain: "choicehotels.com",
    confirmationIncludesString: "/confirmation",
  },
  // https://expedia.com/HotelBookingConfirmation
  // https://expedia.com/Checkout/V1/MultiItemBookingConfirmation
  Expedia: {
    domain: "expedia.com",
    confirmationIncludesString: "Confirmation",
  },
  // https://hotels.com/booking/confirmation.html
  HotelsCom: {
    domain: "hotels.com",
    confirmationIncludesString: "/confirmation.html",
  },
  // https://vacation.hotwire.com/Checkout/V1/HotelBookingConfirmation?tripid=XXX...
  // Does not handle bookings
  Kayak: {
    domain: "kayak.com",
  },
  // https://orbitz.com/Checkout/V1/MultiItemBookingConfirmation
  // https://orbitz.com/Checkout/V1/HotelBookingConfirmation
  Orbitz: {
    domain: "orbitz.com",
    confirmationIncludesString: "Confirmation",
  },
  // Referrer: https://www.priceline.com/cart/checkout/usp/fly/XXX...
  // Flight: https://www.priceline.com/travel-itinerary/?offertoken=XXX...&accepted=y&vrid=XXX...
  // Referrer: https://www.priceline.com/cart/checkout/retail/2022-05-17/2022-05-18/1/XXX/XXX.../single?adultocc=2&country-code=US&covid=true&currency-code=USD&tax-display-mode=false&vrid=XXX...
  // Hotel: https://www.priceline.com/travel-itinerary/?offertoken=XXX...&accepted=y&vrid=XXX...
  Priceline: {
    domain: "priceline.com",
    confirmationIncludesString: "/travel-itinerary/",
    confirmationReferrerIncludesStringArray: ["/cart/checkout"],
  },
  // https://www.skyscanner.com/hotels/book/XXXXXXXXX/d_ct/checkout/XXXXXXXXX/XXX...?adults=2&bookingData=XXX...&checkin=2022-06-15&checkout=2022-06-16&impression_id=XXX...&localCurrency=USD&paymentCode=XXX...&priceAmount=155&priceCurrency=USD&requestId=XXX...&rooms=1&searchCycleId=XXX...&searchEntityId=XXXXXXXX&stack=last
  Skyscanner: {
    domain: "skyscanner.com",
    confirmationIncludesString: "/checkout",
  },
  // https://travelocity.com/Checkout/V1/HotelBookingConfirmation
  Travelocity: {
    domain: "travelocity.com",
    confirmationIncludesString: "Confirmation",
  },
  // Does not handle bookings
  Tripadvisor: {
    domain: "tripadvisor.com",
  },
  // Does not handle bookings, is owned by Expedia and transfers to expedia.com for hotel bookings
  Trivago: {
    domain: "trivago.com",
  },


  // Does not handle bookings
  Yelp: {
    domain: "yelp.com",
  },

  // Referrer: https://www.alaskaair.com/Booking/Seats/SelectSeats or https://www.alaskaair.com/booking/travelers
  // https://www.alaskaair.com/booking/payment
  Alaska: {
    domain: "alaskaair.com",
    confirmationIncludesString: "/booking/payment",
    confirmationReferrerIncludesStringArray: ["/Booking/Seats/SelectSeats", "/booking/travelers"],
  },
  // https://www.allegiantair.com/booking/XXX.../confirmation
  Allegiant: {
    domain: "allegiantair.com",
    confirmationIncludesString: "/confirmation",
  },
  // https://www.aa.com/booking/confirm?uuid=XXX...&cid=XXX...
  American: {
    domain: "aa.com",
    confirmationIncludesString: "/confirm",
  },
  // https://www.delta.com/complete-purchase/confirmation?cacheKeySuffix=XXX...&cartId=XXX...
  Delta: {
    domain: "delta.com",
    confirmationIncludesString: "/confirmation",
  },
  // Referrer: https://booking.flyfrontier.com/Payment/New
  // https://booking.flyfrontier.com/Booking/Index
  Frontier: {
    domain: "flyfrontier.com",
    confirmationIncludesString: "/Booking/Index",
    confirmationReferrerIncludesStringArray: ["/Payment/New"],
  },
  // https://www.hawaiianairlines.com/book/Confirmation
  Hawaiian: {
    domain: "hawaiianairlines.com",
    confirmationIncludesString: "/Confirmation",
  },
  // https://www.jetblue.com/booking/confirmation
  JetBlue: {
    domain: "jetblue.com",
    confirmationIncludesString: "/confirmation",
  },
  // https://www.southwest.com/air/booking/confirmation.html
  Southwest: {
    domain: "southwest.com",
    confirmationIncludesString: "/confirmation.html",
  },
  // https://www.spirit.com/book/confirmation
  Spirit: {
    domain: "spirit.com",
    confirmationIncludesString: "/confirmation",
  },
  // https://www.united.com/ual/en/US/flight-search/book-a-flight/confirmation/rev?CartId=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
  United: {
    domain: "united.com",
    confirmationIncludesString: "/confirmation",
  },

  // https://www.hilton.com/en/book/reservation/confirmation/
  Hilton: {
    domain: "hilton.com",
    confirmationIncludesString: "/confirmation",
  },
  // https://www.hyatt.com/en-US/book/confirm/XXX...
  Hyatt: {
    domain: "hyatt.com",
    confirmationIncludesString: "/confirm",
  },
  // https://www.ihg.com/hotels/us/en/pay/confirmation?confirmationNumber=XXXXXXXX&lastName=Kandula
  // https://www.ihg.com/holidayinn/hotels/us/en/pay/confirmation?confirmationNumber=XXXXXXXX&lastName=Kandula
  IHG: {
    domain: "ihg.com",
    confirmationIncludesString: "/confirmation",
  },
  // https://www.marriott.com/reservation/confirmation.mi
  Marriott: {
    domain: "marriott.com",
    confirmationIncludesString: "/confirmation.mi",
  },
  // https://www.wyndhamhotels.com/wyndham-garden/reservation/confirm
  // https://www.wyndhamhotels.com/dolce/reservation/confirm
  Wyndham: {
    domain: "wyndhamhotels.com",
    confirmationIncludesString: "/confirm",
  },

  AZLyrics: {
    domain: "azlyrics.com",
  },
  Genius: {
    domain: "genius.com",
  },
  LyricsCom: {
    domain: "lyrics.com",
  },
  Musixmatch: {
    domain: "musixmatch.com",
  },
  SongLyrics: {
    domain: "songlyrics.com",
  },

  AccuWeather: {
    domain: "accuweather.com",
  },
  NationalWeatherService: {
    domain: "weather.gov",
  },
  WeatherChannel: {
    domain: "weather.com",
  },
  WeatherBug: {
    domain: "weatherbug.com",
  },
  WeatherUnderground: {
    domain: "wunderground.com",
  },
  Windy: {
    domain: "windy.com",
  },


  GoogleMaps: {
    matchPatterns: ["*://*.google.com/maps*", "*://*.maps.google.com/*"],
  },
  GoogleTravel: {
    matchPatterns: ["*://*.google.com/travel*", "*://*.google.com/flights*", "*://*.google.com/hotels*"],
  },
  YouTube: {
    domain: "youtube.com",
  },
}

/**
 * This object matches service types to a regular expression string for identifying
 * navigational queries.
 */
export const navigationalQueryData: {
  [serviceType: string]: string
} = {
  Airline: "alaska|allegiant|aa.com|american|delta|frontier|hawaiian|jetblue|jet blue|southwest|south west|spirit|united",
  Hotel: 'hilton|hyatt|ihg|marriott|wyndham',
  OtherTravel: "agoda|booking.com|choicehotels|choice hotels|expedia|hotels.com|kayak|orbitz|priceline|price line|skyscanner|travelocity|tripadvisor|trip advisor|trivago",
  RestaurantAndBusiness: "yelp",
  Lyrics: "azlyrics|az lyrics|genius|lyrics.com|musixmatch|musix match|musicmatch|music match|songlyrics",
  Weather: "accu weather|accuweather|weather.gov|national weather service|weather.com|weather channel|weather bug|weatherbug|wunderground|weather underground|weatherunderground|windy",
  Google: "google|youtube"
}
