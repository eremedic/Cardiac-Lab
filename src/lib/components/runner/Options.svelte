<script>
  // Answer choices A–D. After answering: the right one green, the pick red, the rest dimmed.
  let { options, chosen = null, right, onpick, id = undefined, label = 'Answer choices', hidden = false } = $props();
  const letters = 'ABCDE';
  const done = $derived(chosen != null);
</script>

<div class="opts" {id} role="group" aria-label={label} {hidden}>
  {#each options as o, i (o)}
    <button class="opt {done ? (o === right ? 'is-right' : o === chosen ? 'is-wrong' : 'is-dim') : ''}" data-o={o} disabled={done} onclick={() => onpick(o)}>
      <span class="k">{letters[i]}</span><span>{o}</span>
    </button>
  {/each}
</div>
