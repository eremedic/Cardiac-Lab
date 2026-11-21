<script>
  import { onMount } from 'svelte';
  import { show } from '$lib/app/client.js';
  onMount(() => { show('strips'); });
</script>

<svelte:head><title>Random ECG Practice Strips · Cardiac Lab</title></svelte:head>

  <section class="view" id="v-strips">
    <div class="qhead">
      <div><div class="eyebrow">Practice · Random ECG Practice Strips</div><h2>Strip <span id="sNum" class="num">1</span><span> / <span class="nStrips">102</span></span></h2></div>
      <div class="qstats"><span>Answered <b id="sAns" class="num">0</b></span><span>Correct <b id="sCor" class="num">0</b></span><span>Score <b id="sPct" class="num">–</b></span></div>
    </div>
    <div class="progress" style="margin-bottom:16px"><i id="sBar" style="width:0"></i></div>
    <div class="card qcard">
      <div class="stem"><span class="tag">Scenario</span><p id="sStem"></p></div>
      <div>
        <p class="ecg-tip"><span class="ecg-tip-ic" aria-hidden="true">⤢</span><span><b>Tip:</b> click the strip to open it full screen. Zoom with + / −, the mouse wheel or a pinch, double-click to zoom in on a spot, and drag to move around.</span></p>
        <div class="paper" id="sPaper"></div>
        <div class="paper-meta"><span>Lead II · 25 mm/s · 6-second strip</span><span class="scroll-hint">Swipe to see the whole strip →</span></div>
      </div>
      <div>
        <div class="eyebrow" style="margin-bottom:10px">Identify the rhythm</div>
        <div class="opts" id="sOpts" role="group" aria-label="Answer choices"></div>
      </div>
      <div id="sFb" aria-live="polite"></div>
      <div class="qnav">
        <button class="btn btn-ghost" id="sPrev">← Previous</button>
        <button class="btn btn-primary" id="sNext">Next strip →</button>
      </div>
    </div>
    <details class="card grid-nav" id="sGrid">
      <summary>All <span class="nStrips">102</span> strips</summary>
      <div class="dots" id="sDots"></div>
      <div class="legend"><span><i style="background:var(--ok)"></i>Correct</span><span><i style="background:var(--bad)"></i>Incorrect</span><span><i style="background:var(--line-2)"></i>Not answered</span></div>
    </details>
  </section>
