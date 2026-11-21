<script>
  import { onMount } from 'svelte';
  import { show } from '$lib/app/client.js';
  onMount(() => { show('practice'); });
</script>

<svelte:head><title>Practice · Cardiac Lab</title></svelte:head>

  <section class="view" id="v-practice">
    <div class="qhead"><div><div class="eyebrow">Practice</div><h2>Practice areas</h2></div></div>
    <p class="sv-lede">Pick a rhythm family and work through its 50 strips, or try the random strips at the end. Your progress in each area is saved and shared with your instructor along with your other results.</p>
    <div class="area-grid" id="practiceAreas"></div>
  </section>
