<script>
  import { onMount } from 'svelte';
  import { show } from '$lib/app/client.js';
  import { live, connect } from '$lib/app/live.svelte.js';
  import Login from '$lib/components/board/Login.svelte';
  import Switches from '$lib/components/board/Switches.svelte';
  import ClassSetup from '$lib/components/board/ClassSetup.svelte';
  import Instructors from '$lib/components/board/Instructors.svelte';
  import Picker from '$lib/components/board/Picker.svelte';
  import StudentTable from '$lib/components/board/StudentTable.svelte';

  let board = $state(null);
  onMount(async () => { const a = await connect(); board = a.board; show('scoreboard'); });

  // Re-read the scoreboard whenever the engine reports a change.
  const b = $derived(live.snap && board ? board.snap() : null);

  // Who is selected (kept in this browser), the cohort filter and the sort.
  const SEL_KEY = 'cl-sb-sel';
  let sel = $state((() => { const o = {}; try { for (const id of JSON.parse(localStorage.getItem(SEL_KEY) || '[]') || []) o[id] = 1; } catch {} return o; })());
  $effect(() => { const ids = Object.keys(sel); try { localStorage.setItem(SEL_KEY, JSON.stringify(ids)); } catch {} });
  let cohortFilter = $state(''), sortMode = $state('recent'), tsort = $state(null);

  const selected = $derived(b && board ? board.sortRows(b.rows.filter((r) => sel[r.id]), sortMode, tsort) : []);
  const stats = $derived(board && selected.length ? board.stats(selected) : null);
  const hard = $derived(board ? board.hard(selected) : []);
  const cohortNames = $derived(b ? Object.keys(b.cohorts).sort() : []);
  const who = $derived(!b?.admin || !b.me ? '' : b.owner ? 'owner' : 'inst');

  // Survey panel buttons live inside the report HTML.
  function panelClick(e) {
    if (e.target.closest('#svPrint')) board.printSurvey(selected.map((r) => r.id), 'Selected students', false);
    else if (e.target.closest('#svCsv')) board.csvSurvey(selected.map((r) => r.id));
  }
  function openHard(n) { connect().then((a) => a.openStrip(n)); }
</script>

<svelte:head><title>Instructor · Cardiac Lab</title></svelte:head>

<section class="view" id="v-scoreboard">
  <div class="qhead">
    <div>
      <div class="eyebrow">Instructor view · refreshes every 30 s</div>
      <h2>Class scoreboard</h2>
      <p class="sb-who">
        {#if who === 'owner'}Signed in as the <b>owner</b> · full access{:else if who === 'inst'}Signed in as <b>{b.me.name || 'Instructor'}</b> · {(b.me.cohorts || []).join(', ')}{/if}
      </p>
    </div>
    <div class="sb-tools">
      <label class="sel" for="sbCohort"><span>Cohort (student list)</span>
        <select id="sbCohort" bind:value={cohortFilter}><option value="">All</option>{#each cohortNames as c (c)}<option value={c}>{c}</option>{/each}</select>
      </label>
      <label class="sel" for="sbSort"><span>Sort</span>
        <select id="sbSort" bind:value={sortMode} onchange={() => (tsort = null)}>
          <option value="recent">Last active</option><option value="score">Overall score</option><option value="name">Name</option><option value="progress">Progress</option>
        </select>
      </label>
      {#if b?.admin}
        <button class="btn btn-ghost" id="sbRefresh" onclick={() => board.refresh()}>Refresh</button>
        {#if selected.length && b.perms.csv}<button class="btn btn-ghost" id="sbCsv" onclick={() => board.csvScores(null, selected.map((r) => r.id))}>Download CSV (selected)</button>{/if}
        <button class="btn btn-ghost" id="sbOut" onclick={() => board.signOut()}>Sign out</button>
      {/if}
    </div>
  </div>

  {#if !b}
    <div class="card panel"><p class="empty">Loading…</p></div>
  {:else if b.problem}
    <div class="card panel problem">
      <h3>{b.problem.title}</h3><p>{b.problem.detail}</p>
      <div class="qnav" style="justify-content:flex-start"><button class="btn btn-primary" id="sbRetry" onclick={() => board.retry()}>Retry</button><a class="btn btn-ghost" href="/api/health" target="_blank" rel="noopener">Open setup check</a></div>
      <p class="empty">The setup check (/api/health) tests the database connection and says what to change in Netlify.</p>
    </div>
  {:else if !b.admin && b.loading}
    <div class="card panel"><p class="empty">Loading results…</p></div>
  {:else if !b.admin}
    <Login msg={b.loginMsg} onlogin={(pw) => board.login(pw)} />
  {:else}
    {#if b.settings}
      <div id="sbSettings">
        <Switches {b} {board} />
        {#if b.owner}<ClassSetup {b} {board} /><Instructors {b} {board} />{/if}
      </div>
    {/if}
    {#if b.rows.length}<Picker {b} {board} bind:sel {cohortFilter} />{/if}
    <div id="sbBody">
      {#if !b.rows.length}
        <div class="card panel"><h3>No results yet</h3><p class="empty">Send your students this site's link. When they enter their name on the Home page, their scores appear here as they answer. The page refreshes every 30 seconds.</p></div>
      {:else if !selected.length}
        <div class="card panel sb-empty-sel"><h3>No students selected</h3><p class="empty">Tick the students you want to see in the list above, or press <b>Select all</b>. The stats, charts and table below cover only the students you select. Printing a single student or a cohort works without selecting anyone.</p></div>
      {:else}
        <div class="stats">
          <div class="card stat"><small>Students</small><b class="num">{stats.n}</b><span>selected</span></div>
          <div class="card stat"><small>Average score</small><b class="num">{stats.avg == null ? '—' : stats.avg + '%'}</b><span>correct of answered</span></div>
          <div class="card stat"><small>Strips</small><b class="num">{stats.strips == null ? '—' : stats.strips + '%'}</b><span>class average, of answered</span></div>
          <div class="card stat"><small>Megacode</small><b class="num">{stats.mega == null ? '—' : stats.mega + '%'}</b><span>class average, of answered</span></div>
          <div class="card stat"><small>Finished</small><b class="num">{stats.done}</b><span>completed both modules</span></div>
        </div>
        {@html board.newModulesHTML(selected)}
        {@html board.chartsHTML(selected)}
        <div class="sb-grid">
          <StudentTable {b} {board} rows={selected} bind:tsort />
          <div class="card panel">
            <h3>Most-missed strips</h3>
            <div class="hard" id="sbHard">
              {#each hard as h (h.n)}
                <button data-n={h.n} onclick={() => openHard(h.n)}><b>#{h.n}</b><span>{h.name}</span><em>{h.miss}/{h.tot}</em></button>
              {:else}
                <p class="empty">No missed strips yet.</p>
              {/each}
            </div>
          </div>
        </div>
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div onclick={panelClick}>{@html board.panelsHTML(selected)}</div>
      {/if}
    </div>
  {/if}
</section>
