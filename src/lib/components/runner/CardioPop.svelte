<script>
  // "Cardiologist on the line": the hints used so far, docked bottom-right. Minimizing is remembered.
  import Icon from './Icon.svelte';
  let { cardio, done, freshIdx = -1, onmin } = $props();
  const used = $derived(cardio.used);
  const sub = $derived(cardio.revealed ? 'Answer revealed after 3 hints' : done ? used + ' hint' + (used === 1 ? '' : 's') + ' used' : used + ' of 3 hints' + (used === 3 ? ' · next call reveals the answer' : ''));
</script>

<aside class="cardio-pop" class:min={cardio.min} aria-label="Cardiologist hints">
  <button class="cardio-pop-head" aria-expanded={!cardio.min} aria-controls="cardioPopBody" title={cardio.min ? 'Show hints' : 'Minimize'} onclick={() => onmin(!cardio.min)}>
    <span class="cardio-av"><Icon name="phone" /></span>
    <span class="cardio-pop-t"><b>Cardiologist on the line</b><small>{sub}</small></span>
    <span class="cardio-min" aria-hidden="true">
      {#if cardio.min}<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12l5-5 5 5" /></svg>
      {:else}<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 10h10" /></svg>{/if}
    </span>
  </button>
  <div class="cardio-pop-body" id="cardioPopBody" role="status" aria-live="polite" hidden={cardio.min}>
    <ol class="cardio-hints">
      {#each cardio.hints as h, i (i)}<li class={i === freshIdx ? 'new' : ''}><b>Hint {i + 1}</b><p>{h}</p></li>{/each}
    </ol>
    {#if !done && used < 3}<p class="cardio-pop-note">Still stuck? Call again for hint {used + 1} of 3.</p>{/if}
    {#if !done && used === 3}<p class="cardio-pop-note">One more call reveals the answer and counts it as wrong.</p>{/if}
  </div>
</aside>
