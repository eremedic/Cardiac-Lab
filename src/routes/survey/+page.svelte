<script>
  import { onMount, tick, untrack } from 'svelte';
  import { show } from '$lib/app/client.js';
  import { live, connect } from '$lib/app/live.svelte.js';
  import SurveyPrompt from '$lib/components/SurveyPrompt.svelte';
  import Question from '$lib/components/survey/Question.svelte';

  let engine = $state(null);
  let def = $state(null), loadErr = $state(false);
  let answers = $state({}), anon = $state(false), name = $state(''), code = $state('');
  let editing = $state(false), sending = $state(false), msg = $state(''), missing = $state(null);

  onMount(async () => { engine = await connect(); show('survey'); });
  // Survey status from the engine (refreshes when progress, sync or settings change).
  const info = $derived(live.snap && engine ? engine.surveyInfo() : null);
  const formOpen = $derived(!!info && info.state !== 'locked' && info.online && (info.state === 'open' || editing));

  async function loadForm() {
    loadErr = false;
    try {
      def = await engine.surveyDef();
      const i = engine.surveyInfo();
      answers = i.draft; anon = i.draftAnon;
    } catch { loadErr = true; }
  }
  $effect(() => { if (formOpen && !def && !loadErr) loadForm(); });
  // Keep a draft as the student answers, so nothing is lost if they leave the page.
  $effect(() => {
    if (!def || !formOpen) return;
    const a = $state.snapshot(answers);
    engine.saveSurveyDraft(a, anon);
    // After a submit attempt, keep the highlights and the message current as questions get answered.
    untrack(() => { if (missing) { missing = findMissing(a); msg = missing.length ? missMsg(missing) : ''; } });
  });

  const questions = $derived(def ? def.sections.flatMap((s) => s.questions) : []);
  function findMissing(a) {
    return questions.filter((q) => {
      if (!q.required) return false;
      const v = a[q.id];
      if (q.type === 'confidence') return !v || v.before == null || v.now == null;
      if (q.type === 'multi') return !v || !v.length;
      return v === undefined || v === null || v === '';
    }).map((q) => q.id);
  }
  const missMsg = (m) => (m.length === 1 ? 'One required question still needs an answer.' : m.length + ' required questions still need an answer.');

  async function submit(e) {
    e.preventDefault();
    if (sending) return;
    if (info.needName && !name.trim()) { msg = 'Enter your name at the top of the survey.'; document.getElementById('svName')?.focus(); return; }
    if (info.needCode && !code.trim()) { msg = 'Enter the class code from your instructor at the top of the survey.'; document.getElementById('svCode')?.focus(); return; }
    const a = $state.snapshot(answers);
    for (const q of questions) if (q.type === 'text' && typeof a[q.id] === 'string') { a[q.id] = a[q.id].trim(); if (!a[q.id]) delete a[q.id]; }
    const miss = findMissing(a);
    if (miss.length) {
      missing = miss; msg = missMsg(miss);
      await tick(); document.getElementById('svq-' + miss[0])?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    missing = null; sending = true; msg = 'Sending…';
    const res = await engine.sendSurvey(a, anon, info.needName ? name : null, info.needCode ? code : null);
    sending = false;
    if (res.ok) { editing = false; msg = ''; def = null; window.scrollTo({ top: 0 }); } else msg = res.msg;
  }
  function cancel() { editing = false; msg = ''; missing = null; def = null; window.scrollTo({ top: 0 }); }
  const numbered = $derived.by(() => { let i = 0; return (def?.sections ?? []).map((s) => ({ ...s, qs: s.questions.map((q) => ({ q, n: ++i })) })); });
</script>

<svelte:head><title>Course survey · Cardiac Lab</title></svelte:head>

<section class="view" id="v-survey">
  <div class="qhead"><div><div class="eyebrow">Course survey</div><h2>Tell us about the course</h2></div></div>
  {#if !info}
    <div class="card panel"><p class="empty">Loading the survey…</p></div>
  {:else if info.state === 'locked'}
    <div class="card panel">
      <SurveyPrompt sv={live.snap.survey} />
      <div class="qnav" style="justify-content:flex-start"><a class="btn btn-primary" href="/strips">Go to strips</a><a class="btn btn-ghost" href="/megacode">Go to megacode</a></div>
    </div>
  {:else if !info.online && !info.configDone}
    <div class="card panel"><p class="empty">Loading the survey…</p></div>
  {:else if !info.online}
    <div class="card panel"><h3>The survey isn't available on this site yet</h3><p class="empty">Survey answers are sent to your instructor, and score sharing isn't switched on here. Ask your instructor about it.</p></div>
  {:else if info.state === 'done' && !editing}
    <div class="card panel sv-thanks">
      <span class="sv-ic"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3.5" width="12" height="14" rx="2" /><path d="M7.5 3.5h5v2.5h-5zM7 10l2 2 4-4" /></svg></span>
      <h3>Thank you, {info.name}</h3>
      <p>Your survey was submitted {info.doneAgo}{info.anon ? ' with your name hidden next to your answers' : ''}. Your instructor can see your responses on the scoreboard.</p>
      <div class="qnav" style="justify-content:flex-start"><button class="btn btn-ghost" onclick={() => (editing = true)}>Edit my answers</button><a class="btn btn-primary" href="/results">See my results</a></div>
    </div>
  {:else if loadErr}
    <div class="card panel"><h3>The survey couldn't load</h3><p class="empty">Check your connection and try again.</p><button class="btn btn-primary" onclick={loadForm}>Try again</button></div>
  {:else if !def}
    <div class="card panel"><p class="empty">Loading the survey…</p></div>
  {:else}
    <p class="sv-lede">Thanks for working through the course. This survey takes about 4 minutes, and you can update your answers later. Questions marked (optional) can be skipped.</p>
    <form id="svForm" novalidate onsubmit={submit}>
      {#if info.needName || info.needCode}
        <div class="card sv-sec sv-who">
          <h3>Before you start</h3>
          <p class="empty">Your survey is sent to your instructor along with your results.</p>
          <div class="share-f">
            {#if info.needName}<label class="cohort" for="svName"><span>Your name</span><input id="svName" type="text" maxlength="60" autocomplete="name" bind:value={name} /></label>{/if}
            {#if info.needCode}<label class="cohort" for="svCode"><span>Class code</span><input id="svCode" type="text" maxlength="60" autocomplete="off" bind:value={code} /></label>{/if}
          </div>
        </div>
      {/if}
      {#each numbered as s (s.title)}
        <section class="card sv-sec">
          <h3>{s.title}</h3>
          {#if s.intro}<p class="sv-intro">{s.intro}</p>{/if}
          {#each s.qs as item (item.q.id)}
            <Question q={item.q} n={item.n} def={def} bind:answers bad={!!missing && missing.includes(item.q.id)} />
          {/each}
        </section>
      {/each}
      <div class="card sv-sec sv-submit">
        <label class="sv-anon" for="svAnon"><input type="checkbox" id="svAnon" bind:checked={anon} /><span><b>Hide my name next to my answers</b><br />Your instructor will see that you completed the survey, but your answers and comments are listed as "Anonymous".</span></label>
        <div class="sv-msg" role="alert">{msg}</div>
        <div class="qnav" style="justify-content:flex-start">
          <button class="btn btn-primary" type="submit" disabled={sending}>{info.state === 'done' ? 'Update my answers' : 'Submit survey'}</button>
          {#if info.state === 'done'}<button class="btn btn-ghost" type="button" onclick={cancel}>Cancel</button>{/if}
        </div>
      </div>
    </form>
  {/if}
</section>
