declare let webScience: {
  pageManager: {
    pageId,
    url,
    referrer,
    onPageVisitStart,
    onPageVisitStop,
    onPageAttentionUpdate,
    onPageAudioUpdate,
    pageHasAttention,
    pageHasAudio,
    pageVisitStarted,
    pageVisitStartTime
  }
}

interface Window {
  webScience,
  pageManagerHasLoaded: any;
}
