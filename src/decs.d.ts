declare module "@mozilla/web-science";
declare const browser;
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