<script>
    import Entry from "./Entry.svelte";
    import EntryVisibleDescription from "./EntryVisibleDescription.svelte";
    import EntryHiddenDescription from "./EntryHiddenDescription.svelte";
    export let type;
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
            description: "We don't track you. Privacy, simplified.",
        },
        {
            engine: "Bing",
            engineDisplayName: "Bing",
            description: "Fast, accurate, and private search from Microsoft.",
        },
        {
            engine: "Yahoo",
            engineDisplayName: "Yahoo",
            description: "Yahoo connects people with the things they love.",
        },
        {
            engine: "Yandex",
            engineDisplayName: "Yandex",
            description: "Yahoo connects people with the things they love.",
        },
        {
            engine: "Baidu",
            engineDisplayName: "Baidu",
            description: "Yahoo connects people with the things they love.",
        },
        {
            engine: "Ecosia",
            engineDisplayName: "Ecosia",
            description: "Yahoo connects people with the things they love.",
        },
        {
            engine: "Ask",
            engineDisplayName: "Ask.com",
            description: "Yahoo connects people with the things they love.",
        },
    ];
</script>

<section class="hero is-medium wrapper choice-screen-wrapper">
    <div class="columns">
        <div class="column is-12">
            <div class="choice-screen-description has-text-centered">
                <h1><strong>Select a Search Engine for Firefox</strong></h1>
                <h2>
                    These search engines are each used by millions of users
                    worldwide.
                </h2>
                <h2>
                    You can always select another search engine later in Firefox
                    settings.
                    <a
                        href="https://support.mozilla.org/en-US/kb/change-your-default-search-settings-firefox"
                        target="_blank">Learn More.</a
                    >
                </h2>
                <h2 id="homepage_change" style="display: none;">
                    Your homepage will be changed to the Firefox Home as well.
                </h2>
            </div>
            <div class="search-engines">
                {#each engines as { engine, engineDisplayName, description }, i}
                    {#if type === "Extended"}
                        <EntryVisibleDescription
                            {engine}
                            {engineDisplayName}
                            {description}
                        />
                    {:else if i < 4}
                        {#if type === "Default"}
                            <Entry {engine} {engineDisplayName} {description} />
                        {:else if type === "HiddenDescription"}
                            <EntryHiddenDescription
                                {engine}
                                {engineDisplayName}
                                {description}
                            />
                        {:else if type === "VisibleDescription"}
                            <EntryVisibleDescription
                                {engine}
                                {engineDisplayName}
                                {description}
                            />
                        {/if}
                    {/if}
                {/each}
            </div>
            {#if type === "Extended"}
                <div class="search-engines-more hiding" />
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
