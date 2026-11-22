<script>
  // One practice tile (rhythm family, strips, Defib lab or Code lab). `t` comes from the engine snapshot.
  let { t } = $props();
</script>

<a class="area-tile" class:wide={t.wide} href={t.href} style="--ac:{t.color};--as:{t.soft};--ai:{t.ink}">
  <span class="area-band">
    {#if t.icon === 'bolt'}
      <span class="area-ecg area-bolt"><svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg></span>
    {:else}
      <span class="area-ecg"><svg viewBox="0 0 120 30" aria-hidden="true"><path d="M0 18h22l4-6 4 6h8l4-15 5 26 4-11h14l5-6 5 6h45" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
    {/if}
    <span class="area-count num">{t.note}</span>
  </span>
  <span class="area-body">
    <b>{t.title}</b>
    <span class="area-blurb">{t.blurb}</span>
    <span class="progress"><i style="width:{t.pct}%"></i></span>
    <span class="area-foot"><span class="num">{t.foot}</span><span class="area-go">{t.go} →</span></span>
  </span>
</a>
