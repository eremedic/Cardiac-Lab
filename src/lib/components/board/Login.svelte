<script>
  // Instructor (or owner) sign-in.
  import { onMount } from 'svelte';
  let { msg = '', onlogin } = $props();
  let pw = $state(''), input;
  onMount(() => setTimeout(() => input?.focus(), 30));
</script>

<div class="card panel login">
  <h3>Instructor sign-in</h3>
  <p class="empty">Enter the instructor password set in Netlify (INSTRUCTOR_PASSWORD) to see every student's results.</p>
  <form id="sbLogin" class="login-f" onsubmit={(e) => { e.preventDefault(); onlogin(pw); }}>
    <label class="cohort" for="sbPass"><span>Instructor password</span><input id="sbPass" type="password" autocomplete="current-password" required bind:value={pw} bind:this={input} /></label>
    <button class="btn btn-primary" type="submit">Sign in</button>
  </form>
  {#if msg}<p class="login-msg" role="alert">{msg}</p>{/if}
</div>
