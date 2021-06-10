window.addEventListener("DOMContentLoaded", async function () {
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

    let see_more_clicked = false
    const details_expanded_set = new Set()

    function shuffleArray(array) {
        for(let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ array[ i ], array[ j ] ] = [ array[ j ], array[ i ] ];
        }
    }

    const choiceScreenDetails = await browser.runtime.sendMessage({ type: "ChoiceScreenDetails" })
    if(choiceScreenDetails.homepageChange) {
        const homepageChangeNotification = document.getElementById("homepage_change");
        if(homepageChangeNotification) homepageChangeNotification.style.display = null;
    }



    const engineContainers = document.querySelectorAll(".search-engines > div");
    const engineNames = []
    const engineNameToContainerDict = {}
    for(const engineContainer of engineContainers) {
        engineNames.push(engineContainer.className)
        engineNameToContainerDict[ engineContainer.className ] = engineContainer
    }

    let engines_ordering = []
    if(choiceScreenDetails.engines_ordering) {
        engines_ordering = choiceScreenDetails.engines_ordering
    } else {
        shuffleArray(engineNames)
        engines_ordering = engineNames
        browser.runtime.sendMessage({ type: "ChoiceScreenEngineOrdering", engines_ordering });
    }

    const searchEnginesContainer = document.querySelector(".search-engines")
    searchEnginesContainer.innerHTML = "";

    const randomizedOrderEngineContainers = []
    for(const engine of engines_ordering) {
        if(engine in engineNameToContainerDict) {
            randomizedOrderEngineContainers.push(engineNameToContainerDict[ engine ])
        }
    }

    const initialEngines = randomizedOrderEngineContainers.slice(0, 4)
    const moreEngines = randomizedOrderEngineContainers.slice(4)

    for(const engine of initialEngines) {
        searchEnginesContainer.append(engine)
    }

    const moreSearchEnginesContainer = document.querySelector(".search-engines-more")
    if(moreEngines.length && moreSearchEnginesContainer) {
        for(const engine of moreEngines) {
            moreSearchEnginesContainer.append(engine)
        }
    }

    document.querySelector(".continue").addEventListener("click", async () => {
        const selected_engine = document.querySelector("input[name=engine-select]:checked").value
        await browser.runtime.sendMessage({ type: "ChoiceScreenResponse", engine: selected_engine, engines_ordering, see_more_clicked, attentionTime: getAttentionTime(), details_expanded: Array.from(details_expanded_set) });
        window.close();
    });

    function enableContinue() {
        document.querySelector(".continue").removeAttribute("disabled");
        document.querySelector(".wrapper").style.marginBottom = "120px";
    }

    if(document.querySelector("input[name=engine-select]:checked")) {
        enableContinue();
    }
    document.querySelectorAll("input").forEach(inputElement => {
        inputElement.addEventListener("click", () => {
            enableContinue();
        });
    })

    document.querySelectorAll(".rotate").forEach(rotateElement => {
        rotateElement.addEventListener("click", (event) => {
            event.currentTarget.classList.toggle("down")

            details_expanded_set.add(event.currentTarget.parentNode.parentNode.parentNode.parentNode.className)

            // Toggle this window open/close
            const textBox = event.currentTarget.parentNode.parentNode.previousElementSibling.children[ 1 ]
            textBox.classList.toggle("showing")
            textBox.classList.toggle("hiding")
        });
    })

    document.querySelectorAll(".see-more").forEach(seeMoreElement => {
        seeMoreElement.addEventListener("click", () => {
            see_more_clicked = true
            document.querySelector(".search-engines-more").classList.remove("hiding")
            document.querySelector(".see-more-container").classList.add("hiding")
        });
    })
});
