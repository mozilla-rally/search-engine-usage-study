<script>
    export let revertOption;
</script>

<section class="hero is-medium notice-wrapper">
    <div class="columns">
        <div class="column is-10 is-offset-1">
            <div class="has-text-centered">
                <h1 class="notice-title">
                    <strong>
                        The default search engine for Firefox has been changed
                        <span id="engineChange" />
                    </strong>
                </h1>
                <div id="engine-info" class="hiding">
                    <!-- svelte-ignore a11y-missing-attribute -->
                    <img id="notice-logo" />
                    <!-- svelte-ignore a11y-missing-content -->
                    <h2 id="engine-description" />
                </div>
                <div style="padding-bottom: 2rem;">
                    <div id="homepageChangeDescription" class="hiding">
                        <h2>
                            The home page for Firefox has also been changed to
                            Firefox Home.
                        </h2>
                        <h2>
                            You can change the default search engine and home
                            page at any time in Firefox settings.
                            <a
                                href="https://support.mozilla.org/en-US/kb/firefox-options-preferences-and-settings"
                                target="_blank">Learn More.</a
                            >
                        </h2>
                    </div>
                    <div id="noHomepageChangeDescription">
                        <h2>
                            You can change the default search engine at any time
                            in Firefox settings.
                            <a
                                href="https://support.mozilla.org/en-US/kb/change-your-default-search-settings-firefox"
                                target="_blank">Learn More.</a
                            >
                        </h2>
                    </div>
                    {#if revertOption}
                        <h2>
                            You can also choose to revert <span
                                id="revertPlural">this change</span
                            > now.
                        </h2>
                    {/if}

                    <div style="padding-top: 1rem;">
                        {#if revertOption}
                            <!-- svelte-ignore a11y-missing-attribute -->
                            <a
                                class="button is-outlined notice-button"
                                id="revert"
                                style="margin-right: 1rem;"
                            >
                                Revert
                            </a>
                        {/if}

                        <!-- svelte-ignore a11y-missing-attribute -->
                        <a class="button is-outlined notice-button" id="close">
                            Close
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

<footer id="footer" class="has-text-centered">
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
