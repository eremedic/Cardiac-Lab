<script>
  import { page } from '$app/state';
  import { show } from '$lib/app/client.js';
  // Re-run when moving between areas (/practice/sinus -> /practice/block) without leaving the page.
  $effect(() => { const key = page.params.area; show('area', key); });
</script>

<svelte:head><title>Practice area · Cardiac Lab</title></svelte:head>

  <section class="view" id="v-area">
    <div id="arBody"></div>
  </section>
