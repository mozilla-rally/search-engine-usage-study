/**
 * Content Scripts for Ask SERP
 */

(async function () {
    const id = randomStringID(10);
    const bodyObserver = new MutationObserver(_mutations => {
        reportAds();
        const adBlocks = document.querySelectorAll("#adBlock");

        adBlockObserver.disconnect();
        for (let i = 0; i < adBlocks.length; i++) {
            adBlockObserver.observe(adBlocks[i], { childList: true });
        }
    });

    const adBlockObserver = new MutationObserver(_mutations => {
        reportAds();
    });

    window.addEventListener("load", function () {
        reportAds();
        bodyObserver.observe(document.body, { childList: true });
    });

    function reportAds() {
        const adResults = getAds();
        const count = adResults.length
        parent.postMessage({
            type: "numAds",
            numAds: count,
            frameID: id,
        }, "*");
        addElementsAndListeners(adResults);
    }

    function randomStringID(length) {
        const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz".split("");

        let str = "";
        for (let i = 0; i < length; i++) {
            str += chars[Math.floor(Math.random() * chars.length)];
        }
        return str;
    }

    function getAds() {
        const adList: Element[] = []
        const adBlocks = document.querySelectorAll("#adBlock");
        for (let i = 0; i < adBlocks.length; i++) {
            const adBlock = adBlocks[i] as HTMLElement;
            if (adBlock && adBlock.style.flexDirection === "row") {
                adList.push(adBlock)
            } else {
                for (const adBlockChild of adBlock.children) {
                    if ((adBlockChild as HTMLElement).offsetParent) {
                        adList.push((adBlockChild as HTMLElement))
                    }
                }
            }
        }
        return adList.concat(Array.from(document.querySelectorAll("#google_image_div")))
    }

    const adLinksWithListeners = []

    function addElementsAndListeners(
        adResults: Element[]) {
        // Removes any existing listeners from ad elements that we previously added
        for (const adLinkWithListeners of adLinksWithListeners) {
            adLinkWithListeners.element.removeEventListener("click", adLinkWithListeners.clickListener);
        }

        // For each ad element, adds mousedown and click listeners to any elements with an href attribute
        // Also adds the listeners to a list so that we can later remove them if we want to refresh these listeners  
        for (const adResult of adResults) {
            adResult.querySelectorAll("[href]").forEach(adLinkElement => {

                function adClickListener(event: MouseEvent) {
                    if (!(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) {
                        parent.postMessage({
                            type: "adClick",
                        }, "*");
                    }
                }

                adLinkElement.addEventListener("click", adClickListener);
                adLinksWithListeners.push({ element: adLinkElement, clickListener: adClickListener })
            });
        }
    }

})()