import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const extensions = new Set(['.html', '.js', '.mjs', '.json', '.md', '.txt', '.css']);
function visit(dir) {
  const found = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (item.name === 'node_modules' || item.name === '.git') continue;
    const path = join(dir, item.name);
    if (item.isDirectory()) found.push(...visit(path));
    else if ([...extensions].some(extension => item.name.endsWith(extension))) found.push(path);
  }
  return found;
}

test('Northstar website copy uses plain punctuation without long dashes', () => {
  for (const path of visit(root)) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /[\u2013\u2014]/u, `Unexpected long dash in ${relative(root, path)}`);
  }
  const catalog = readFileSync(join(root, 'public', 'museum-ui.js'), 'utf8');
  assert.match(catalog, /Every object has a story\. Some are still waiting to be found\./);
});
