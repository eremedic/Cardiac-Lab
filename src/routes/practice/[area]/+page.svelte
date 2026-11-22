<script>
  import { tick } from 'svelte';
  import { page } from '$app/state';
  import { show } from '$lib/app/client.js';
  import { live, connect } from '$lib/app/live.svelte.js';
  import Feedback from '$lib/components/runner/Feedback.svelte';
  import Options from '$lib/components/runner/Options.svelte';
  import Dots from '$lib/components/runner/Dots.svelte';
  import Icon from '$lib/components/runner/Icon.svelte';
  import CardioPop from '$lib/components/runner/CardioPop.svelte';
  import { scrollTop, revealIfLow, revealNearest, typing } from '$lib/components/runner/scroll.js';

  let engine = $state(null);
  let hint = $state(null), freshIdx = $state(-1), confirmReset = $state(false);
  const key = $derived(page.params.area);
  // Re-run when moving between areas (/practice/sinus -> /practice/block) without leaving the page.
  $effect(() => { const k = key; connect().then((a) => { engine = a; show('area', k); }); });
  $effect(() => { key; confirmReset = false; freshIdx = -1; });

  const V = $derived(live.snap && engine ? engine.areaView(key) : null);
  const pct = (c, t) => (t ? Math.round((100 * c) / t) : 0);
  const lower = (u) => u.toLowerCase();

  // The ECG block (paper + meta line) is drawn by the engine: calipers, markup and the fit-to-screen attach to it.
  function ecg(node, a) {
    let last = '';
    const run = (a) => { if (!a || a.sig === last) return; last = a.sig; hint = engine.drawAreaPaper(node, a.key, a.mark); };
    run(a);
    return { update: run, destroy: () => {} };
  }
  const ecgArgs = $derived(V && V.q ? { sig: key + ':' + V.q.n + '|' + (V.chosen ?? ''), key, mark: V.done && V.chosen !== V.q.cat } : null);

  async function pick(o) {
    engine.areaAnswer(key, o); freshIdx = -1;
    await tick();
    if (V?.vq && V.vq.picked == null) setTimeout(() => revealNearest(document.querySelector('#v-area .vessel-q')), 60);
  }
  async function pickVessel(i) { engine.areaVessel(key, i); await tick(); revealNearest(document.querySelector('#v-area .vessel-q .fb')); }
  function go(n) { engine.areaGo(key, n); hint = null; scrollTop(); }
  async function cardio() {
    const r = engine.areaCardio(key);
    if (r === 'hint') { freshIdx = V.cardio ? V.cardio.used - 1 : -1; }
    else if (r === 'reveal') { freshIdx = -1; await tick(); revealNearest(document.querySelector('#v-area .fb'), 'center'); }
  }
  function onkey(e) {
    if (!V || !V.q || typing(e)) return;
    const k = e.key.toUpperCase(), idx = 'ABCD'.indexOf(k);
    if (k === 'H' && V.q.hints && !V.done) { cardio(); return; }
    if (idx >= 0 && e.key.length === 1) { if (!V.done && V.q.options[idx]) pick(V.q.options[idx]); }
    else if (e.key === 'ArrowRight') go(V.pi + 1);
    else if (e.key === 'ArrowLeft' && V.pi > 1) go(V.pi - 1);
  }
  const showPop = $derived(!!(V && V.q && V.cardio && V.cardio.used > 0));
</script>

<svelte:window onkeydown={onkey} />
<svelte:head><title>{V?.meta ? V.meta.title + ' · ' : ''}Practice · Cardiac Lab</title></svelte:head>

<section class="view" id="v-area" style={V?.meta ? `--accent:${V.meta.ink};--accent-soft:${V.meta.soft}` : undefined}>
  <div id="arBody">
    {#if !V}
      <div class="card panel"><p class="empty">Loading…</p></div>
    {:else if V.status === 'missing'}
      <div class="card panel"><h3>There's no practice area here</h3><a class="btn btn-primary" href="/practice">Back to practice areas</a></div>
    {:else if V.status === 'locked'}
      <div class="card panel area-locked" style="--ac:{V.meta.color}">
        <span class="sv-ic"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="9" width="12" height="8" rx="2" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" /></svg></span>
        <h3>{V.meta.lockName} aren't open yet</h3>
        <p class="empty">Your instructor will open this practice area when the class is ready for it. In the meantime, keep working in the other areas.</p>
        <a class="btn btn-primary" href="/practice">Back to practice areas</a>
      </div>
    {:else if V.status === 'loading'}
      <div class="card panel"><p class="empty">Loading {lower(V.meta.title)}…</p></div>
    {:else if V.status === 'error'}
      <div class="card panel"><h3>This practice area couldn't load</h3><p class="empty">Check your connection and try again.</p><button class="btn btn-primary" onclick={() => engine.areaRetry(key)}>Try again</button></div>
    {:else}
      <div class="qhead">
        <div><div class="eyebrow">Practice area · {V.meta.title}</div>
          <h2>{#if V.pi > V.total}Results{:else}{V.unit} <span class="num">{V.pi}</span><span> / {V.total}</span>{/if}</h2></div>
        <div class="qstats">
          <span>Answered <b class="num">{V.score.a}</b></span><span>Correct <b class="num">{V.score.c}</b></span><span>Score <b class="num">{V.score.a ? pct(V.score.c, V.score.a) + '%' : '–'}</b></span>
          {#if key === 'twelve' && V.vessel.a}<span>Vessel <b class="num">{V.vessel.c}/{V.vessel.a}</b></span>{/if}
          <a class="btn btn-ghost" href="/practice">All areas</a>
        </div>
      </div>
      <div class="progress" style="margin-bottom:16px"><i style="width:{pct(V.score.a, V.total)}%"></i></div>

      {#if V.summary}
        {@const S = V.summary}
        <div class="card panel area-sum">
          <div class="area-sum-top">
            <div><div class="eyebrow">Area score</div><h3 class="num">{V.score.c} of {V.score.a} answered correct</h3>
              <p class="empty">{S.skipped ? `${S.skipped} strip${S.skipped === 1 ? ' was' : 's were'} skipped. They don't count against your score, but you can go back to them.` : 'Every strip answered.'}</p></div>
            <div class="area-big num">{V.score.a ? pct(V.score.c, V.score.a) + '%' : '–'}</div>
          </div>
          <h4>By rhythm type</h4>
          <div class="bars">{#each S.cats as c (c.cat)}<div class="barrow"><span>{c.cat}</span><span class="track"><i style="width:{pct(c.c, c.a)}%"></i></span><b>{c.a ? c.c + '/' + c.a : '—'}</b></div>{/each}</div>
          {#if S.missed.length}
            <h4>Missed strips</h4>
            <div class="missed" id="arMissed">{#each S.missed as m (m.n)}<button onclick={() => go(m.n)}><b>#{m.n}</b><span style="color:var(--ink)">{m.name}</span></button>{/each}</div>
          {/if}
          <div class="qnav" style="justify-content:flex-start">
            <a class="btn btn-primary" href="/practice">Choose another area</a>
            <button class="btn btn-ghost" id="arReview" onclick={() => go(1)}>Review from strip 1</button>
            <span id="arReset">
              {#if confirmReset}
                <span class="confirm"><span>Clear your answers in this area?</span>
                  <button class="btn btn-primary" id="arYes" onclick={() => { engine.areaReset(key); confirmReset = false; scrollTop(); }}>Clear</button>
                  <button class="btn btn-ghost" id="arNo" onclick={() => (confirmReset = false)}>Cancel</button></span>
              {:else}<button class="btn btn-ghost" id="arAsk" onclick={() => (confirmReset = true)}>Start this area over</button>{/if}
            </span>
          </div>
        </div>
      {:else}
        <div class="card qcard">
          <div class="strip-top">
            <div class="stem"><span class="tag">{V.meta.short}</span><p>{V.q.twelve ? 'Interpret this 12-lead ECG.' : 'Identify this rhythm.'}</p></div>
            {#if V.q.hints}
              {#if V.done}
                {#if V.cardio.used}<button class="btn cardio-btn ghost" id="arCardioShow" onclick={() => engine.setCardioMin(false)}><Icon name="phone" /><span>Cardiologist</span><small>{V.cardio.revealed ? 'answer revealed' : V.cardio.used + ' hint' + (V.cardio.used === 1 ? '' : 's') + ' used'}</small></button>{/if}
              {:else if V.cardio.used < 3}
                <button class="btn cardio-btn" id="arCardioBtn" title="Each call gives you a hint. The 4th call reveals the answer and counts it as wrong." onclick={cardio}><Icon name="phone" /><span>Call the cardiologist</span><small>hint {V.cardio.used + 1} of 3</small></button>
              {:else}
                <button class="btn cardio-btn reveal" id="arCardioBtn" title="Each call gives you a hint. The 4th call reveals the answer and counts it as wrong." onclick={cardio}><Icon name="phone" /><span>Call again for the answer</span><small>counts as wrong</small></button>
              {/if}
            {/if}
          </div>
          <p class="ecg-tip"><Icon name="expand" /><span><b>Tip:</b> click the {V.q.twelve ? 'ECG' : 'strip'} to open it full screen. Zoom with + / −, the mouse wheel or a pinch, double-click to zoom in on a spot, and drag to move around.</span></p>
          <div use:ecg={ecgArgs}></div>
          {#if V.vq}
            <div class="answered-line {V.chosen === V.q.cat ? 'ok' : 'no'}">
              <span class="eyebrow">Your interpretation</span>
              <b>{V.fb.revealed ? 'Revealed by the cardiologist' : V.chosen}</b>
              <span>{V.chosen === V.q.cat ? '✓ Correct' : "✗ It's " + V.q.cat}</span>
              <Options id="arOpts" options={V.q.options} chosen={V.chosen} right={V.q.cat} onpick={pick} hidden />
            </div>
            <div class="card panel vessel-q">
              <div class="eyebrow">Follow-up question</div>
              <h4>Which coronary artery is most likely involved?</h4>
              <div class="opts" id="arVessel" role="group" aria-label="Culprit artery">
                {#each V.vq.options as o, i (o)}
                  {@const vd = V.vq.picked != null}
                  <button class="opt {vd ? (i === V.vq.right ? 'is-right' : i === V.vq.picked ? 'is-wrong' : 'is-dim') : ''}" data-v={i} disabled={vd} onclick={() => pickVessel(i)}><span class="k">{'ABCDE'[i]}</span><span>{o}</span></button>
                {/each}
              </div>
              <div aria-live="polite">
                {#if V.vq.picked != null}
                  {@const ok = V.vq.picked === V.vq.right}
                  <div class="fb {ok ? 'ok' : 'no'}"><div class="verdict">{#if ok}<Icon name="ok" />Correct{:else}<Icon name="no" />Not quite: it's the {V.vq.rightShort}{/if}</div><p class="fb-note">{V.vq.why}</p></div>
                {/if}
              </div>
            </div>
          {:else}
            <div>
              <div class="eyebrow" style="margin-bottom:10px">{V.q.twelve ? 'What does it show?' : 'Identify the rhythm'}</div>
              <Options id="arOpts" options={V.q.options} chosen={V.chosen} right={V.q.cat} onpick={pick} />
            </div>
          {/if}
          <div aria-live="polite">{#if V.fb}<Feedback fb={V.fb} {hint} />{/if}</div>
          <div class="qnav">
            <button class="btn btn-ghost" id="arPrev" disabled={V.pi === 1} onclick={() => go(V.pi - 1)}>← Previous</button>
            <button class="btn btn-primary" id="arNext" onclick={() => go(V.pi + 1)}>{V.pi === V.total ? 'See area results →' : V.done ? 'Next ' + lower(V.unit) + ' →' : 'Skip →'}</button>
          </div>
        </div>
        <details class="card grid-nav">
          <summary>All {V.total} {lower(V.unit)}s in this area</summary>
          <Dots id="arDots" dots={V.dots} onpick={go} />
          <div class="legend"><span><i style="background:var(--ok)"></i>Correct</span><span><i style="background:var(--bad)"></i>Incorrect</span><span><i style="background:var(--line-2)"></i>Not answered</span></div>
        </details>
      {/if}
    {/if}
  </div>
</section>
{#if showPop}<CardioPop cardio={V.cardio} done={V.done} {freshIdx} onmin={(m) => engine.setCardioMin(m)} />{/if}
