<script>
    import Entry from "./Entry.svelte";
    export let choiceBallotType;
    let engines = [
        {
            engine: "Google",
            engineDisplayName: "Google",
            description:
                "Find what you need with the world's most used search engine.",
        },
        {
            engine: "DuckDuckGo",
            engineDisplayName: "DuckDuckGo",
            description: "We don’t store your personal information. Ever.",
        },
        {
            engine: "Bing",
            engineDisplayName: "Bing",
            description:
                "Microsoft Bing helps you find trusted search results fast.",
        },
        {
            engine: "Yahoo",
            engineDisplayName: "Yahoo",
            description:
                "Yahoo Search helps you find the information you need.",
        },
        {
            engine: "Yandex",
            engineDisplayName: "Yandex",
            description: "Yandex is the leading search provider in Russia.",
        },
        {
            engine: "Baidu",
            engineDisplayName: "Baidu",
            description:
                "Baidu is the main portal to Chinese information and services.",
        },
        {
            engine: "Ecosia",
            engineDisplayName: "Ecosia",
            description:
                "Your searches plant trees in some of the harshest places on Earth.",
        },
        {
            engine: "Ask",
            engineDisplayName: "Ask.com",
            description:
                "Ask.com enables curious people to find the information they need.",
        },
    ];
</script>

<section class="hero is-medium wrapper choice-ballot-wrapper">
    <div class="columns">
        <div class="column is-12">
            <div class="choice-ballot-description has-text-centered">
                <h1><strong>Select a Search Engine for Firefox</strong></h1>
                <h2>
                    These search engines are each used by millions of users
                    worldwide.
                </h2>
                <div id="homepageChangeDescription" class="hiding">
                    <h2>
                        Your homepage will be changed to Firefox Home as well.
                    </h2>
                    <h2>
                        You can always change your search engine and homepage
                        later in Firefox settings.
                        <a
                            href="https://support.mozilla.org/en-US/kb/firefox-options-preferences-and-settings"
                            target="_blank">Learn More.</a
                        >
                    </h2>
                </div>
                <div id="noHomepageChangeDescription">
                    <h2>
                        You can always change your search engine later in
                        Firefox settings.
                        <a
                            href="https://support.mozilla.org/en-US/kb/change-your-default-search-settings-firefox"
                            target="_blank">Learn More.</a
                        >
                    </h2>
                </div>
            </div>
            <div class="search-engines-wrapper">
                {#each engines as { engine, engineDisplayName, description }, i}
                    {#if choiceBallotType === "Extended"}
                        <Entry
                            {engine}
                            {engineDisplayName}
                            {description}
                            {choiceBallotType}
                        />
                    {:else if i < 4}
                        <Entry
                            {engine}
                            {engineDisplayName}
                            {description}
                            {choiceBallotType}
                        />
                    {/if}
                {/each}
            </div>
            {#if choiceBallotType === "Extended"}
                <div class="search-engines-more-wrapper hiding" />
                <div class="content has-text-centered see-more-container">
                    <!-- svelte-ignore a11y-missing-attribute -->
                    <a class="button is-link is-rounded see-more"
                        >See More Search Engines</a
                    >
                </div>
            {/if}
        </div>
    </div>
</section>
<footer class="footer">
    <div class="content has-text-centered">
        <!-- svelte-ignore a11y-missing-attribute -->
        <a class="button is-link continue" disabled>Continue</a>
    </div>
</footer>
