<script>
    import EntryNoDescription from "./EntryNoDescription.svelte";
    import EntryVisibleDescription from "./EntryVisibleDescription.svelte";
    import EntryHiddenDescription from "./EntryHiddenDescription.svelte";
    import RadioButton from "./RadioButton.svelte";
    export let engine;
    export let engineDisplayName;
    export let description;
    export let choiceBallotType;
</script>

<div class="engine-container" id={engine}>
    <div class="columns is-mobile">
        {#if choiceBallotType === "NoDescription"}
            <EntryNoDescription {engine} {engineDisplayName} {description} />
        {:else if choiceBallotType === "HiddenDescription"}
            <EntryHiddenDescription
                {engine}
                {engineDisplayName}
                {description}
            />
        {:else}
            <EntryVisibleDescription
                {engine}
                {engineDisplayName}
                {description}
            />
        {/if}
        <RadioButton {engine} />
    </div>
</div>
