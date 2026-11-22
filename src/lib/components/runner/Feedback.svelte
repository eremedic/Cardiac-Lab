<script>
  // Feedback after answering a strip or 12-lead (Random strips and practice areas).
  // `hint` is the markup's plain-language summary (what was labeled on the ECG), when the answer was wrong.
  import Icon from './Icon.svelte';
  let { fb, hint = null } = $props();
</script>

<div class="fb {fb.ok ? 'ok' : 'no'}">
  <div class="verdict">
    {#if fb.ok}<Icon name="ok" />Correct{:else}<Icon name="no" />{fb.revealed ? 'Answer revealed · counted as wrong' : 'Not quite'}{/if}
  </div>
  <div class="answer-name">{fb.name}</div>
  {#if !fb.ok}
    <p class="fb-note mk-hint"><Icon name="bulb" /><span>{hint ?? `Look back at the strip: it's now marked up to show what makes this ${fb.catShort}. P waves (red if not conducted), PR and R–R intervals in seconds, wide QRS complexes and pacer spikes are labeled where they apply.`}</span></p>
  {/if}
  {#if fb.revealed}
    <p class="fb-note">The cardiologist talked you through this one, so it counts as wrong. Here's the full explanation.</p>
  {:else if !fb.ok}
    <div class="why">
      <div><small>You chose</small><b>{fb.chosen}</b>{fb.chosenKey}</div>
      <div><small>This strip is</small><b>{fb.cat}</b>{fb.catKey}</div>
    </div>
  {/if}
  <div class="clue"><Icon name="bulb" /><p><b>The tell: </b>{fb.clue}</p></div>
  <div class="interp">
    <table class="itable"><tbody>
      {#each fb.rows as r, i (i)}<tr><th scope="row">{r[0]}</th><td>{r[1]}</td></tr>{/each}
    </tbody></table>
    <div class="action"><h4>Field action</h4><ul>{#each fb.action as a, i (i)}<li>{a}</li>{/each}</ul></div>
  </div>
</div>
