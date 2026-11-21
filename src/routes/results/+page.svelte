<script>
  import { onMount } from 'svelte';
  import { show } from '$lib/app/client.js';
  onMount(() => { show('results'); });
</script>

<svelte:head><title>Results · Cardiac Lab</title></svelte:head>

  <section class="view" id="v-results">
    <div class="card sv-home" id="rSurvey"></div>
    <div id="rBody"></div>
  </section>
