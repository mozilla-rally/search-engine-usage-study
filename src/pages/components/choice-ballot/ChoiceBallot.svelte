<script>
    import Entry from "./Entry.svelte";
    export let choiceBallotType;
    let engines = [
        {
            engine: "Google",
            engineDisplayName: "Google",
            description: "Google is the world's most used search engine.",
        },
        {
            engine: "DuckDuckGo",
            engineDisplayName: "DuckDuckGo",
            description:
                "DuckDuckGo doesn't store your personal information. Ever.",
        },
        {
            engine: "Bing",
            engineDisplayName: "Bing",
            description:
                "Microsoft Bing helps you find trusted search results fast.",
        },
        {
            engine: "Yahoo",
            engineDisplayName: "Yahoo!",
            description:
                "Yahoo! Search helps you find the information you need.",
        },
        {
            engine: "Brave",
            engineDisplayName: "Brave",
            description:
                "Brave Search doesn't track you or your queries. Ever.",
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
                "Ecosia uses the ad revenue from your searches to plant trees.",
        },
        {
            engine: "Ask",
            engineDisplayName: "Ask.com",
            description:
                "Ask.com enables curious people to find the information they need.",
        },
    ];
</script>

<section class="hero is-medium choice-ballot-wrapper">
    <div
        class="choice-ballot-description has-text-centered columns is-centered"
    >
        <div class="column is-9">
            <h1>
                <strong>
                    Please Select a Default Search Engine for Firefox
                </strong>
            </h1>
            <div id="homepageChangeDescription" class="hiding">
                <h2>
                    The home page for Firefox will also be changed to Firefox
                    Home. You can change the default search engine and home page
                    at any time in Firefox settings.
                    <a
                        href="https://support.mozilla.org/en-US/kb/firefox-options-preferences-and-settings"
                        target="_blank"
                        style="white-space:nowrap">Learn More.</a
                    >
                </h2>
            </div>
            <div id="noHomepageChangeDescription">
                <h2>
                    You can change the default search engine at any time in
                    Firefox settings.
                    <a
                        href="https://support.mozilla.org/en-US/kb/change-your-default-search-settings-firefox"
                        target="_blank"
                        style="white-space:nowrap">Learn More.</a
                    >
                </h2>
            </div>
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
            <a class="button is-rounded see-more">See More Search Engines</a>
        </div>
    {/if}

    <!-- <div class="columns is-mobile is-centered"> -->
    <!-- svelte-ignore a11y-missing-attribute -->
    <!-- <a class="button continue" disabled>Continue</a> -->
    <!-- </div> -->
</section>

<footer id="footer" class="has-text-centered">
    <div style="background-color: #f0f0f4;">
        <button class="button continue" disabled>Continue</button>
    </div>

    <div class="columns footer-notice" style="margin-bottom: 0;">
        <div class="column is-10 is-offset-1">
            <div class="has-text-centered">
                <h4>
                    You are receiving this notice because of a Mozilla Rally
                    study that you previously joined: Search Engine Usage and
                    Result Quality, by Princeton University researchers. You can
                    learn more about the study or remove yourself from the study
                    at any time in Mozilla Rally settings.
                </h4>
            </div>
        </div>
    </div>
</footer>
