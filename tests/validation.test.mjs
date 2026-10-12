import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRegistration,validateMessage,validateExhibition,validateEvent,slugify} from '../server/validation.mjs';
import {hashPassword,verifyPassword} from '../server/auth.mjs';

test('registration requires a valid name, email and strong password length',()=>{
  assert.match(validateRegistration({name:'A',email:'bad',password:'123'}),/Name/);
  assert.match(validateRegistration({name:'North Star',email:'bad',password:'1234567890'}),/email/);
  assert.match(validateRegistration({name:'North Star',email:'north@example.org',password:'short'}),/Password/);
  assert.equal(validateRegistration({name:'North Star',email:'north@example.org',password:'long-example-password'}),null);
});
test('contact validates message length and email',()=>{
  assert.match(validateMessage({name:'Jamie',email:'good@example.org',message:'hello'}),/Message/);
  assert.equal(validateMessage({name:'Jamie',email:'good@example.org',message:'I would like more information.'}),null);
});
test('exhibition and event validation enforce allowed values',()=>{
  const exhibition={title:'North Star',category:'Culture',description:'A long enough sample description.',body:'This is an extended description of the exhibition for visitors.',imageKey:'stone',published:true,featured:false};
  assert.equal(validateExhibition(exhibition),null);
  assert.match(validateExhibition({...exhibition,imageKey:'javascript:evil'}),/image/);
  const event={title:'North Star',description:'A long enough sample description.',date:'2027-03-11',time:'11:00',published:true};
  assert.equal(validateEvent(event),null);
  assert.match(validateEvent({...event,time:'99:00'}),/time/);
  assert.match(validateEvent({...event,date:'2027-02-30'}),/date/);
});
test('passwords use salted scrypt and verify securely',()=>{
  const password='northstar!safer-pass';
  const hashA=hashPassword(password),hashB=hashPassword(password);
  assert.notEqual(hashA,hashB);
  assert.equal(hashA.includes(password),false);
  assert.equal(verifyPassword(password,hashA),true);
  assert.equal(verifyPassword('incorrect!',hashA),false);
  assert.equal(verifyPassword(password,'garbage'),false);
});
test('slugs contain only URL-safe characters',()=>{
  assert.equal(slugify('  The Written World!  '),'the-written-world');
  assert.equal(slugify('Café & Culture'),'cafe-culture');
});
