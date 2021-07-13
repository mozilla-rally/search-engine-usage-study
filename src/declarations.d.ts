declare module "@mozilla/web-science";
declare const browser;
declare let webScience: {
    pageManager: {
        pageId,
        url,
        referrer,
        isHistoryChange,
        webNavigationTimeStamp,
        onPageVisitStart,
        onPageVisitStop,
        onPageAttentionUpdate,
        onPageAudioUpdate,
        pageHasAttention,
        pageHasAudio,
        pageVisitStarted,
        pageVisitStartTime,
        sendMessage,
    }
}

declare const __ENABLE_DEVELOPER_MODE__;