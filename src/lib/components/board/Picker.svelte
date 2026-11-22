<script>
  // "Choose who to view" (search + dropdown checklist + chips) and the "Print reports" card beside it.
  let { b, board, sel = $bindable(), cohortFilter } = $props();
  let q = $state(''), openDD = $state(false), ddEl, dropBtn;
  let prKind = $state('scores'), prMode = $state('one'), prOne = $state(''), prCohort = $state(''), prSummary = $state(true), prMsg = $state('');

  const byName = (a, c) => (a.name || '').localeCompare(c.name || '');
  const all = $derived(b.rows);
  const nSel = $derived(all.filter((r) => sel[r.id]).length);
  const visible = $derived(all.filter((r) => (!cohortFilter || (r.cohort || '') === cohortFilter) && (!q.trim() || ((r.name || '') + ' ' + (r.cohort || '')).toLowerCase().includes(q.trim().toLowerCase()))).slice().sort(byName));
  const chosen = $derived(all.filter((r) => sel[r.id]).slice().sort(byName));
  const sortedAll = $derived(all.slice().sort(byName));
  const cohortNames = $derived(Object.keys(b.cohorts).sort());
  $effect(() => { if (!prOne && sortedAll.length) prOne = sortedAll[0].id; });
  $effect(() => { if (!prCohort && cohortNames.length) prCohort = cohortNames[0]; });
  $effect(() => { if (!b.perms.survey) prKind = 'scores'; });

  const score = (r) => { const i = board.rowInfo(r); return i.overall == null ? '—' : i.overall + '%'; };
  function set(id, on) { const s = { ...sel }; if (on) s[id] = 1; else delete s[id]; sel = s; }
  function selectVisible() { const s = { ...sel }; visible.forEach((r) => (s[r.id] = 1)); sel = s; }
  function outside(e) { if (openDD && ddEl && !ddEl.contains(e.target) && !e.target.closest('[data-unsel]')) openDD = false; }

  function print() {
    let ids = [], title = '';
    if (prMode === 'one') { ids = [prOne]; title = all.find((r) => r.id === prOne)?.name || 'Unnamed student'; }
    else if (prMode === 'sel') { ids = chosen.map((r) => r.id); title = 'Selected students'; }
    else if (prMode === 'all') { ids = all.map((r) => r.id); title = 'All students'; }
    else { ids = all.filter((r) => prCohort && (r.cohort || '') === prCohort).map((r) => r.id); title = 'Cohort: ' + prCohort; }
    ids = ids.filter(Boolean);
    if (!ids.length) { prMsg = prMode === 'sel' ? 'No students are selected yet. Tick some in the list first.' : "There's no one to print for that choice."; return; }
    prMsg = '';
    if (prKind === 'survey') board.printSurvey(ids, title, prMode === 'one').then((ok) => { if (!ok) prMsg = "The survey questions didn't load. Check your connection and try again."; });
    else board.printScores(ids, title, ids.length > 1 && prSummary);
  }
</script>

<svelte:document onclick={outside} />

<div class="sb-top" class:solo={!b.perms.print}>
  <div class="card panel sb-pick" id="sbPickCard" role="presentation" onkeydown={(e) => { if (e.key === 'Escape' && openDD) { openDD = false; dropBtn?.focus(); } }}>
    <div class="sb-pick-head"><div><div class="eyebrow">Choose who to view</div><h3>Students <span class="num">{nSel} of {all.length} selected</span></h3></div></div>
    <div class="sb-dd" bind:this={ddEl}>
      <input type="search" id="sbSearch" placeholder="Search students by name or cohort" aria-label="Search students" autocomplete="off" bind:value={q} oninput={() => (openDD = true)} onfocus={() => (openDD = true)} />
      <button class="btn btn-ghost sb-dd-btn" id="sbDrop" aria-expanded={openDD} aria-controls="sbDropPanel" bind:this={dropBtn} onclick={() => (openDD = !openDD)}>
        <span>{nSel ? (nSel === all.length ? 'All ' + all.length + ' students' : nSel + ' selected') : 'Choose students'}</span><span aria-hidden="true">▾</span>
      </button>
      <div class="sb-dd-panel" id="sbDropPanel" hidden={!openDD}>
        <div class="sb-dd-tools">
          <button class="btn btn-ghost" id="sbSelAll" onclick={selectVisible}>Select all</button>
          <button class="btn btn-ghost" id="sbSelNone" onclick={() => (sel = {})}>Clear</button>
          <button class="btn btn-primary" id="sbDropDone" onclick={() => { openDD = false; dropBtn?.focus(); }}>Done</button>
        </div>
        <p class="sb-pick-note">
          {#if cohortFilter || q.trim()}Showing {visible.length} of {all.length}{cohortFilter ? ' in ' + cohortFilter : ''}{q.trim() ? ' matching "' + q.trim() + '"' : ''}. Select all picks just these.
          {:else}Select all picks everyone in the list. Narrow the list with the Cohort filter or the search box.{/if}
        </p>
        <div class="sb-pick-list" id="sbPickList" role="group" aria-label="Students to show">
          {#if visible.length}
            <div class="sb-pick-hd" aria-hidden="true"><span></span><span>Student</span><span>Cohort</span><span>Score</span></div>
            {#each visible as r (r.id)}
              <label class="sb-pick-item" class:on={!!sel[r.id]}>
                <input type="checkbox" data-sel={r.id} checked={!!sel[r.id]} onchange={(e) => set(r.id, e.currentTarget.checked)} />
                <b class="pi-n">{r.name || 'Unnamed student'}</b><span class="pi-c">{r.cohort || '—'}</span><span class="pi-s num">{score(r)}</span>
              </label>
            {/each}
          {:else}
            <p class="empty">No students match.</p>
          {/if}
        </div>
      </div>
    </div>
    <div class="sb-chips" id="sbChips">
      {#if chosen.length && chosen.length < all.length}
        {#each chosen.slice(0, 30) as r (r.id)}<button class="sb-chip" data-unsel={r.id} aria-label="Remove {r.name || 'student'}" onclick={() => set(r.id, false)}>{r.name || 'Unnamed student'} ✕</button>{/each}
        {#if chosen.length > 30}<span class="sb-chip more">+{chosen.length - 30} more</span>{/if}
      {/if}
    </div>
  </div>
  {#if b.perms.print}
    <div class="card panel sb-print" id="sbPrintCard">
      <div class="eyebrow">Paper copies</div><h3>Print reports</h3>
      <div class="pr-kind" role="radiogroup" aria-label="Report">
        <label><input type="radio" name="prKind" value="scores" bind:group={prKind} /><span>Scores report</span></label>
        {#if b.perms.survey}<label><input type="radio" name="prKind" value="survey" bind:group={prKind} /><span>Course survey report</span></label>{/if}
      </div>
      <fieldset class="pr-modes">
        <legend class="sr-only">Who to include</legend>
        <label class="pr-opt"><input type="radio" name="prMode" value="one" bind:group={prMode} /><span>One student</span></label>
        <select id="prOne" aria-label="Student to print" bind:value={prOne} onchange={() => (prMode = 'one')}>
          {#each sortedAll as r (r.id)}<option value={r.id}>{r.name || 'Unnamed student'}{r.cohort ? ' · ' + r.cohort : ''}</option>{/each}
        </select>
        <label class="pr-opt"><input type="radio" name="prMode" value="sel" bind:group={prMode} /><span>Selected students <b class="num">({nSel})</b></span></label>
        <label class="pr-opt"><input type="radio" name="prMode" value="cohort" bind:group={prMode} /><span>Cohort</span></label>
        <select id="prCohort" aria-label="Cohort to print" bind:value={prCohort} disabled={!cohortNames.length} onchange={() => (prMode = 'cohort')}>
          {#each cohortNames as c (c)}<option value={c}>{c} ({b.cohorts[c]})</option>{:else}<option value="">No cohorts yet</option>{/each}
        </select>
        <label class="pr-opt"><input type="radio" name="prMode" value="all" bind:group={prMode} /><span>{b.owner ? 'Everyone' : 'All my students'}</span></label>
      </fieldset>
      {#if prKind === 'scores'}
        <label class="pr-chk"><input type="checkbox" id="prSummary" bind:checked={prSummary} /><span>Add a class summary page with charts (for a group or cohort)</span></label>
      {:else}
        <p class="pr-kind-note">The survey report summarizes everyone included: ratings, Net Promoter Score, confidence, every answer breakdown, willingness to pay and all comments. Anonymous answers stay anonymous.</p>
      {/if}
      {#if prMsg}<p class="login-msg" role="alert">{prMsg}</p>{/if}
      <button class="btn btn-primary" id="prGo" onclick={print}>Print</button>
      <p class="empty">Each student prints on their own page. Use your browser's print dialog to choose a printer or Save as PDF.</p>
    </div>
  {/if}
</div>
