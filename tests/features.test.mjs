import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { createServer } from '../server/app.mjs';
import { hashPassword } from '../server/auth.mjs';
import { dailyStamp } from '../server/museum.mjs';

const password='My-long-demo-password-123!';
async function setup(){
 const db=openDatabase(':memory:');
 const server=createServer({db});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const call=async(path,method='GET',body, cookie='')=>{
  const response=await fetch(base+path,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  return {status:response.status,body:await response.json().catch(()=>null),cookie:response.headers.get('set-cookie')?.split(';')[0],headers:response.headers};
 };
 const register=async(name,email)=>{
  const r=await call('/api/auth/register','POST',{name,email,password});
  assert.equal(r.status,201);return {cookie:r.cookie,id:r.body.user.id};
 };
 return {db,call,register,close:async()=>{await new Promise(resolve=>server.close(resolve));db.close();}};
}

test('Featured object and stamp use public, consistent values',async t=>{
 const x=await setup();t.after(x.close);
 const day=await x.call('/api/artifact-of-day');assert.equal(day.status,200);
 assert.ok(day.body.artifact?.id);assert.ok(day.body.artifact?.title);
 assert.equal('secret_key' in day.body.artifact,false);
 const schedule=await x.call(`/api/visit/availability?date=${day.body.date}`);
 assert.equal(schedule.status,200);assert.deepEqual(schedule.body.stamp,dailyStamp(day.body.date));
});

test('Quiz is graded on server; only authenticated players can save attempts',async t=>{
 const x=await setup();t.after(x.close);
 const quiz=await x.call('/api/quiz');assert.equal(quiz.status,200);
 assert.equal(quiz.body.questions.length,3);
 assert.ok(quiz.body.questions.every(q=>!('answer' in q)));
 assert.equal((await x.call('/api/account/quiz','POST',{answers:[1,2,0]})).status,401);
 const member=await x.register('Quiz User','quiz-user@example.org');
 assert.equal((await x.call('/api/account/quiz','POST',{answers:[3,0,0]},member.cookie)).status,400);
 assert.equal((await x.call('/api/account/quiz','POST',{answers:[1,2]},member.cookie)).status,400);
 const r=await x.call('/api/account/quiz','POST',{answers:[1,2,0]},member.cookie);
 assert.equal(r.status,200);assert.equal(r.body.score,3);assert.ok(r.body.clue);
 assert.equal(x.db.prepare('SELECT score FROM quiz_attempts WHERE user_id=?').get(member.id).score,3);
 assert.equal((await x.call('/api/account/quiz','POST',{answers:[0,0,1]},member.cookie)).body.score,0);
});

test('Collections are private and reject cross-account changes',async t=>{
 const x=await setup();t.after(x.close);
 const first=await x.register('Alex Museum','alex-museum@example.org');
 const other=await x.register('Sam Museum','sam-museum@example.org');
 const artifact=x.db.prepare('SELECT id FROM artifacts WHERE published=1 LIMIT 1').get().id;
 assert.equal((await x.call('/api/account/collections')).status,401);
 assert.equal((await x.call('/api/account/collections','POST',{name:'A'},first.cookie)).status,400);
 const created=await x.call('/api/account/collections','POST',{name:'My Objects'},first.cookie);
 assert.equal(created.status,201);
 const c=created.body.id;
 assert.equal((await x.call('/api/account/collections','GET',undefined,other.cookie)).body.collections.length,0);
 assert.equal((await x.call(`/api/account/collections/${c}`,'DELETE',undefined,other.cookie)).status,404);
 assert.equal((await x.call(`/api/account/collections/${c}`,'PUT',{name:'Stolen'},other.cookie)).status,404);
 assert.equal((await x.call(`/api/account/collections/${c}/artifacts/${artifact}`,'POST',{},other.cookie)).status,404);
 assert.equal((await x.call(`/api/account/collections/${c}/artifacts/${artifact}`,'POST',{},first.cookie)).status,200);
 assert.equal((await x.call('/api/account/collections','GET',undefined,first.cookie)).body.collections[0].artifacts.length,1);
 assert.equal((await x.call(`/api/account/collections/${c}`,'PUT',{name:'History'},first.cookie)).status,200);
 assert.equal((await x.call(`/api/account/collections/${c}/artifacts/${artifact}`,'DELETE',undefined,first.cookie)).status,200);
 assert.equal((await x.call(`/api/account/collections/${c}`,'DELETE',undefined,first.cookie)).status,200);
});

test('Final archive only unlocks after seven valid discoveries',async t=>{
 const x=await setup();t.after(x.close);
 const member=await x.register('Secret Hunter','secret-hunter@example.org');
 assert.equal((await x.call('/api/account/mystery/finale')).status,401);
 assert.equal((await x.call('/api/account/mystery/finale','GET',undefined,member.cookie)).status,403);
 const keys=['forgotten-egg','whispering-frame','clockwork-heart','lost-constellation','sealed-letter','guardian-eye','hidden-compass'];
 for(const key of keys)assert.equal((await x.call(`/api/account/discoveries/${key}`,'POST',{},member.cookie)).status,201);
 const finale=await x.call('/api/account/mystery/finale','GET',undefined,member.cookie);
 assert.equal(finale.status,200);assert.match(finale.body.letter,/First Curator/);
 const other=await x.register('New Member','new-member@example.org');
 assert.equal((await x.call('/api/account/mystery/finale','GET',undefined,other.cookie)).status,403);
});

test('Member can export own data without passwords or session tokens',async t=>{
 const x=await setup();t.after(x.close);
 assert.equal((await x.call('/api/account/export')).status,401);
 const first=await x.register('Data Owner','data-owner@example.org');
 const other=await x.register('Data Other','data-other@example.org');
 await x.call('/api/account/collections','POST',{name:'Personal Objects'},first.cookie);
 const r=await x.call('/api/account/export','GET',undefined,first.cookie);
 assert.equal(r.status,200);assert.equal(r.body.profile.email,'data-owner@example.org');
 assert.equal(r.body.collections.length,1);
 assert.doesNotMatch(JSON.stringify(r.body),/password_hash|token_hash|My-long-demo-password-123!/);
 assert.equal((await x.call('/api/account/export','GET',undefined,other.cookie)).body.collections.length,0);
});

test('Self delete checks exact phrase and password, removes data and revokes sessions',async t=>{
 const x=await setup();t.after(x.close);
 const member=await x.register('Delete Me','delete-me@example.org');
 const another=await x.register('Keep Me','keep-me@example.org');
 const id=member.id;
 await x.call('/api/account/collections','POST',{name:'My Collection'},member.cookie);
 assert.equal((await x.call('/api/account','DELETE',{confirmation:'delete account',password},member.cookie)).status,400);
 assert.equal((await x.call('/api/account','DELETE',{confirmation:'DELETE ACCOUNT',password:'wrong'},member.cookie)).status,401);
 assert.equal((await x.call('/api/auth/me','GET',undefined,member.cookie)).status,200);
 const deleted=await x.call('/api/account','DELETE',{confirmation:'DELETE ACCOUNT',password},member.cookie);
 assert.equal(deleted.status,200);assert.match(deleted.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await x.call('/api/auth/me','GET',undefined,member.cookie)).status,401);
 assert.equal(x.db.prepare('SELECT id FROM users WHERE id=?').get(id),undefined);
 assert.equal(x.db.prepare('SELECT id FROM member_collections WHERE user_id=?').get(id),undefined);
 assert.equal((await x.call('/api/auth/me','GET',undefined,another.cookie)).status,200);
});

test('Admin user deletion requires own password and records audit without exposing credentials',async t=>{
 const x=await setup();t.after(x.close);
 const visitor=await x.register('Target User','target-user@example.org');
 x.db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)').run('Test Admin','admin2@example.org',hashPassword(password),'admin');
 const login=await x.call('/api/auth/login','POST',{email:'admin2@example.org',password});
 assert.equal(login.status,200);const adminCookie=login.cookie;
 assert.equal((await x.call('/api/admin/users')).status,401);
 assert.equal((await x.call('/api/admin/users','GET',undefined,visitor.cookie)).status,403);
 const users=await x.call('/api/admin/users?search=target-user','GET',undefined,adminCookie);
 assert.equal(users.status,200);assert.equal(users.body.users.length,1);
 assert.ok(!('password_hash' in users.body.users[0]));
 assert.equal((await x.call(`/api/admin/users/${visitor.id}`,'DELETE',{confirmation:'DELETE ACCOUNT',password},visitor.cookie)).status,403);
 assert.equal((await x.call(`/api/admin/users/${visitor.id}`,'DELETE',{confirmation:'delete account',password},adminCookie)).status,400);
 assert.equal((await x.call(`/api/admin/users/${visitor.id}`,'DELETE',{confirmation:'DELETE ACCOUNT',password:'incorrect'},adminCookie)).status,401);
 const adminId=x.db.prepare('SELECT id FROM users WHERE email=?').get('admin2@example.org').id;
 assert.equal((await x.call(`/api/admin/users/${adminId}`,'DELETE',{confirmation:'DELETE ACCOUNT',password},adminCookie)).status,403);
 const removed=await x.call(`/api/admin/users/${visitor.id}`,'DELETE',{confirmation:'DELETE ACCOUNT',password},adminCookie);
 assert.equal(removed.status,200);
 assert.equal((await x.call('/api/auth/me','GET',undefined,visitor.cookie)).status,401);
 assert.equal((await x.call('/api/admin/activity','GET',undefined,visitor.cookie)).status,401);
 const activity=await x.call('/api/admin/activity','GET',undefined,adminCookie);
 assert.equal(activity.status,200);assert.ok(activity.body.entries.some(a=>a.action==='delete_user'&&a.targetId===visitor.id));
 assert.doesNotMatch(JSON.stringify(activity.body),/target-user@example.org|password_hash/);
});
