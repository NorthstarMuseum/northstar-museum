import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeaturesUI } from '../public/features-ui.js';
const fakeApi=()=>{throw new Error('Do not request network in static markup test.');};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const make=user=>createFeaturesUI({api:fakeApi,escapeHtml,getUser:()=>user,navigate(){},onAccountDeleted(){}});
test('Guest sees daily object slot, quiz login, and archive entry',()=>{
 const ui=make(null);
 assert.match(ui.section('/'),/ns-featured-object/);
 assert.match(ui.section('/quiz'),/Log in to play/);
 assert.match(ui.section('/mysteries'),/secret-archive/);
 assert.match(ui.section('/secret-archive'),/Checking your discovery progress/);
 assert.equal(ui.section('/account'),'');
});
test('Visitors have personal lists, data export, deletion with exact phrase',()=>{
 const ui=make({id:1,role:'visitor'});
 const html=ui.section('/account');
 for(const term of ['Personal collections','ns-collection-create','Download my data','ns-account-delete','DELETE ACCOUNT','disabled'])assert.ok(html.includes(term),term);
 assert.equal(ui.section('/admin'),'');
});
test('Admins can manage visitors and view activity without self-deletion form',()=>{
 const ui=make({id:2,role:'admin'});
 assert.match(ui.section('/admin'),/Visitor accounts/);
 assert.match(ui.section('/admin'),/ns-admin-log/);
 assert.doesNotMatch(ui.section('/account'),/id="ns-account-delete"/);
});
