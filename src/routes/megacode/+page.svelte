<script>
  import { onMount } from 'svelte';
  import { show } from '$lib/app/client.js';
  onMount(() => { show('megacode'); });
</script>

<svelte:head><title>Megacode · Cardiac Lab</title></svelte:head>

  <section class="view" id="v-megacode">
    <div id="mList">
      <div class="qhead">
        <div><div class="eyebrow">Module 2 · Cardiac arrest management</div><h2>Megacode cases</h2></div>
        <div class="qstats"><span>Decisions correct <b id="mCor" class="num">0</b> / <b id="mTot" class="num">0</b></span></div>
      </div>
      <div class="cases" id="mCases"></div>
    </div>
    <div id="mRun" hidden></div>
  </section>
