<script>
  // A course-module progress ring: share answered, with the percentage in the middle.
  let { frac = 0, label = '0%' } = $props();
  const r = 26, C = 2 * Math.PI * r;
</script>

<svg class="ring" viewBox="0 0 64 64" role="img" aria-label={label + ' answered'}>
  <circle class="t" cx="32" cy="32" {r} />
  <circle class="v" cx="32" cy="32" {r} stroke-dasharray="{(C * frac).toFixed(1)} {C.toFixed(1)}" transform="rotate(-90 32 32)" />
  <text x="32" y="36.5" text-anchor="middle">{label}</text>
</svg>
