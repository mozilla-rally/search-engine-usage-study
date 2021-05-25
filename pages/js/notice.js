const engineDetails = {
    DuckDuckGo: "DuckDuckGo doesn't collect or share any of your personal information.",
    Google: "Google is the world's most used search engine.",
    Bing: "Bing is fast, accurate, and private search from Microsoft.",
    Yahoo: "Yahoo connects people with the things they love.",
}

window.addEventListener("DOMContentLoaded", function () {
    let totalAttentionTime = 0;
    let previousAttentionStart = 0;
    let pageHasAttention = false;
    if(!document.hidden) {
        pageHasAttention = true;
        previousAttentionStart = performance.now()
    }
    function getAttentionTime() {
        if(pageHasAttention) {
            return totalAttentionTime + (performance.now() - previousAttentionStart);
        }
        else {
            return totalAttentionTime;
        }
    }

    browser.runtime.onMessage.addListener(message => {
        if(message.type === "webScience.pageManager.pageAttentionUpdate") {
            pageHasAttention = message.pageHasAttention
            if(pageHasAttention) {
                previousAttentionStart = performance.now()
            } else {
                totalAttentionTime = totalAttentionTime + (performance.now() - previousAttentionStart)
            }
        }
    });

    let revert = false;
    const revertButton = document.getElementById("revert");
    if(revertButton) {
        revertButton.addEventListener("click", () => {
            revert = true;
            window.close();
        });
    }

    browser.runtime.sendMessage({ type: "NoticeDetails" }).then(
        response => {
            if(response.originalEngine && response.newEngine) {
                document.getElementById("engine_change").textContent = ` from ${response.originalEngine} to ${response.newEngine}`

                if(response.newEngine in engineDetails) {
                    document.getElementById('engine-info').style.display = null;
                    document.getElementById("engine-description").textContent = engineDetails[ response.newEngine ];

                    const logo = document.getElementById("notice-logo")
                    logo.src = `logos/${response.newEngine.toLowerCase()}.png`
                    logo.alt = `${response.newEngine} logo`
                }
            }

            if(response.homepageChange) {
                const revertDescription = document.getElementById("revert_plural");
                if(revertDescription) revertDescription.textContent = "these changes"

                const homepageChangeNotification = document.getElementById("homepage_change");
                if(homepageChangeNotification) homepageChangeNotification.style.display = null;
            }
        },
        error => {
            console.error(`Error: ${error}`);
        });

    window.addEventListener("unload", (_event) => {
        browser.runtime.sendMessage({ type: "NoticeResponse", revert: revert, attentionTime: getAttentionTime() });
    });
});
