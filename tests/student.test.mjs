import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { createServer } from '../server/app.mjs';

const password='LongStudentPass-123!';
async function setup(){
 const db=openDatabase(':memory:');const server=createServer({db});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const url=`http://127.0.0.1:${server.address().port}`;
 const call=async(path,method='GET',body,cookie='')=>{
  const res=await fetch(url+path,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  return {status:res.status,data:await res.json().catch(()=>null),cookie:res.headers.get('set-cookie')?.split(';')[0]};
 };
 const register=async(name,email)=>{const result=await call('/api/auth/register','POST',{name,email,password});assert.equal(result.status,201);return {cookie:result.cookie,id:result.data.user.id};};
 return {db,call,register,close:async()=>{await new Promise(ok=>server.close(ok));db.close();}};
}
const details=ids=>({title:'Stars and Stories',description:'Three things from the Northstar imaginary archive.',artifactIds:ids});

test('Fictional timeline is public and links only to published objects',async t=>{
 const x=await setup();t.after(x.close);
 const response=await x.call('/api/timeline');assert.equal(response.status,200);
 assert.equal(response.data.fictional,true);assert.equal(response.data.entries.length,6);
 assert.ok(response.data.entries.every(row=>row.year&&row.story&&row.artifact?.id));
 const first=response.data.entries[0].artifact;
 x.db.prepare('UPDATE artifacts SET published=0 WHERE id=?').run(first.id);
 const after=await x.call('/api/timeline');assert.equal(after.status,200);
 assert.equal(after.data.entries[0].artifact,null);
});

test('Mini-exhibition endpoints require a signed-in user',async t=>{
 const x=await setup();t.after(x.close);const ids=x.db.prepare('SELECT id FROM artifacts LIMIT 3').all().map(x=>x.id);
 assert.equal((await x.call('/api/account/mini-exhibitions')).status,401);
 assert.equal((await x.call('/api/account/mini-exhibitions','POST',details(ids))).status,401);
 assert.equal((await x.call('/api/account/mini-exhibitions/1','PUT',details(ids))).status,401);
 assert.equal((await x.call('/api/account/mini-exhibitions/1','DELETE')).status,401);
});

test('Members can create, update, view and delete only their own mini-exhibitions',async t=>{
 const x=await setup();t.after(x.close);
 const alice=await x.register('Alice Archive','alice-archive@example.org'),bob=await x.register('Bob Archive','bob-archive@example.org');
 const ids=x.db.prepare('SELECT id FROM artifacts WHERE published=1 LIMIT 4').all().map(x=>x.id);
 const created=await x.call('/api/account/mini-exhibitions','POST',details(ids.slice(0,3)),alice.cookie);
 assert.equal(created.status,201);const id=created.data.id;
 let own=await x.call('/api/account/mini-exhibitions','GET',undefined,alice.cookie);
 assert.equal(own.data.exhibitions.length,1);assert.equal(own.data.exhibitions[0].artifacts.length,3);
 assert.equal((await x.call('/api/account/mini-exhibitions','GET',undefined,bob.cookie)).data.exhibitions.length,0);
 assert.equal((await x.call(`/api/account/mini-exhibitions/${id}`,'PUT',details(ids.slice(1)),bob.cookie)).status,404);
 assert.equal((await x.call(`/api/account/mini-exhibitions/${id}`,'DELETE',undefined,bob.cookie)).status,404);
 const updated=await x.call(`/api/account/mini-exhibitions/${id}`,'PUT',{...details(ids.slice(1)),title:'Edited stars'},alice.cookie);
 assert.equal(updated.status,200);
 own=await x.call('/api/account/mini-exhibitions','GET',undefined,alice.cookie);
 assert.equal(own.data.exhibitions[0].title,'Edited stars');
 assert.deepEqual(own.data.exhibitions[0].artifacts.map(a=>a.id),ids.slice(1));
 const exported=await x.call('/api/account/export','GET',undefined,alice.cookie);
 assert.equal(exported.status,200);assert.equal(exported.data.miniExhibitions[0].title,'Edited stars');
 assert.doesNotMatch(JSON.stringify(exported.data),/password_hash|token_hash/);
 assert.equal((await x.call(`/api/account/mini-exhibitions/${id}`,'DELETE',undefined,alice.cookie)).status,200);
 assert.equal((await x.call('/api/account/mini-exhibitions','GET',undefined,alice.cookie)).data.exhibitions.length,0);
});

test('Mini-exhibition validation protects title, object count and publication status',async t=>{
 const x=await setup();t.after(x.close);const user=await x.register('Museum Maker','museum-maker@example.org');
 const ids=x.db.prepare('SELECT id FROM artifacts WHERE published=1 LIMIT 7').all().map(x=>x.id);
 for(const body of [details(ids.slice(0,2)),details(ids),details([ids[0],ids[0],ids[2]]),details([ids[0],ids[1],99999]),{...details(ids.slice(0,3)),title:'Hi'},{...details(ids.slice(0,3)),description:'Short'}]){
  assert.equal((await x.call('/api/account/mini-exhibitions','POST',body,user.cookie)).status,400);
 }
 x.db.prepare('UPDATE artifacts SET published=0 WHERE id=?').run(ids[0]);
 assert.equal((await x.call('/api/account/mini-exhibitions','POST',details(ids.slice(0,3)),user.cookie)).status,400);
 assert.equal(x.db.prepare('SELECT COUNT(*) AS n FROM mini_exhibitions').get().n,0);
});

test('Invalid updates are atomic and keep the old exhibition unchanged',async t=>{
 const x=await setup();t.after(x.close);const u=await x.register('Archive Editor','editor-archive@example.org');
 const ids=x.db.prepare('SELECT id FROM artifacts LIMIT 4').all().map(x=>x.id);
 const id=(await x.call('/api/account/mini-exhibitions','POST',details(ids.slice(0,3)),u.cookie)).data.id;
 assert.equal((await x.call(`/api/account/mini-exhibitions/${id}`,'PUT',details([ids[0],ids[2],ids[2]]),u.cookie)).status,400);
 const after=(await x.call('/api/account/mini-exhibitions','GET',undefined,u.cookie)).data.exhibitions[0];
 assert.equal(after.title,'Stars and Stories');assert.deepEqual(after.artifacts.map(a=>a.id),ids.slice(0,3));
});

test('Member can store at most ten private exhibitions',async t=>{
 const x=await setup();t.after(x.close);const u=await x.register('Many Exhibits','many-exhibits@example.org');
 const ids=x.db.prepare('SELECT id FROM artifacts LIMIT 3').all().map(x=>x.id);
 for(let i=0;i<10;i++)assert.equal((await x.call('/api/account/mini-exhibitions','POST',{...details(ids),title:`Exhibition ${i}`},u.cookie)).status,201);
 assert.equal((await x.call('/api/account/mini-exhibitions','POST',details(ids),u.cookie)).status,409);
 assert.equal(x.db.prepare('SELECT COUNT(*) AS n FROM mini_exhibitions').get().n,10);
});

test('Deleting a visitor also removes their mini-exhibitions and items',async t=>{
 const x=await setup();t.after(x.close);const u=await x.register('Temporary Member','temporary-member@example.org');
 const ids=x.db.prepare('SELECT id FROM artifacts LIMIT 3').all().map(x=>x.id);
 assert.equal((await x.call('/api/account/mini-exhibitions','POST',details(ids),u.cookie)).status,201);
 assert.equal((await x.call('/api/account','DELETE',{confirmation:'DELETE ACCOUNT',password},u.cookie)).status,200);
 assert.equal(x.db.prepare('SELECT COUNT(*) AS n FROM mini_exhibitions').get().n,0);
 assert.equal(x.db.prepare('SELECT COUNT(*) AS n FROM mini_exhibition_items').get().n,0);
});
