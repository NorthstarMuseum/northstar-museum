import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStudentUI} from '../public/student-ui.js';
const ui=createStudentUI({api:()=>{throw Error('Network not expected')},escapeHtml:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;'),getUser:()=>({id:1})});
test('Student pages provide working HTML forms and accessible result targets',()=>{
 assert.match(ui.section('/compare'),/id="ns-compare-form"/);
 assert.match(ui.section('/compare'),/aria-live="polite"/);
 assert.match(ui.section('/timeline'),/fictional history/i);
 assert.match(ui.section('/my-exhibitions'),/id="ns-mini-editor"/);
 assert.match(ui.section('/collection'),/href="\/compare"/);
});
test('Mini-exhibition page requires sign-in for guests',()=>{
 const guest=createStudentUI({api:()=>{},escapeHtml:String,getUser:()=>null});
 assert.match(guest.section('/my-exhibitions'),/Log in to create/);
 assert.doesNotMatch(guest.section('/my-exhibitions'),/id="ns-mini-editor"/);
});
test('UI router and responsive CSS include all three v2.4 activities',()=>{
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 for(const route of ['/compare','/timeline','/my-exhibitions'])assert.ok(app.includes(route));
 const styles=readFileSync(new URL('../public/editorial.css',import.meta.url),'utf8');
 assert.match(styles,/student-compare-grid/);assert.match(styles,/student-check-grid/);assert.match(styles,/@media\(max-width:560px\)/);
});
