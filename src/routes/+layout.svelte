<script>
  import '../app.css';
  import { page } from '$app/state';

  let { children } = $props();

  // Defib lab and Code lab tabs start hidden; the engine shows them when the instructor opens those modules.
  const TABS = [
    { href: '/', v: 'home', label: 'Home' },
    { href: '/course', v: 'course', label: 'Course' },
    { href: '/practice', v: 'practice', label: 'Practice' },
    { href: '/megacode', v: 'megacode', label: 'Megacode' },
    { href: '/defib', v: 'defib', label: 'Defib lab', id: 'tabDefib', hidden: true },
    { href: '/codelab', v: 'codelab', label: 'Code lab', id: 'tabCode', hidden: true },
    { href: '/results', v: 'results', label: 'Results' },
    { href: '/survey', v: 'survey', label: 'Survey' },
    { href: '/instructor', v: 'instructor', label: 'Instructor sign-in', id: 'tabBoard' }
  ];
  // The strips and each practice area live under Practice.
  const tab = $derived.by(() => {
    const p = page.url.pathname;
    if (p === '/') return 'home';
    const first = p.split('/')[1];
    return first === 'strips' ? 'practice' : first;
  });
</script>

<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <pattern id="pMinor" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" style="stroke:var(--grid-minor)" stroke-width="1.2" vector-effect="non-scaling-stroke"/></pattern>
    <pattern id="pMajor" width="200" height="200" patternUnits="userSpaceOnUse"><rect width="200" height="200" fill="url(#pMinor)"/><path d="M200 0H0V200" fill="none" style="stroke:var(--grid-major)" stroke-width="2.2" vector-effect="non-scaling-stroke"/></pattern>
    <pattern id="mMinor" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" style="stroke:var(--mon-grid)" stroke-width="1" vector-effect="non-scaling-stroke"/></pattern>
    <pattern id="mMajor" width="200" height="200" patternUnits="userSpaceOnUse"><rect width="200" height="200" fill="url(#mMinor)"/><path d="M200 0H0V200" fill="none" style="stroke:var(--mon-grid-2)" stroke-width="1.6" vector-effect="non-scaling-stroke"/></pattern>
  </defs>
</svg>

<header class="bar">
  <div class="wrap">
    <a class="brand" href="/" aria-label="CSHealthED ECG and Megacode Lab home">
      <img src="/img/logo-mark.webp" width="40" height="40" alt="">
      <span class="wm"><b><span class="cs">CS</span><span class="hl">Health</span><span class="ed">ED</span></b><small>ECG &amp; Megacode Lab</small></span>
    </a>
    <nav class="tabs" aria-label="Sections">
      {#each TABS as t (t.href)}
        <a href={t.href} id={t.id} hidden={t.hidden} aria-current={tab === t.v ? 'page' : undefined}>{t.label}</a>
      {/each}
    </nav>
    <div class="tally" aria-live="polite">
      <span class="chip">Strips <b class="num" id="tStrips">0/0</b></span>
      <span class="chip sync" id="tSync" data-s="local">Saved on this device</span>
      <span class="chip">Megacode <b class="num" id="tMega">0/0</b></span>
    </div>
  </div>
</header>

<main class="wrap">
  {@render children()}
</main>
<footer class="foot">
  <div class="wrap foot-in">
    <div class="logo-badge sm"><img src="/img/logo.webp" width="120" alt="CSHealthED, Healthcare Education Software"></div>
    <p class="note">Strips are synthetic lead II teaching tracings at 25 mm/s: 1 small box = 0.04 s, 1 large box = 0.20 s. Treatment content follows the adult ACLS algorithms. Always follow your local protocols and medical direction.</p>
  </div>
</footer>
<aside class="cardio-pop" id="cardioPop" hidden aria-label="Cardiologist hints"></aside>
