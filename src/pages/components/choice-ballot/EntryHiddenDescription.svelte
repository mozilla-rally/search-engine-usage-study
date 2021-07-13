<script>
    import RadioButton from "./RadioButton.svelte";
    export let engine;
    export let engineDisplayName;
    export let description;
</script>

<div class="column is-2 is-2-mobile is-offset-1 logo-div">
    <img
        src="assets/logos/{engine}.png"
        alt="{engineDisplayName} logo"
        class="logo"
    />
</div>
<div class="column is-5 is-5-mobile">
    <h2><strong>{engineDisplayName}</strong></h2>
    <p class="hiding">
        {description}
    </p>
</div>
<div class="column is-1 is-1-mobile chevron-container">
    <!-- svelte-ignore a11y-missing-attribute -->
    <a><i class="fa fa-chevron-down rotate" aria-hidden="true" /></a>
</div>
