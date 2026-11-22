// Scrolling helpers shared by the runners (respect reduced motion like the original page).
const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
export function scrollTop() { window.scrollTo({ top: 0, behavior: smooth() }); }
export function revealIfLow(el, frac = 0.8, block = 'nearest') {
  if (el && el.getBoundingClientRect().top > window.innerHeight * frac) el.scrollIntoView({ behavior: smooth(), block });
}
export function revealNearest(el, block = 'nearest') { if (el) el.scrollIntoView({ behavior: smooth(), block }); }
// True when a key press belongs to a text field or the calipers, so the runner shortcuts should ignore it.
export function typing(e) { return !!(e.target && e.target.closest && e.target.closest('input,textarea,.cal-ov')); }
