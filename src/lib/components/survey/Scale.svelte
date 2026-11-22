<script>
  // A row of radio buttons: likert (with labels), stars, 0–10 or the 1–5 confidence scale.
  // Same markup and classes as the original page, so the existing styles apply.
  let { name, text, kind, lo, hi, labels = null, ends = null, value = $bindable(), onpick = null } = $props();
  const vals = $derived(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i));
</script>

<div class="sv-scale {kind}" role="radiogroup" aria-label={text}>
  {#each vals as v (v)}
    <input type="radio" id="sv-{name}-{v}" {name} value={v} checked={value === v} onchange={() => { value = v; onpick?.(v); }} />
    <label for="sv-{name}-{v}" title={labels ? labels[v - lo] : undefined}>
      {#if kind === 'stars'}<span aria-hidden="true">★</span><span class="sr">{v} of 5</span>
      {:else if kind === 'likert'}<b>{v}</b><span>{labels[v - lo]}</span>
      {:else}{labels ? labels[v - lo] : v}{/if}
    </label>
  {/each}
</div>
{#if ends}<div class="sv-ends"><span>{ends[0]}</span><span>{ends[1]}</span></div>{/if}
