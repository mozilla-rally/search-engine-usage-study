<script>
    import RadioButton from "./RadioButton.svelte";
    export let engine;
    export let engineDisplayName;
</script>

<div class="column is-2 is-2-mobile is-offset-2 logo-div">
    <img
        src="assets/logos/{engine}.png"
        alt="{engineDisplayName} logo"
        class="logo"
    />
</div>
<div
    class="column is-5 is-5-mobile"
    style="display: flex; align-items: center;"
>
    <h2><strong>{engineDisplayName}</strong></h2>
</div>
