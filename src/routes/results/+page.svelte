<script>
  import { onMount } from 'svelte';
  import { show } from '$lib/app/client.js';
  import { live, connect } from '$lib/app/live.svelte.js';
  import SurveyPrompt from '$lib/components/SurveyPrompt.svelte';

  let engine = $state(null);
  let confirmReset = $state(false);
  onMount(async () => { engine = await connect(); show('results'); });

  // Recomputed whenever the engine reports a change (live.snap).
  const R = $derived(live.snap && engine ? engine.results() : null);
  const pct = (c, t) => (t ? Math.round((100 * c) / t) : 0);
  const done = $derived(R ? R.strips.a + R.mega.a : 0);
  const total = $derived(R ? R.strips.n + R.mega.n : 0);
  const correct = $derived(R ? R.strips.c + R.mega.c : 0);
  const overall = $derived(pct(correct, done));
  const msg = $derived(
    done === 0 ? 'Answer strips and megacode decisions to build your score.'
    : done < total ? `Your score is the share of the ${done} items you've answered that were correct (${total - done} still to go). ` + (overall >= 84 ? 'On track: keep going.' : 'Review the missed items below as you go.')
    : overall >= 90 ? "Excellent. You're reading rhythms and running codes at a high level."
    : overall >= 84 ? 'Solid pass-level performance. Review the items below to tighten up.'
    : 'Keep practicing. Review the missed strips and retry the cases below.'
  );
  const r = 62, C = 2 * Math.PI * r;
</script>

<svelte:head><title>Results · Cardiac Lab</title></svelte:head>

<section class="view" id="v-results">
  <div class="card sv-home"><SurveyPrompt sv={live.snap?.survey} /></div>
  {#if R}
    <div class="card score-hero">
      <svg class="big-ring" viewBox="0 0 150 150" role="img" aria-label="{overall}% correct">
        <circle class="t" cx="75" cy="75" {r} />
        <circle class="v" cx="75" cy="75" {r} stroke-dasharray="{(C * overall / 100).toFixed(1)} {C.toFixed(1)}" transform="rotate(-90 75 75)" />
        <text x="75" y="86" text-anchor="middle" font-size="40">{overall}%</text>
      </svg>
      <div>
        <div class="eyebrow">{done < total ? 'Score so far' : 'Final score'}</div>
        <h2><span class="num">{correct}</span> of <span class="num">{done}</span> answered correct</h2>
        <p>{msg}</p>
        <div class="legend" style="margin-top:12px">
          <span>Strips: <b class="num">{R.strips.c}/{R.strips.a}</b> ({R.strips.a ? pct(R.strips.c, R.strips.a) + '%' : '–'}) · {R.strips.a} of {R.strips.n} answered</span>
          <span>Megacode: <b class="num">{R.mega.c}/{R.mega.a}</b> ({R.mega.a ? pct(R.mega.c, R.mega.a) + '%' : '–'}) · {R.mega.a} of {R.mega.n} answered</span>
        </div>
      </div>
    </div>
    <div class="split">
      <div class="card panel">
        <h3>Strips by rhythm family <span class="num">{R.strips.c}/{R.strips.a}</span></h3>
        <div class="bars">
          {#each R.groups as g (g.key)}
            <div class="barrow"><span>{g.label}</span><span class="track"><i style="width:{pct(g.c, g.a)}%"></i></span><b>{g.a ? g.c + '/' + g.a : '—'}</b></div>
          {/each}
        </div>
        <h3 style="margin-top:6px">Missed strips <span class="num">{R.missed.length}</span></h3>
        <div class="missed">
          {#each R.missed as q (q.n)}
            <button onclick={() => engine.openStrip(q.n)}><b>#{q.n}</b><span style="color:var(--ink)">{q.name}</span></button>
          {:else}
            <p class="empty">{R.strips.a ? 'No missed strips. Well done.' : 'No strips answered yet.'}</p>
          {/each}
        </div>
      </div>
      <div class="card panel">
        <h3>Megacode by case <span class="num">{R.mega.c}/{R.mega.a}</span></h3>
        <div class="case-scores">
          {#each R.cases as c (c.ci)}
            <button onclick={() => engine.openCase(c.ci)}><span style="color:var(--muted);font-size:11.5px">Case {c.n}</span><b>{c.a ? c.c + '/' + c.a : '—'}</b><span>{c.title}</span></button>
          {/each}
        </div>
        <h3 style="margin-top:6px">Start over</h3>
        <div class="confirm">
          {#if confirmReset}
            <span>Erase all answers in this browser?</span>
            <button class="btn btn-primary" onclick={() => { engine.resetProgress(); confirmReset = false; }}>Erase</button>
            <button class="btn btn-ghost" onclick={() => (confirmReset = false)}>Cancel</button>
          {:else}
            <button class="btn btn-ghost" onclick={() => (confirmReset = true)}>Reset all progress</button>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</section>
