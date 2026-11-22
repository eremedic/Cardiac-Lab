<script>
  // One survey question of any type. `answers` is the shared answer object; this writes answers[q.id].
  import Scale from './Scale.svelte';
  let { q, n, def, answers = $bindable(), bad = false } = $props();

  const max = $derived(q.maxPicks || (q.options ? q.options.length : 0));
  const picked = $derived(Array.isArray(answers[q.id]) ? answers[q.id] : []);
  function toggle(o, on) {
    const cur = picked.filter((x) => x !== o);
    if (on) cur.push(o);
    if (cur.length) answers[q.id] = q.options.filter((x) => cur.includes(x)); else delete answers[q.id];
  }
  function conf(part, v) { answers[q.id] = { before: null, now: null, ...(answers[q.id] || {}), [part]: v }; }
</script>

<fieldset class="sv-q" class:sv-bad={bad} id="svq-{q.id}">
  <legend><span class="num">{n}.</span> {q.text}{#if !q.required}{' '}<em>(optional)</em>{/if}</legend>
  {#if q.type === 'choice'}
    <div class="sv-choices">
      {#each q.options as o, i (o)}
        <input type="radio" id="sv-{q.id}-{i}" name={q.id} value={o} checked={answers[q.id] === o} onchange={() => (answers[q.id] = o)} />
        <label for="sv-{q.id}-{i}">{o}</label>
      {/each}
    </div>
  {:else if q.type === 'multi'}
    <div class="sv-choices">
      {#each q.options as o, i (o)}
        {@const on = picked.includes(o)}
        <input type="checkbox" id="sv-{q.id}-{i}" name={q.id} value={o} checked={on} disabled={!on && picked.length >= max} onchange={(e) => toggle(o, e.currentTarget.checked)} />
        <label for="sv-{q.id}-{i}">{o}</label>
      {/each}
    </div>
    <div class="sv-ends"><span>{picked.length} of {max} chosen</span></div>
  {:else if q.type === 'likert'}
    <Scale name={q.id} text={q.text} kind="likert" lo={1} hi={5} labels={def.likert} bind:value={answers[q.id]} />
  {:else if q.type === 'stars'}
    <Scale name={q.id} text={q.text} kind="stars" lo={1} hi={5} ends={['Poor', 'Excellent']} bind:value={answers[q.id]} />
  {:else if q.type === 'nps'}
    <Scale name={q.id} text={q.text} kind="nps" lo={0} hi={10} ends={['Not at all likely', 'Extremely likely']} bind:value={answers[q.id]} />
  {:else if q.type === 'confidence'}
    <div class="sv-conf">
      <span class="sv-when">Before this course</span>
      <Scale name="{q.id}__before" text={q.text} kind="conf" lo={1} hi={5} value={answers[q.id]?.before} onpick={(v) => conf('before', v)} />
      <span class="sv-when">Now</span>
      <Scale name="{q.id}__now" text={q.text} kind="conf" lo={1} hi={5} value={answers[q.id]?.now} onpick={(v) => conf('now', v)} />
    </div>
    <div class="sv-ends"><span>1 = {def.confidence[0]}</span><span>5 = {def.confidence[4]}</span></div>
  {:else if q.type === 'text'}
    <textarea name={q.id} id="sv-{q.id}" rows="3" maxlength={q.max || 1000} aria-label={q.text}
      value={answers[q.id] ?? ''} oninput={(e) => { const t = e.currentTarget.value; if (t.trim()) answers[q.id] = t; else delete answers[q.id]; }}></textarea>
  {/if}
</fieldset>
