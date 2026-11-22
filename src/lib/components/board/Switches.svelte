<script>
  // Open/close switches. The owner switches each module for everyone; an instructor switches it per cohort they teach.
  let { b, board } = $props();
  const mine = $derived(b.owner ? board.switches : board.switches.filter((w) => b.perms[w.key]));
  const cohortOn = (c, k) => (b.cohortSet[c] || {})[k] === true;
</script>

{#each mine as w (w.key)}
  {@const on = b.settings?.[w.key] === true}
  <div class="card sb-switch">
    <div class="sb-switch-ic">{@html w.icon}</div>
    <div class="sb-switch-t">
      {#if b.owner}
        <div class="eyebrow">{w.eyebrow}</div>
        <h3>{w.title} <span class="pill {on ? 'done' : 'part'}">{on ? 'Open to students' : 'Closed to students'}</span></h3>
        <p>{on ? w.on : w.off}</p>
      {:else}
        <div class="eyebrow">{w.eyebrow} · your cohorts</div>
        <h3>{w.title}</h3>
        <div class="sb-cos">
          {#each b.me?.cohorts ?? [] as c (c)}
            {@const con = cohortOn(c, w.key)}
            <div class="sb-co">
              <span>{c}</span>
              <span class="pill {con ? 'done' : 'part'}">{con ? 'Open' : 'Closed'}</span>
              <button class="btn {con ? 'btn-ghost' : 'btn-primary'}" data-cswitch={w.key} data-cohort={c} disabled={b.switchBusy === w.key}
                onclick={() => board.setCohortSwitch(w.key, c)}>{con ? 'Close' : 'Open'}</button>
            </div>
          {/each}
        </div>
      {/if}
      {#if b.switchMsg && b.switchMsg.key === w.key}<p class="login-msg" role="alert">{b.switchMsg.msg}</p>{/if}
    </div>
    <div class="sb-switch-a">
      <a class="btn btn-ghost" href={w.preview}>Preview</a>
      {#if b.owner}
        <button class="btn {on ? 'btn-ghost' : 'btn-primary'}" data-switch={w.key} id={w.key === 'twelveLead' ? 'sbTwelve' : 'sb_' + w.key}
          disabled={b.switchBusy === w.key} onclick={() => board.setSwitch(w.key)}>
          {b.switchBusy === w.key ? (on ? 'Closing…' : 'Opening…') : on ? 'Close to students' : 'Open to students'}
        </button>
      {/if}
    </div>
  </div>
{/each}
