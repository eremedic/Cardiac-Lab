<script>
  import { onMount } from 'svelte';
  import { show } from '$lib/app/client.js';
  onMount(() => { show('survey'); });
</script>

<svelte:head><title>Course survey · Cardiac Lab</title></svelte:head>

  <section class="view" id="v-survey">
    <div id="svBody"></div>
  </section>
