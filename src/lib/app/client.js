// Starts the course engine once (client only) and lets each page show its own view.
import { goto } from '$app/navigation';

let ready = null;
export function app() {
  if (!ready) {
    ready = (async () => {
      const [{ boot }, data] = await Promise.all([
        import('./engine.js'),
        fetch('/trainer.json', { cache: 'no-cache' }).then((r) => {
          if (!r.ok) throw new Error('Could not load the course data (' + r.status + ')');
          return r.json();
        })
      ]);
      window.TRAINER = data;
      return boot(data, (path) => goto(path));
    })();
    ready.catch(() => { ready = null; });
  }
  return ready;
}

export async function show(view, areaKey) {
  const a = await app();
  a.show(view, areaKey);
}
