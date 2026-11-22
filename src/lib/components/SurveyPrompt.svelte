<script>
  // The course-survey card on Course and Results: locked until 10% of the course is answered, then open, then done.
  let { sv } = $props();
  const pct = (c, t) => (t ? Math.min(100, Math.round((100 * c) / t)) : 0);
</script>

{#if sv}
  <div class="sv-prompt {sv.state}">
    <span class="sv-ic">
      {#if sv.state === 'locked'}
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="9" width="12" height="8" rx="2" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" /></svg>
      {:else}
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3.5" width="12" height="14" rx="2" /><path d="M7.5 3.5h5v2.5h-5zM7 10l2 2 4-4" /></svg>
      {/if}
    </span>
    <div class="sv-t">
      {#if sv.state === 'locked'}
        <div class="eyebrow">Course survey</div>
        <h3>Opens after {sv.unlockPct}% of the course</h3>
        <p>Answer {sv.need} strips or megacode decisions to unlock a short survey about the course.</p>
        <div class="progress"><i style="width:{pct(sv.done, sv.need)}%"></i></div>
        <small class="num">{sv.done} of {sv.need} answered</small>
      {:else if sv.state === 'done'}
        <div class="eyebrow">Course survey</div>
        <h3>Thanks for your feedback</h3>
        <p>Your survey was submitted {sv.doneAgo}. You can update your answers at any time.</p>
      {:else}
        <div class="eyebrow">Course survey · about 4 minutes</div>
        <h3>Tell us how the course is going</h3>
        <p>Your answers help your instructor improve the course. You can update them any time as you keep going.</p>
      {/if}
    </div>
    {#if sv.state === 'done'}<a class="btn btn-ghost" href="/survey">Edit my answers</a>{/if}
    {#if sv.state === 'open'}<a class="btn btn-primary" href="/survey">Take the survey</a>{/if}
  </div>
{/if}
