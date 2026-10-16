// Show a useful message instead of leaving visitors at "Opening Northstar…".
// This script runs before app.js so it also detects module-loading failures.
(() => {
  let failure = '';
  window.addEventListener('error', event => {
    if (document.documentElement.dataset.northstarReady !== 'true') {
      failure = event.message || 'A JavaScript file did not load.';
      console.error('Northstar initialization error:', failure);
    }
  });
  window.addEventListener('unhandledrejection', event => {
    if (document.documentElement.dataset.northstarReady !== 'true') {
      failure = String(event.reason || 'A startup request failed.');
      console.error('Northstar initialization error:', failure);
    }
  });
  window.setTimeout(() => {
    if (document.documentElement.dataset.northstarReady === 'true') return;
    const main = document.getElementById('main');
    if (!main || !main.textContent.includes('Opening Northstar')) return;
    const section = document.createElement('section');
    section.className = 'section';
    const box = document.createElement('div');
    box.className = 'container';
    const h1 = document.createElement('h1');
    h1.textContent = 'Northstar could not load.';
    const p = document.createElement('p');
    p.textContent = 'Try Ctrl + Shift + R to refresh the website. If the problem continues, open F12 > Console and share the first red error.';
    const details = document.createElement('p');
    details.className = 'muted';
    details.textContent = failure ? 'Error: ' + failure : 'Loading took too long. Check that npm run dev is still running.';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-primary';
    button.textContent = 'Reload website';
    button.addEventListener('click', () => window.location.reload());
    box.append(h1, p, details, button);
    section.append(box);
    main.replaceChildren(section);
  }, 8000);
})();
