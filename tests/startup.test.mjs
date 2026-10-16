import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from '../server/app.mjs';
import { openDatabase } from '../server/db.mjs';

const clientFiles = ['/startup.js', '/app.js', '/museum-ui.js', '/features-ui.js', '/student-ui.js'];

test('homepage includes cache-busted entry points and a startup diagnostics script', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /startup\.js\?v=2\.4\.3/);
  assert.match(html, /app\.js\?v=2\.4\.3/);
  assert.match(readFileSync(new URL('../public/startup.js', import.meta.url), 'utf8'), /Opening Northstar/);
});

test('every browser JavaScript module is served as JavaScript, not the SPA HTML fallback', async () => {
  const db = openDatabase(':memory:');
  const server = createServer({ db });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const path of clientFiles) {
      const response = await fetch(`${base}${path}?v=2.4.3`);
      assert.equal(response.status, 200, `${path} must exist`);
      assert.match(response.headers.get('content-type') || '', /^text\/javascript/, `${path} MIME type`);
      assert.equal(response.headers.get('cache-control'), 'no-store', `${path} caching`);
      const body = await response.text();
      assert.ok(body.length > 100, `${path} should contain JavaScript source`);
      assert.doesNotMatch(body, /<!doctype html>/i, `${path} must not return index.html`);
    }
    const css = await fetch(`${base}/editorial.css?v=2.4.3`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type') || '', /^text\/css/);
    assert.equal(css.headers.get('cache-control'), 'no-store');
    const deepLink = await fetch(`${base}/collection`);
    assert.equal(deepLink.status, 200);
    assert.match(deepLink.headers.get('content-type') || '', /^text\/html/);
    const missingScript = await fetch(`${base}/missing-module.js`);
    assert.equal(missingScript.status, 404, 'missing modules should not silently receive HTML');
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
});
