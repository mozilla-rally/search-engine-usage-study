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
        if(message.type === "WebScience.Utilities.PageManager.pageAttentionUpdate") {
            pageHasAttention = message.pageHasAttention
            if(pageHasAttention) {
                previousAttentionStart = performance.now()
            } else {
                totalAttentionTime = totalAttentionTime + (performance.now() - previousAttentionStart)
            }
        }
    });

    let revert = false;
    document.querySelectorAll(".revert").forEach(revertElement => {
        revertElement.addEventListener("click", () => {
            revert = true;
            window.close();
        });
    })



    function handleResponse(response) {
        if(response.previous && response.current) {
            document.querySelector("#engines_notice").textContent = `Your search engine was changed from ${response.previous} to ${response.current}.`
        }
    }
    function handleError(error) {
        console.error(`Error: ${error}`);
    }

    browser.runtime.sendMessage({ type: "SearchEngineNotice" }).then(handleResponse, handleError);

    window.addEventListener("unload", (event) => {
        browser.runtime.sendMessage({ type: "NoticeResponse", revert: revert, attentionTime: getAttentionTime() });
    });
});

