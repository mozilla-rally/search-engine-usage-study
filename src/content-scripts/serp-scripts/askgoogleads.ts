import { id } from "@mozilla/web-science";

/**
 * Content Scripts for Ask SERP iFrames
 */
(async function () {

    function reportAds() {
        const adResults = getAds();
        const count = adResults.length
        parent.postMessage({
            type: "numAds",
            numAds: count,
            frameID: frameId,
        }, "*");
        addElementsAndListeners(adResults);
    }

    function getAds(): Element[] {
        try {
            const adList: Element[] = []
            const adBlocks = document.querySelectorAll("#adBlock");
            for (let i = 0; i < adBlocks.length; i++) {
                const adBlock = adBlocks[i] as HTMLElement;
                if (adBlock && adBlock.style.flexDirection === "row") {
                    adList.push(adBlock);
                } else {
                    for (const adBlockChild of adBlock.children) {
                        if ((adBlockChild as HTMLElement).offsetParent) {
                            adList.push((adBlockChild as HTMLElement));
                        }
                    }
                }
            }
            return adList.concat(Array.from(document.querySelectorAll("#google_image_div")));
        } catch (error) {
            return [];
        }
    }

    const adLinksWithListeners = []

    function addElementsAndListeners(
        adResults: Element[]) {

        function adClickListener(event: MouseEvent) {
            if (!(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) {
                parent.postMessage({
                    type: "adClick",
                }, "*");
            }
        }

        try {
            // Removes any existing listeners from ad elements that we previously added
            for (const adLinkWithListeners of adLinksWithListeners) {
                adLinkWithListeners.element.removeEventListener("click", adLinkWithListeners.clickListener, true);
            }

            // For each ad element, adds mousedown and click listeners to any elements with an href attribute
            // Also adds the listeners to a list so that we can later remove them if we want to refresh these listeners  
            for (const adResult of adResults) {
                const adLinkElements = adResult.querySelectorAll("[href]");
                for (const adLinkElement of adLinkElements) {
                    adLinkElement.addEventListener("click", adClickListener, true);
                    adLinksWithListeners.push({ element: adLinkElement, clickListener: adClickListener });
                }
            }
        } catch (error) {
            return;
        }
    }

    const frameId = id.generateId();
    const bodyObserver = new MutationObserver(() => {
        reportAds();
    });

    window.addEventListener("load", function () {
        reportAds();
        bodyObserver.observe(document.body, { childList: true });
    });

})()