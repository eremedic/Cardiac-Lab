// The practice areas that exist (12-lead and field strips are opened by the instructor, but their pages always exist).
export function entries() {
  return ['sinus', 'atrial', 'junctional', 'ventricular', 'block', 'paced', 'twelve', 'field'].map((area) => ({ area }));
}
