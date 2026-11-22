<script>
  // Owner only: the class code students enter and the saved cohort list.
  let { b, board } = $props();
  let code = $state(b.classCode), newCo = $state('');
  $effect(() => { code = b.classCode; });
  const src = $derived(b.codeSource === 'scoreboard' ? 'Set here' : b.codeSource === 'netlify' ? 'From Netlify (CLASS_CODE)' : 'No code: anyone with the link can share scores');
</script>

<div class="card panel sb-class" id="sbClass">
  <div class="sv-board-head"><div><div class="eyebrow">Owner only</div><h3>Class setup</h3></div></div>
  <div class="sb-class-grid">
    <form id="codeForm" onsubmit={(e) => { e.preventDefault(); board.saveClassCode(code); }}>
      <label class="cohort"><span>Class code students enter</span><input id="codeIn" maxlength="60" autocomplete="off" bind:value={code} placeholder="Leave blank for no code" /></label>
      <p class="empty">{src}. Students type it on the Home page; capitals don't matter. Changing it doesn't sign anyone out, but new saves need the new code.</p>
      <div class="inst-act">
        <button class="btn btn-primary" type="submit">Save code</button>
        {#if b.classCode}<button class="btn btn-ghost" type="button" id="codeClear" onclick={() => board.saveClassCode('')}>Remove code</button>{/if}
      </div>
    </form>
    <div>
      <span class="sb-class-l">Cohorts</span>
      <div class="sb-chips">
        {#each b.cohortList as c (c)}<button class="sb-chip" aria-label="Remove {c} from the list" onclick={() => board.removeCohort(c)}>{c} ✕</button>{/each}
      </div>
      <form class="inst-addco" id="coForm" onsubmit={(e) => { e.preventDefault(); if (newCo.trim()) board.addCohort(newCo).then(() => (newCo = '')); }}>
        <input id="coIn" maxlength="40" placeholder="Add a cohort, e.g. PCP Spring 2027" bind:value={newCo} />
        <button class="btn btn-ghost" type="submit">Add</button>
      </form>
      <p class="empty">Saved cohorts appear in every cohort dropdown here and as suggestions when students type their cohort. Removing one from the list doesn't change any student's results.</p>
    </div>
  </div>
  {#if b.classMsg}<p class="login-msg" role="alert">{b.classMsg}</p>{/if}
</div>
