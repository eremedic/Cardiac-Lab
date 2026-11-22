<script>
  // The "All strips" grid: one dot per item, colored by result, the current one outlined.
  let { dots, onpick, id = undefined } = $props();
</script>

<div class="dots" {id}>
  {#each dots as d (d.n)}
    <button class="dot {d.c}{d.cur ? ' cur' : ''}" data-n={d.n} aria-label="Strip {d.n}" onclick={() => onpick(d.n)}>{d.n}</button>
  {/each}
</div>
