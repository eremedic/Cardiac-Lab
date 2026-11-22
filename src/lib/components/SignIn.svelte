<script>
  // Student sign-in on Home: name, optional cohort, and the class code when the instructor requires one.
  import { live, setProfile } from '$lib/app/live.svelte.js';
  const snap = $derived(live.snap);
</script>

<div class="card share-card signin-card">
  <div class="share-l">
    <div class="eyebrow">Student sign-in</div>
    <p>{snap ? snap.sync.share : 'Your progress is saved on this device.'}</p>
  </div>
  <div class="share-f">
    <label class="cohort" for="stuName"><span>Your name</span>
      <input id="stuName" type="text" maxlength="60" placeholder="First and last name" autocomplete="name"
        value={snap?.name ?? ''} onchange={(e) => setProfile('name', e.currentTarget.value)} />
    </label>
    <label class="cohort" for="cohort"><span>Class or cohort (optional)</span>
      <input id="cohort" type="text" maxlength="40" placeholder="e.g. PCP Spring 2026" autocomplete="off" list="cohortList"
        value={snap?.cohort ?? ''} onchange={(e) => setProfile('cohort', e.currentTarget.value)} />
      <datalist id="cohortList">
        {#each snap?.cohorts ?? [] as c (c)}<option value={c}></option>{/each}
      </datalist>
    </label>
    {#if snap?.requireCode}
      <label class="cohort" for="classCode"><span>Class code</span>
        <input id="classCode" type="text" maxlength="60" placeholder="From your instructor" autocomplete="off"
          value={snap.code} onchange={(e) => setProfile('code', e.currentTarget.value)} />
      </label>
    {/if}
  </div>
</div>
