<script>
  // Owner only: instructor accounts (name, cohorts they can see, what they can do) and one-time passwords.
  import { tick } from 'svelte';
  let { b, board } = $props();
  let ed = $state(null);          // the open editor: {id?, name, cohorts:[], perms:{}, msg}
  let delId = $state(null), newCo = $state(''), copied = $state(false), nameEl;

  const known = $derived.by(() => {
    const k = Object.keys(b.cohorts);
    for (const c of ed?.cohorts ?? []) if (!k.includes(c)) k.push(c);
    return k.sort();
  });
  async function open(i) {
    ed = i ? { id: i.id, name: i.name, cohorts: [...i.cohorts], perms: { ...i.perms }, msg: '' } : { name: '', cohorts: [], perms: {}, msg: '' };
    board.instPwDone(); await tick(); nameEl?.focus();
  }
  function toggleCo(c, on) { ed.cohorts = on ? [...ed.cohorts, c] : ed.cohorts.filter((x) => x !== c); }
  function addCo() {
    const v = newCo.trim().slice(0, 40); if (!v) return;
    board.addCohort(v); if (!ed.cohorts.includes(v)) ed.cohorts = [...ed.cohorts, v]; newCo = '';
  }
  async function save(e) {
    e.preventDefault();
    const res = await board.instSave({ name: ed.name, cohorts: ed.cohorts, perms: ed.perms }, ed.id);
    if (res.ok) ed = null; else ed.msg = res.msg;
  }
  function copy() { try { navigator.clipboard.writeText(b.instPw.pw); copied = true; } catch {} }
  const permLabels = (i) => board.instPerms.filter((p) => i.perms[p.key]).map((p) => p.label.replace(/^Open or close the /, ''));
</script>

<div class="card panel sb-inst" id="sbInst">
  <div class="sv-board-head">
    <div><div class="eyebrow">Owner only</div><h3>Instructors</h3></div>
    {#if !ed}<button class="btn btn-primary" id="instAdd" onclick={() => open(null)}>Add instructor</button>{/if}
  </div>
  <p class="empty">Each instructor signs in on this page with their own password. They see only the cohorts you assign, only their students, and only the tools you tick.</p>
  {#if b.instPw}
    <div class="inst-pw" role="alert">
      <div><b>Password for {b.instPw.name}:</b> <code id="instPwVal">{b.instPw.pw}</code></div>
      <p>Copy it now and give it to them: it won't be shown again. You can reset it later.</p>
      <div class="inst-pw-a"><button class="btn btn-ghost" id="instCopy" onclick={copy}>{copied ? 'Copied' : 'Copy'}</button><button class="btn btn-ghost" id="instPwDone" onclick={() => { copied = false; board.instPwDone(); }}>Done</button></div>
    </div>
  {/if}
  {#if ed}
    <form class="inst-ed" id="instForm" onsubmit={save}>
      <h4>{ed.id ? 'Edit ' + ed.name : 'New instructor'}</h4>
      <label class="cohort"><span>Name</span><input id="instName" maxlength="60" required bind:value={ed.name} bind:this={nameEl} placeholder="e.g. Dana Lee" /></label>
      <fieldset>
        <legend>Cohorts they can see</legend>
        <div class="inst-chks">
          {#each known as c (c)}
            <label><input type="checkbox" name="instCo" value={c} checked={ed.cohorts.includes(c)} onchange={(e) => toggleCo(c, e.currentTarget.checked)} /><span>{c}</span></label>
          {:else}
            <p class="empty">No cohorts yet: add one below.</p>
          {/each}
        </div>
        <div class="inst-addco"><input id="instNewCo" maxlength="40" placeholder="Add a cohort name (as students type it)" bind:value={newCo} /><button class="btn btn-ghost" type="button" id="instAddCo" onclick={addCo}>Add</button></div>
      </fieldset>
      <fieldset>
        <legend>What they can do</legend>
        <div class="inst-chks">
          {#each board.instPerms as p (p.key)}
            <label><input type="checkbox" name="instPerm" value={p.key} bind:checked={ed.perms[p.key]} /><span>{p.label}</span></label>
          {/each}
        </div>
        <p class="empty">Everyone can view their students' scores and charts. Switches they open or close apply only to their cohorts.</p>
      </fieldset>
      {#if ed.msg}<p class="login-msg" id="instMsg" role="alert">{ed.msg}</p>{/if}
      <div class="inst-act"><button class="btn btn-primary" type="submit">{ed.id ? 'Save changes' : 'Create and show password'}</button><button class="btn btn-ghost" type="button" id="instCancel" onclick={() => (ed = null)}>Cancel</button></div>
    </form>
  {/if}
  {#if b.inst?.length}
    <div class="inst-list">
      {#each b.inst as i (i.id)}
        <div class="inst-row">
          <div class="inst-who">
            <b>{i.name}</b>
            <small>{i.cohorts.join(', ')} · {i.lastSeen ? 'last signed in ' + board.ago(i.lastSeen) : 'not signed in yet'}</small>
            <div class="inst-perms">
              {#each permLabels(i) as l (l)}<span>{l}</span>{:else}<span class="none">View scores only</span>{/each}
            </div>
          </div>
          <div class="inst-act">
            <button class="btn btn-ghost" data-iedit={i.id} onclick={() => open(i)}>Edit</button>
            <button class="btn btn-ghost" data-ireset={i.id} onclick={() => board.instReset(i.id)}>New password</button>
            {#if delId === i.id}
              <button class="btn btn-primary" onclick={() => board.instDelete(i.id).then(() => (delId = null))}>Remove {i.name}?</button>
              <button class="btn btn-ghost" onclick={() => (delId = null)}>Cancel</button>
            {:else}
              <button class="btn btn-ghost" data-idel={i.id} onclick={() => (delId = i.id)}>Remove</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else if !ed}
    <p class="empty">No instructors yet.</p>
  {/if}
</div>
