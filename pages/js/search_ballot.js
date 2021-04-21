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

    let see_more_clicked = false
    const details_expanded_set = new Set()

    function shuffleArray(array, ordering) {
        for(let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ array[ i ], array[ j ] ] = [ array[ j ], array[ i ] ];
            [ ordering[ i ], ordering[ j ] ] = [ ordering[ j ], ordering[ i ] ];
        }
    }

    const searchEnginesContainer = document.querySelector(".search-engines")
    const engines = Array.from(searchEnginesContainer.children)
    const engines_ordering = []

    for(const engine of engines) {
        engines_ordering.push(engine.className)
    }
    shuffleArray(engines, engines_ordering)
    searchEnginesContainer.innerHTML = "";

    const initialEngines = engines.slice(0, 4)
    const moreEngines = engines.slice(4)

    for(const engine of initialEngines) {
        searchEnginesContainer.append(engine)
    }

    const moreSearchEnginesContainer = document.querySelector(".search-engines-more")
    if(moreEngines.length && moreSearchEnginesContainer) {
        for(const engine of moreEngines) {
            moreSearchEnginesContainer.append(engine)
        }
    }

    // TODO: async here necessary?
    document.querySelector(".continue").addEventListener("click", async () => {
        const selected_engine = document.querySelector("input[name=engine-select]:checked").value
        await browser.runtime.sendMessage({ type: "SearchBallotResponse", engine: selected_engine, engines_ordering: engines_ordering, see_more_clicked: see_more_clicked, attentionTime: getAttentionTime(), details_expanded: Array.from(details_expanded_set) });
        window.close();
    });

    document.querySelectorAll("input").forEach(inputElement => {
        inputElement.addEventListener("click", () => {
            document.querySelector(".footer").style.display = ""
            document.querySelector(".wrapper").style.marginBottom = "120px"
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
