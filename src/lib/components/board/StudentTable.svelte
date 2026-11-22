<script>
  // The selected students: sortable columns, a row opens its detail (print, remove, full breakdown).
  import { tick } from 'svelte';
  let { b, board, rows, tsort = $bindable() } = $props();
  let open = $state(null), confirmDel = $state(null);
  const info = $derived(rows.map((r) => ({ r, i: board.rowInfo(r) })));

  async function sortBy(c) {
    tsort = tsort && tsort.key === c.key ? { key: c.key, dir: -tsort.dir } : { key: c.key, dir: c.dir };
    await tick(); document.querySelector('[data-tsort="' + c.key + '"]')?.focus();
  }
  function toggle(id) { open = open === id ? null : id; confirmDel = null; }
  function mini(c, t) { return t ? Math.round((100 * c) / t) : 0; }
</script>

<div class="card panel">
  <h3>Students <span class="num">{rows.length}</span></h3>
  <div class="tablewrap">
    <table class="sbt">
      <thead>
        <tr>
          {#each board.sortCols as c (c.key)}
            {@const on = tsort && tsort.key === c.key}
            <th aria-sort={on ? (tsort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
              <button class="th-sort" class:on data-tsort={c.key} onclick={() => sortBy(c)}>{c.label}<span aria-hidden="true">{on ? (tsort.dir > 0 ? '▲' : '▼') : '↕'}</span></button>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody id="sbRows">
        {#each info as { r, i } (r.id)}
          <tr class="row" class:open={open === r.id} data-id={r.id} tabindex="0" aria-expanded={open === r.id}
            onclick={() => toggle(r.id)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(r.id); } }}>
            <td>
              <div class="who">
                <div><b>{i.name}</b>{#if i.cohort}<small>{i.cohort}</small>{/if}</div>
                {#if b.perms.print}
                  <button class="btn btn-ghost sb-pr1" data-print={r.id} title="Print {i.name}'s report" aria-label="Print {i.name}'s report" onclick={(e) => { e.stopPropagation(); board.printOne(r.id); }}>
                    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 7.5V3h9v4.5M5.5 14.5H4a1.5 1.5 0 0 1-1.5-1.5V9A1.5 1.5 0 0 1 4 7.5h12A1.5 1.5 0 0 1 17.5 9v4a1.5 1.5 0 0 1-1.5 1.5h-1.5" /><path d="M5.5 11.5h9V17h-9z" /></svg><span>Print</span>
                  </button>
                {/if}
              </div>
            </td>
            <td class="mono">{i.sc} / {i.sa}<br /><small style="color:var(--muted)">of {i.n} answered</small></td>
            <td class="mono">{i.mc} / {i.ma}<br /><small style="color:var(--muted)">of {i.total} answered</small></td>
            <td>{#if i.answered}<div class="mini"><span class="track"><i style="width:{mini(i.sc + i.mc, i.answered)}%"></i></span><b>{mini(i.sc + i.mc, i.answered)}%</b></div>{:else}—{/if}</td>
            <td>{i.weak}</td>
            <td class="sv-cell">{#if i.survey}<span class="sv-done">✓ Done</span>{:else}—{/if}</td>
            <td class="mono">{@html i.practice}</td>
            <td class="mono">{@html i.defib}</td>
            <td class="mono">{i.ago}</td>
          </tr>
          {#if open === r.id}
            {@const d = board.detail(r)}
            <tr class="detail">
              <td colspan="9">
                <div class="inner">
                  <div>
                    {@html d.left}
                    <div style="margin-top:14px">
                      {#if b.perms.print}
                        <button class="btn btn-ghost" data-print={r.id} onclick={() => board.printOne(r.id)}>Print report</button>
                        {#if b.perms.survey}<button class="btn btn-ghost" data-print-sv={r.id} onclick={() => board.printSurvey([r.id], i.name, true)}>Print survey answers</button>{/if}
                      {/if}
                      {#if b.perms.delete}
                        {#if confirmDel === r.id}
                          <div class="confirm">
                            <span>Remove {i.name}'s results permanently?</span>
                            <button class="btn btn-primary" data-del-yes={r.id} onclick={() => board.deleteStudent(r.id).then(() => { open = null; confirmDel = null; })}>Remove</button>
                            <button class="btn btn-ghost" data-del-no="1" onclick={() => (confirmDel = null)}>Cancel</button>
                          </div>
                        {:else}
                          <button class="btn btn-ghost" data-del={r.id} onclick={() => (confirmDel = r.id)}>Remove this student</button>
                        {/if}
                      {/if}
                    </div>
                  </div>
                  <div>{@html d.right}</div>
                </div>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
  <p class="empty">Scores are correct out of answered, so unanswered items don't lower them. Select a student for detail.</p>
</div>
