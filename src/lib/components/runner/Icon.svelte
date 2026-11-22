<script>
  // The small feedback icons (same drawings as the original page).
  let { name } = $props();
</script>

{#if name === 'ok'}<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8.2" /><path d="M6.2 10.3l2.5 2.5 5-5.2" /></svg>
{:else if name === 'no'}<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10" cy="10" r="8.2" /><path d="M7 7l6 6M13 7l-6 6" /></svg>
{:else if name === 'bulb'}<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 15h5M8 17.5h4M10 2.5a5 5 0 0 0-3 9c.6.5 1 1.2 1 2V14h4v-.5c0-.8.4-1.5 1-2a5 5 0 0 0-3-9z" /></svg>
{:else if name === 'pt'}<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="6" r="3.2" /><path d="M3.5 17.5c.8-3.4 3.4-5.2 6.5-5.2s5.7 1.8 6.5 5.2" /></svg>
{:else if name === 'expand'}<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3h5v5M8 17H3v-5M17 3l-6 6M3 17l6-6" /></svg>
{:else if name === 'phone'}<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.2 2.8h2.4l1.2 3.4-1.7 1.1a9.6 9.6 0 0 0 5.6 5.6l1.1-1.7 3.4 1.2v2.4a1.6 1.6 0 0 1-1.7 1.6A14.2 14.2 0 0 1 3.6 4.5a1.6 1.6 0 0 1 1.6-1.7z" /></svg>
{/if}
