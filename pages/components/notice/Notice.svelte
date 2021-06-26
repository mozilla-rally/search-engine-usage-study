<script>
    export let revert;
</script>

<div id="page-container">
    <section class="hero is-medium wrapper content-wrap">
        <div class="columns">
            <div class="column is-10 is-offset-1">
                <div class="has-text-centered">
                    <h1 class="notice-title">
                        <strong>
                            Your search engine was changed
                            <span id="engine_change" />
                        </strong>
                    </h1>
                    <div id="engine-info" style="display: none;">
                        <!-- svelte-ignore a11y-missing-attribute -->
                        <img id="notice-logo" />
                        <!-- svelte-ignore a11y-missing-content -->
                        <h2 id="engine-description" />
                    </div>
                    <div style="padding-bottom: 2rem;">
                        <h2 id="homepage_change" style="display: none;">
                            Your homepage was changed to the Firefox Default as
                            well.
                        </h2>
                        <h2>
                            You can always select another search engine later in
                            Firefox settings.
                            <a
                                href="https://support.mozilla.org/en-US/kb/change-your-default-search-settings-firefox"
                                target="_blank">Learn More.</a
                            >
                        </h2>
                        {#if revert}
                            <h2>
                                You can also choose to revert <span
                                    id="revert_plural">this change</span
                                > now.
                            </h2>
                            <div style="padding-top: 1rem;">
                                <a
                                    onclick="self.close()"
                                    class="button is-link is-outlined notice-button"
                                    id="revert">Close</a
                                >
                                <!-- svelte-ignore a11y-missing-attribute -->
                                <a
                                    class="button is-link is-outlined notice-button"
                                    >Revert</a
                                >
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </section>

    <footer id="footer">
        <div class="content has-text-centered">
            <h4>
                This is part of a study conducted by Princeton University and
                Mozilla.
            </h4>
            <img
                src="assets/logos/Princeton.png"
                alt="Princeton logo"
                class="footer-img"
            />
        </div>
    </footer>
</div>
