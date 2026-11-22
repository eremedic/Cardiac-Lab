<script>
  import { onMount, tick } from 'svelte';
  import { show } from '$lib/app/client.js';
  import { live, connect } from '$lib/app/live.svelte.js';
  import Icon from '$lib/components/runner/Icon.svelte';
  import { scrollTop, revealIfLow } from '$lib/components/runner/scroll.js';

  let engine = $state(null);
  onMount(async () => { engine = await connect(); show('megacode'); if (engine.megaView().ci != null) { await tick(); engine.megaFit(true); } });

  const V = $derived(live.snap && engine ? engine.megaView() : null);
  const letters = 'ABCD';
  const pad = (n) => String(n).padStart(2, '0');

  // The monitor trace is drawn by the engine (calipers attach to it); it animates until the decision is made.
  function monitor(node, a) {
    let last = '';
    const run = (a) => { if (!a || a.sig === last) return; last = a.sig; engine.drawMonitor(node, a.key, a.anim); };
    run(a);
    return { update: run };
  }
  // Fit the monitor and the question on screen together, then bring them into view.
  async function fit() { await tick(); engine.megaFit(true); }
  async function open(ci) { engine.megaOpen(ci); await fit(); }
  function back() { engine.megaBack(); scrollTop(); }
  async function answer(oi) { engine.megaAnswer(oi); await tick(); revealIfLow(document.querySelector('#mRun .decision .fb'), 0.75); }
  async function step(d) { engine.megaStep(d); await fit(); }
  async function retry() { engine.megaRetry(); await fit(); }
  let rt;
  function onresize() { if (!V || V.list) return; clearTimeout(rt); rt = setTimeout(() => engine.megaFit(false), 150); }
</script>

<svelte:window {onresize} />
<svelte:head><title>Megacode · Cardiac Lab</title></svelte:head>

<section class="view" id="v-megacode">
  {#if V && V.list}
    <div id="mList">
      <div class="qhead">
        <div><div class="eyebrow">Module 2 · Cardiac arrest management</div><h2>Megacode cases</h2></div>
        <div class="qstats"><span>Decisions correct <b class="num">{V.score.c}</b> / <b class="num">{V.total}</b></span></div>
      </div>
      <div class="cases" id="mCases">
        {#each V.cases as c (c.ci)}
          <button class="case" data-c={c.ci} onclick={() => open(c.ci)}>
            <span class="no">CASE {pad(c.n)}</span><h3>{c.title}</h3><span class="focus">{c.focus}</span>
            <span class="st"><span>{c.stages} decisions</span>
              {#if c.a === 0}<span class="pill">Not started</span>{:else if c.a === c.t}<span class="pill done">{c.c} / {c.t}</span>{:else}<span class="pill part">{c.a} of {c.t} done</span>{/if}
            </span>
          </button>
        {/each}
      </div>
    </div>
  {:else if V}
    <div id="mRun">
      <div class="runner">
        <div class="runner-head">
          <div><div class="eyebrow">Case {V.n} of 20 · {V.focus}</div><h2>{V.title}</h2></div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <div class="steps" aria-label="Progress">{#each V.steps as c, i (i)}<i class={c}></i>{/each}</div>
            <button class="btn btn-ghost" id="mBack" onclick={back}>All cases</button>
          </div>
        </div>
        <div class="card scenario"><Icon name="pt" /><p>{V.scenario}</p></div>
        {#if V.summary}
          <div class="card case-summary">
            <div class="verdict" style="color:var(--accent)">Case complete</div>
            <h3 style="font-family:var(--f-display);font-size:42px;text-transform:uppercase;font-weight:600">{V.summary.c} / {V.summary.t} correct</h3>
            <ol>
              {#each V.summary.items as it, i (i)}
                <li><b>{it.prompt}</b>{' '}{#if it.ok}<span style="color:var(--ok)">✓ {it.best}</span>{:else}<span style="color:var(--bad)">✗ You chose: {it.chose}</span><span>Best: {it.best}</span>{/if}</li>
              {/each}
            </ol>
            <div class="qnav">
              <button class="btn btn-ghost" id="mRetry" onclick={retry}>Retry this case</button>
              {#if !V.isLast}<button class="btn btn-primary" id="mNextCase" onclick={() => open(V.ci + 1)}>Next case →</button>{:else}<a class="btn btn-primary" href="/results">See results →</a>{/if}
            </div>
          </div>
        {:else}
          {@const st = V.stage}
          <div class="monitor">
            <div class="mon-top"><span class="live">Lead II · Decision {V.si + 1} of {V.count}</span>{#if st.done}<span class="reveal">Rhythm: {st.rhythm}</span>{:else}<span>25 mm/s</span>{/if}</div>
            <div class="mon-body">
              <div class="mon-screen" use:monitor={{ sig: V.ci + '-' + V.si + '|' + st.done, key: st.strip, anim: !st.done }}></div>
              <div class="vitals">
                <div class="vital hr"><small>HR</small><b class="num">{st.vitals.hr}</b></div>
                <div class="vital bp"><small>NIBP</small><b class="num">{st.vitals.bp}</b></div>
                <div class="vital sp"><small>SpO₂</small><b class="num">{st.vitals.sp}</b></div>
                <div class="vital co"><small>ETCO₂</small><b class="num">{st.vitals.co}</b></div>
              </div>
            </div>
            <div class="mon-status"><em>Status</em><span>{st.status}</span></div>
          </div>
          <div class="card decision">
            <h3>{st.prompt}</h3>
            <div class="opt-list" id="mOpts">
              {#each st.options as o, k (o.oi)}
                <button class="opt {st.done ? (o.ok ? 'is-right' : o.oi === st.chosen ? 'is-wrong' : 'is-dim') : ''}" data-i={o.oi} disabled={st.done} onclick={() => answer(o.oi)}><span class="k">{letters[k]}</span><span>{o.t}</span></button>
              {/each}
            </div>
            {#if st.fb}
              <div class="fb {st.fb.ok ? 'ok' : 'no'}" aria-live="polite">
                <div class="verdict">{#if st.fb.ok}<Icon name="ok" />Correct{:else}<Icon name="no" />Not the best choice{/if}</div>
                {#if !st.fb.ok}
                  <div class="why"><div><small>Your choice</small><b>{st.fb.t}</b>{st.fb.why}</div><div><small>Best answer</small><b>{st.fb.rightT}</b>{st.fb.rightWhy}</div></div>
                {:else}
                  <div class="clue"><Icon name="bulb" /><p>{st.fb.why}</p></div>
                {/if}
                <div class="clue"><Icon name="bulb" /><p><b>Rhythm on the monitor: </b>{st.rhythm}</p></div>
              </div>
            {/if}
            <div class="qnav">
              <button class="btn btn-ghost" id="mPrev" disabled={V.si === 0} onclick={() => step(-1)}>← Previous decision</button>
              <button class="btn btn-primary" id="mNext" disabled={!st.done} onclick={() => step(1)}>{st.last ? 'Finish case →' : 'Next decision →'}</button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</section>
