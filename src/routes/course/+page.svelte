<script>
  import { onMount } from 'svelte';
  import { show } from '$lib/app/client.js';
  onMount(() => { show('course'); });
</script>

<svelte:head><title>Course · Cardiac Lab</title></svelte:head>

  <section class="view" id="v-course">
    <div class="qhead"><div><div class="eyebrow">Your course</div><h2>Modules and practice</h2></div></div>
    <div class="modules">
      <article class="card module m-strips">
        <div class="band">
          <div class="band-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 13h4l2-6 3 12 3-9 2 3h6"/></svg></div>
          <div class="band-t"><div class="eyebrow">Module 1</div><h2>Random ECG Practice Strips</h2></div>
          <svg class="ring" viewBox="0 0 64 64" id="ringStrips"></svg>
        </div>
        <div class="module-b">
          <p>Choose the rhythm, then see the full interpretation: rate, regularity, P waves, PR, QRS and the field action.</p>
          <ul class="families"><li class="f-sinus">Sinus</li><li class="f-atrial">Atrial</li><li class="f-junc">Junctional</li><li class="f-vent">Ventricular</li><li class="f-block">AV blocks</li><li class="f-paced">Paced</li></ul>
          <p class="small">17 unique strips in each family. When you're wrong, a side-by-side shows how your choice differs.</p>
          <div class="actions"><a class="btn btn-primary" href="/strips" id="goStrips">Start strips</a></div>
        </div>
      </article>
      <article class="card module m-mega">
        <div class="band">
          <div class="band-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg></div>
          <div class="band-t"><div class="eyebrow">Module 2</div><h2>20 ACLS megacodes</h2></div>
          <svg class="ring" viewBox="0 0 64 64" id="ringMega"></svg>
        </div>
        <div class="module-b">
          <p>Each case unfolds on a live monitor. Read the rhythm and vitals, choose the next treatment, and get the rationale for every option.</p>
          <ul class="checks"><li>VF/pVT, asystole/PEA and refractory VF</li><li>Bradycardia, pacing and unstable VT</li><li>Special circumstances and post-ROSC care</li></ul>
          <div class="actions"><a class="btn btn-primary" href="/megacode">Open megacodes</a></div>
        </div>
      </article>
    </div>
    <section class="area-sec" aria-labelledby="areasTitle">
      <div class="area-head"><div><div class="eyebrow">Practice by rhythm family</div><h2 id="areasTitle">Six practice areas, 50 strips each</h2></div><p>Drill one family at a time. Every strip is different and follows the rules of the rhythm it shows.</p></div>
      <div class="area-grid" id="homeAreas"></div>
    </section>
    <div id="homeDefib"></div>
    <div class="card sv-home" id="homeSurvey"></div>
    <div class="card method">
      <div class="lab">Use the same five steps on every strip</div>
      <div class="st s1"><i>1</i><div><b>Rate</b><span>QRS in 6 s × 10</span></div></div>
      <div class="st s2"><i>2</i><div><b>Rhythm</b><span>Regular or irregular?</span></div></div>
      <div class="st s3"><i>3</i><div><b>P waves</b><span>Present, upright, 1:1?</span></div></div>
      <div class="st s4"><i>4</i><div><b>PR</b><span>0.12–0.20 s, constant?</span></div></div>
      <div class="st s5"><i>5</i><div><b>QRS</b><span>&lt; 0.12 s is narrow</span></div></div>
    </div>
  </section>
