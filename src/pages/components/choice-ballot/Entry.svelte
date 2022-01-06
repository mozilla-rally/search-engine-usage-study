<script>
    import EntryNoDescription from "./EntryNoDescription.svelte";
    import EntryVisibleDescription from "./EntryVisibleDescription.svelte";
    import EntryHiddenDescription from "./EntryHiddenDescription.svelte";
    export let engine;
    export let engineDisplayName;
    export let description;
    export let choiceBallotType;
</script>

<div class="engine-container" id={engine}>
    <div class="columns is-flex is-centered">
        <div class="column is-2 is-2-mobile logo-div">
            <img
                src="assets/logos/{engine}.png"
                alt="{engineDisplayName} logo"
                class="logo"
            />
        </div>
        {#if choiceBallotType === "Default"}
            <EntryNoDescription {engineDisplayName} {description} />
        {:else if choiceBallotType === "HiddenDescription"}
            <EntryHiddenDescription {engineDisplayName} {description} />
        {:else}
            <EntryVisibleDescription {engineDisplayName} {description} />
        {/if}
        <div class="column is-2 is-2-mobile radio-container">
            <input
                type="radio"
                name="engine-select"
                value={engine}
                class="radio-button"
            />
        </div>
    </div>
</div>
