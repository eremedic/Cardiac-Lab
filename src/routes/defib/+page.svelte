<script>
  import { onMount } from 'svelte';
  import { show } from '$lib/app/client.js';
  onMount(() => { show('defib'); });
</script>

<svelte:head><title>Defib lab · Cardiac Lab</title></svelte:head>

  <section class="view" id="v-defib">
    <div id="dfRoot"></div>
  </section>
