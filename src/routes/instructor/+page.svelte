<script>
  import { onMount } from 'svelte';
  import { show } from '$lib/app/client.js';
  onMount(() => { show('scoreboard'); });
</script>

<svelte:head><title>Instructor · Cardiac Lab</title></svelte:head>

  <section class="view" id="v-scoreboard">
    <div class="qhead">
      <div><div class="eyebrow">Instructor view · refreshes every 30 s</div><h2>Class scoreboard</h2><p class="sb-who" id="sbWho"></p></div>
      <div class="sb-tools">
        <label class="sel" for="sbCohort"><span>Cohort (student list)</span><select id="sbCohort"><option value="">All</option></select></label>
        <label class="sel" for="sbSort"><span>Sort</span><select id="sbSort"><option value="recent">Last active</option><option value="score">Overall score</option><option value="name">Name</option><option value="progress">Progress</option></select></label>
        <button class="btn btn-ghost" id="sbRefresh" hidden>Refresh</button>
        <button class="btn btn-ghost" id="sbCsv" hidden>Download CSV (selected)</button>
        <button class="btn btn-ghost" id="sbOut" hidden>Sign out</button>
      </div>
    </div>
    <div id="sbSettings"></div>
    <div id="sbPick"></div>
    <div id="sbBody"></div>
  </section>
