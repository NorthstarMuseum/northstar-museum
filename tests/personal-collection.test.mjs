import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { createServer } from '../server/app.mjs';
import { hashPassword } from '../server/auth.mjs';

const password='strong-unique-test-password';
await test('Personal collection and profile API', async t=>{
 const db=openDatabase(':memory:');
 const server=createServer({db});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();});
 const base=`http://127.0.0.1:${server.address().port}`;
 const request=async (path,method='GET',body=null,cookie='')=>{
  const res=await fetch(base+path,{method,headers:{...(body!==null?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body!==null?{body:JSON.stringify(body)}:{})});
  return {status:res.status,cookie:res.headers.get('set-cookie')?.split(';')[0],body:await res.json().catch(()=>null)};
 };
 const register=async (name,email)=>{
  const r=await request('/api/auth/register','POST',{name,email,password});
  assert.equal(r.status,201);
  return r.cookie;
 };
 const first=await register('Visitor One','visitor-one@example.org');
 const second=await register('Visitor Two','visitor-two@example.org');
 const exhibitionId=db.prepare('SELECT id FROM exhibitions WHERE published=1 LIMIT 1').get().id;
 const eventId=db.prepare('SELECT id FROM events WHERE published=1 LIMIT 1').get().id;
 await t.test('guests cannot read or change private lists or profiles',async()=>{
  assert.equal((await request('/api/account/saved')).status,401);
  assert.equal((await request(`/api/account/saved/exhibitions/${exhibitionId}`,'POST',{})).status,401);
  assert.equal((await request(`/api/account/saved/events/${eventId}`,'DELETE')).status,401);
  assert.equal((await request('/api/account/profile','PUT',{name:'Example'})).status,401);
 });
 await t.test('saved exhibition and event are persisted and belong to one account',async()=>{
  assert.equal((await request(`/api/account/saved/exhibitions/${exhibitionId}`,'POST',{},first)).status,201);
  assert.equal((await request(`/api/account/saved/exhibitions/${exhibitionId}`,'POST',{},first)).status,200);
  assert.equal((await request(`/api/account/saved/events/${eventId}`,'POST',{},first)).status,201);
  const mine=await request('/api/account/saved','GET',null,first);
  assert.equal(mine.status,200);
  assert.equal(mine.body.exhibitions.length,1);
  assert.equal(mine.body.events.length,1);
  const other=await request('/api/account/saved','GET',null,second);
  assert.equal(other.status,200);
  assert.equal(other.body.exhibitions.length,0);
  assert.equal(other.body.events.length,0);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM saved_exhibitions').get().total,1);
 });
 await t.test('invalid identifiers and unpublished exhibits cannot be saved',async()=>{
  assert.equal((await request('/api/account/saved/exhibitions/0','POST',{},first)).status,400);
  assert.equal((await request('/api/account/saved/events/999999','POST',{},first)).status,404);
  db.prepare('UPDATE exhibitions SET published=0 WHERE id=?').run(exhibitionId);
  assert.equal((await request(`/api/account/saved/exhibitions/${exhibitionId}`,'POST',{},second)).status,404);
  assert.equal((await request('/api/account/saved','GET',null,first)).body.exhibitions.length,0);
  db.prepare('UPDATE exhibitions SET published=1 WHERE id=?').run(exhibitionId);
  assert.equal((await request('/api/account/saved','GET',null,first)).body.exhibitions.length,1);
 });
 await t.test('profile name can be updated only on own account',async()=>{
  assert.equal((await request('/api/account/profile','PUT',{name:'a'},first)).status,400);
  assert.equal((await request('/api/account/profile','PUT',{name:'New Display Name'},first)).status,200);
  const u1=await request('/api/auth/me','GET',null,first);
  const u2=await request('/api/auth/me','GET',null,second);
  assert.equal(u1.body.user.name,'New Display Name');
  assert.equal(u2.body.user.name,'Visitor Two');
 });
 await t.test('saved records can be removed safely, even on repeat',async()=>{
  assert.equal((await request(`/api/account/saved/exhibitions/${exhibitionId}`,'DELETE',null,first)).body.removed,true);
  assert.equal((await request(`/api/account/saved/exhibitions/${exhibitionId}`,'DELETE',null,first)).body.removed,false);
  assert.equal((await request(`/api/account/saved/events/${eventId}`,'DELETE',null,first)).status,200);
  const r=await request('/api/account/saved','GET',null,first);
  assert.equal(r.body.exhibitions.length,0);
  assert.equal(r.body.events.length,0);
 });
 await t.test('database deletes remove orphaned saved links',async()=>{
  await request(`/api/account/saved/exhibitions/${exhibitionId}`,'POST',{},first);
  db.prepare('DELETE FROM exhibitions WHERE id=?').run(exhibitionId);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM saved_exhibitions').get().total,0);
 });
 await t.test('roles still prevent visitors from administering',async()=>{
  assert.equal((await request('/api/admin/events','GET',null,first)).status,403);
  db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)').run('Staff','staff@example.org',hashPassword(password),'admin');
  const admin=await request('/api/auth/login','POST',{email:'staff@example.org',password});
  assert.equal(admin.status,200);
  assert.equal((await request('/api/admin/events','GET',null,admin.cookie)).status,200);
 });
});
