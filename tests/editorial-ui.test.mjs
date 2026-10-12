import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/editorial.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8')
  .split('// Link navigation and forms are handled')[0]
  .replace(/^import [^\n]+\n/,'');
const ctx=vm.createContext({createMuseumUI:()=>({account:()=>'',adminSection:()=>'',page:()=>null}), Date,URL,location:{pathname:'/'},window:{},console,fetch(){throw new Error('No network expected')}});
vm.runInContext(js,ctx);
const evaluate=code=>vm.runInContext(code,ctx);

test('Museum masthead has a usable collection search and booking action',()=>{
 assert.match(html,/href="\/visit"[^>]*>Book a visit/);
 assert.match(html,/class="nav-search" href="\/collection"/);
 assert.match(html,/id="main-nav"/);
 assert.match(html,/href="\/login"/);
 assert.match(html,/href="\/editorial.css"/);
});
test('Homepage contains real routes for exhibitions, collection and visitor booking',()=>{
 const output=evaluate('home()');
 for(const part of ['editorial-hero','visit-information','exhibition-section','collection-feature','events-section']) assert.ok(output.includes(part), part);
 assert.match(output,/href="\/visit"/);
 assert.match(output,/href="\/mysteries"/);
 assert.match(output,/pay at entrance/i);
 assert.doesNotMatch(output,/✳|★|✦/);
});
test('Editorial images are bundled and the neutral design supports reduced motion',()=>{
 for(const filename of ['museum-gallery','ancient-civilizations','sky-above','hidden-stories','collections','objects','gallery-rooms']) {
   assert.ok(existsSync(new URL(`../public/assets/editorial/${filename}.webp`,import.meta.url)), filename);
 }
 assert.match(css,/#f4f6f9/i);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.booking-panel/);
 assert.match(css,/\.museum-table/);
});
