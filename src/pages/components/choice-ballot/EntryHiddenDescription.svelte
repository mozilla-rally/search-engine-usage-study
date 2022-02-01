<script>
    export let engineDisplayName;
    export let description;
</script>

<div class="column is-4 is-6-mobile">
    <h2><strong>{engineDisplayName}</strong></h2>
    <p class="hiding">
        {description}
    </p>
</div>
<div
    class="column is-1 is-1-mobile chevron-container"
    style="display: flex; justify-content: flex-end;"
>
    <!-- svelte-ignore a11y-missing-attribute -->
    <a class="rotate">
        <i
            class="fa fa-xs fa-chevron-down"
            style="text-align: center;"
            aria-hidden="true"
        /></a
    >
</div>
