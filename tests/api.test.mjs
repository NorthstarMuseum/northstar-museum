import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { createServer } from '../server/app.mjs';
import { hashPassword } from '../server/auth.mjs';

let server,db,base;
const jsonHeaders={'Content-Type':'application/json'};
const goodPassword='A-sufficiently-long-password!';
async function request(path,method='GET',body=null,cookie='',headers={}){
 const response=await fetch(base+path,{method,headers:{...(body!==null?jsonHeaders:{}),...(cookie?{Cookie:cookie}:{}),...headers},...(body!==null?{body:JSON.stringify(body)}:{})});
 const content=response.status===204?null:await response.json().catch(()=>null);
 return {status:response.status,headers:response.headers,data:content};
}
async function start(){db=openDatabase(':memory:');server=createServer({db});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;}
async function stop(){await new Promise(resolve=>server.close(resolve));db.close();}

await test('Northstar API integration', async t=>{
 await start();
 t.after(stop);
 await t.test('homepage and local illustrations are served with security headers',async()=>{
   let r=await fetch(base+'/');assert.equal(r.status,200);assert.match(await r.text(),/northstar/);
   assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);
   r=await fetch(base+'/assets/gallery.svg');assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/svg/);
   for (const [path,type] of [['/editorial.css','text/css'],['/museum-ui.js','text/javascript']]) {
     const asset=await fetch(base+path);
     assert.equal(asset.status,200, `${path} must be served, not rewritten to index.html`);
     assert.match(asset.headers.get('content-type'), new RegExp(type));
     assert.ok((await asset.text()).length>100);
   }
 });
 await t.test('published exhibits and events are seeded and public',async()=>{
  const e=await request('/api/exhibitions');assert.equal(e.status,200);assert.equal(e.data.exhibitions.length,6);
  assert.equal((await request('/api/exhibitions/echoes-in-stone')).status,200);
  assert.equal((await request('/api/exhibitions/not-here')).status,404);
  const v=await request('/api/events');assert.equal(v.status,200);assert.equal(v.data.events.length,4);
 });
 await t.test('visitor registration, password storage, session and logout',async()=>{
  assert.equal((await request('/api/auth/me')).status,401);
  assert.equal((await request('/api/auth/register','POST',{name:'A',email:'bad',password:'short'})).status,400);
  const r=await request('/api/auth/register','POST',{name:'Taylor Visitor',email:'taylor@example.org',password:goodPassword});
  assert.equal(r.status,201);assert.equal(r.data.user.role,'visitor');assert.equal(Object.hasOwn(r.data.user,'password_hash'),false);
  const cookie=r.headers.get('set-cookie').split(';')[0];
  assert.match(r.headers.get('set-cookie'),/HttpOnly/);
  assert.match(r.headers.get('set-cookie'),/SameSite=Strict/);
  assert.equal((await request('/api/auth/me','GET',null,cookie)).status,200);
  assert.equal((await request('/api/auth/register','POST',{name:'Duplicate',email:'TAYLOR@example.org',password:goodPassword})).status,409);
  const row=db.prepare('SELECT password_hash FROM users WHERE email=?').get('taylor@example.org');
  assert.equal(row.password_hash.includes(goodPassword),false);
  assert.equal((await request('/api/auth/login','POST',{email:'taylor@example.org',password:'wrong-password'})).status,401);
  assert.equal((await request('/api/auth/login','POST',{email:'taylor@example.org',password:goodPassword})).status,200);
  assert.equal((await request('/api/admin/exhibitions','GET',null,cookie)).status,403);
  assert.equal((await request('/api/auth/logout','POST',{},cookie)).status,204);
  assert.equal((await request('/api/auth/me','GET',null,cookie)).status,401);
 });
 await t.test('origin checks reject cross-origin mutations',async()=>{
  const r=await request('/api/auth/login','POST',{email:'test@northstar.org',password:'1234567890'},'',{Origin:'https://other-site.example'});
  assert.equal(r.status,403);
 });
 await t.test('contact messages are validated, stored, and administrator-only',async()=>{
  assert.equal((await request('/api/messages','POST',{name:'A',email:'wrong',message:'Hi'})).status,400);
  assert.equal((await request('/api/messages','POST',{name:'Alex Visitor',email:'alex@example.org',message:'I would like to know more about the exhibitions.'})).status,201);
  assert.equal(db.prepare('SELECT count(*) AS n FROM messages').get().n,1);
  assert.equal((await request('/api/admin/messages')).status,401);
 });
 await t.test('administrators can create, edit, unpublish and remove content',async()=>{
   db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)').run('Local Admin','admin@example.org',hashPassword(goodPassword),'admin');
   const login=await request('/api/auth/login','POST',{email:'admin@example.org',password:goodPassword});
   assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
   const messageList=await request('/api/admin/messages','GET',null,cookie);assert.equal(messageList.status,200);assert.equal(messageList.data.messages.length,1);
   const payload={title:'New Museum Exhibition',category:'CULTURE',description:'An exhibition created for API integration tests.',body:'An extended description providing context for this fictional test exhibition.',imageKey:'memory',featured:false,published:true};
   const created=await request('/api/admin/exhibitions','POST',payload,cookie);
   assert.equal(created.status,201);const e=created.data.exhibition;
   assert.equal((await request(`/api/exhibitions/${e.slug}`)).status,200);
   const updated=await request(`/api/admin/exhibitions/${e.id}`,'PUT',{...payload,published:false},cookie);
   assert.equal(updated.status,200);
   assert.equal((await request(`/api/exhibitions/${e.slug}`)).status,404);
   assert.equal((await request(`/api/admin/exhibitions/${e.id}`,'DELETE',null,cookie)).status,204);
   const event={title:'Workshop Test',description:'An event planned for a future evening at Northstar.',date:'2030-01-05',time:'17:30',published:true};
   const ec=await request('/api/admin/events','POST',event,cookie);assert.equal(ec.status,201);
   const id=ec.data.event.id;
   assert.equal((await request(`/api/admin/events/${id}`,'PUT',{...event,time:'18:00'},cookie)).data.event.time,'18:00');
   assert.equal((await request(`/api/admin/events/${id}`,'DELETE',null,cookie)).status,204);
 });
});
