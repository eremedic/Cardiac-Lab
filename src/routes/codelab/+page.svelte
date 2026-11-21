<script>
  import { onMount } from 'svelte';
  import { show } from '$lib/app/client.js';
  onMount(() => { show('codelab'); });
</script>

<svelte:head><title>Code lab · Cardiac Lab</title></svelte:head>

  <section class="view" id="v-codelab">
    <div id="clRoot"></div>
  </section>
