<script>
  import { onMount } from 'svelte';
  import { show } from '$lib/app/client.js';
  onMount(() => { show('home'); });
</script>

<svelte:head><title>CSHealthED Cardiac Lab · ECG &amp; Megacode Training</title></svelte:head>

  <section class="view" id="v-home">
    <div class="hero">
      <div class="hero-copy">
        <div class="logo-badge"><img src="/img/logo.webp" width="190" alt="CSHealthED, Healthcare Education Software"></div>
        <h1>Read the strip.<br><em>Run the code.</em></h1>
        <p class="lede">Work through <span class="nStrips">102</span> six-second rhythm strips with instant feedback, then manage 20 cardiac arrest megacodes decision by decision. Every wrong answer explains what you missed, and your score is tallied at the end.</p>
      </div>
      <div class="hero-right">
      <div class="monitor" aria-label="Animated monitor showing normal sinus rhythm">
        <div class="mon-top"><span class="live">Lead II · Monitor</span><span>25 mm/s · 10 mm/mV</span></div>
        <div class="mon-body">
          <div class="mon-screen" id="heroScreen"></div>
          <div class="vitals">
            <div class="vital hr"><small>HR</small><b class="num">75</b></div>
            <div class="vital bp"><small>NIBP</small><b class="num">124/78</b></div>
            <div class="vital sp"><small>SpO₂</small><b class="num">98</b></div>
            <div class="vital co"><small>ETCO₂</small><b class="num">38</b></div>
          </div>
        </div>
      </div>
    <div class="card share-card signin-card">
      <div class="share-l"><div class="eyebrow">Student sign-in</div><p id="shareMsg">Your progress is saved on this device.</p></div>
      <div class="share-f">
        <label class="cohort" for="stuName"><span>Your name</span><input id="stuName" type="text" maxlength="60" placeholder="First and last name" autocomplete="name"></label>
        <label class="cohort" for="cohort"><span>Class or cohort (optional)</span><input id="cohort" type="text" maxlength="40" placeholder="e.g. PCP Spring 2026" autocomplete="off" list="cohortList"><datalist id="cohortList"></datalist></label>
        <label class="cohort" for="classCode" id="codeWrap"><span>Class code</span><input id="classCode" type="text" maxlength="60" placeholder="From your instructor" autocomplete="off"></label>
      </div>
    </div>
        <a class="btn btn-primary go-course" href="/course">Go to the course →</a>
      </div>
    </div>
  </section>
