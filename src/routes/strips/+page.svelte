<script>
  import { onMount, tick } from 'svelte';
  import { show } from '$lib/app/client.js';
  import { live, connect } from '$lib/app/live.svelte.js';
  import Feedback from '$lib/components/runner/Feedback.svelte';
  import Options from '$lib/components/runner/Options.svelte';
  import Dots from '$lib/components/runner/Dots.svelte';
  import { scrollTop, revealIfLow, typing } from '$lib/components/runner/scroll.js';

  let engine = $state(null);
  let hint = $state(null);
  let fbBox = $state(null);
  onMount(async () => { engine = await connect(); show('strips'); });

  // Recomputed whenever the engine reports a change.
  const V = $derived(live.snap && engine ? engine.stripView() : null);
  const pct = (c, t) => (t ? Math.round((100 * c) / t) : 0);

  // The strip itself is drawn by the engine (calipers and the markup attach to it).
  function paper(node, a) {
    let last = '';
    const run = (a) => {
      if (!a || a.sig === last) return;
      last = a.sig;
      hint = engine.drawStripPaper(node, a.key, a.cat, a.mark);
    };
    run(a);
    return { update: run };
  }
  const paperArgs = $derived(V ? { sig: V.q.strip + '|' + (V.chosen ?? ''), key: V.q.strip, cat: V.q.cat, mark: V.done && V.chosen !== V.q.cat } : null);

  async function pick(o) { engine.stripAnswer(o); await tick(); revealIfLow(fbBox?.firstElementChild ? fbBox : null); }
  function go(n) { engine.stripGo(n); scrollTop(); }
  function next() { engine.stripNext(); scrollTop(); }
  function onkey(e) {
    if (!V || typing(e)) return;
    const k = e.key.toUpperCase(), idx = 'ABCD'.indexOf(k);
    if (idx >= 0 && e.key.length === 1) { if (!V.done && V.q.options[idx]) pick(V.q.options[idx]); }
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft' && V.pi > 1) go(V.pi - 1);
  }
</script>

<svelte:window onkeydown={onkey} />
<svelte:head><title>Random ECG Practice Strips · Cardiac Lab</title></svelte:head>

<section class="view" id="v-strips">
  <div class="qhead">
    <div><div class="eyebrow">Practice · Random ECG Practice Strips</div><h2>Strip <span class="num">{V?.pi ?? 1}</span><span> / <span class="nStrips">{V?.n ?? 102}</span></span></h2></div>
    <div class="qstats"><span>Answered <b class="num">{V?.score.a ?? 0}</b></span><span>Correct <b class="num">{V?.score.c ?? 0}</b></span><span>Score <b class="num">{V && V.score.a ? pct(V.score.c, V.score.a) + '%' : '–'}</b></span></div>
  </div>
  <div class="progress" style="margin-bottom:16px"><i style="width:{V ? pct(V.score.a, V.n) : 0}%"></i></div>
  <div class="card qcard">
    <div class="stem"><span class="tag">Scenario</span><p>{V?.q.stem ?? ''}</p></div>
    <div>
      <p class="ecg-tip"><span class="ecg-tip-ic" aria-hidden="true">⤢</span><span><b>Tip:</b> click the strip to open it full screen. Zoom with + / −, the mouse wheel or a pinch, double-click to zoom in on a spot, and drag to move around.</span></p>
      {#if V}<div class="paper" id="sPaper" use:paper={paperArgs}></div>{:else}<div class="paper" id="sPaper"></div>{/if}
      <div class="paper-meta"><span>Lead II · 25 mm/s · 6-second strip</span><span class="scroll-hint">Swipe to see the whole strip →</span></div>
    </div>
    <div>
      <div class="eyebrow" style="margin-bottom:10px">Identify the rhythm</div>
      {#if V}<Options id="sOpts" options={V.q.options} chosen={V.chosen} right={V.q.cat} onpick={pick} />{/if}
    </div>
    <div id="sFb" aria-live="polite" bind:this={fbBox}>{#if V?.fb}<Feedback fb={V.fb} {hint} />{/if}</div>
    <div class="qnav">
      <button class="btn btn-ghost" id="sPrev" disabled={!V || V.pi === 1} onclick={() => go(V.pi - 1)}>← Previous</button>
      <button class="btn btn-primary" id="sNext" onclick={next}>{!V ? 'Next strip →' : V.pi === V.n ? 'See results →' : V.done ? 'Next strip →' : 'Skip →'}</button>
    </div>
  </div>
  <details class="card grid-nav" id="sGrid">
    <summary>All <span class="nStrips">{V?.n ?? 102}</span> strips</summary>
    {#if V}<Dots id="sDots" dots={V.dots} onpick={go} />{/if}
    <div class="legend"><span><i style="background:var(--ok)"></i>Correct</span><span><i style="background:var(--bad)"></i>Incorrect</span><span><i style="background:var(--line-2)"></i>Not answered</span></div>
  </details>
</section>
