import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { createServer } from '../server/app.mjs';

await test('Authenticated likes, public counts and private profiles', async t => {
  const db=openDatabase(':memory:');
  const server=createServer({db});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  const req=async(path,method='GET',body=null,cookie='',headers={})=>{
    const r=await fetch(base+path,{method,headers:{...(body!==null?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...headers},...(body!==null?{body:JSON.stringify(body)}:{})});
    return {status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0],body:await r.json().catch(()=>null)};
  };
  const exhibition=db.prepare('SELECT id,slug FROM exhibitions LIMIT 1').get();
  const event=db.prepare('SELECT id FROM events LIMIT 1').get();
  const like=(type,id,method='POST',cookie='')=>req(`/api/account/likes/${type}/${id}`,method,method==='POST'?{}:null,cookie);
  const account=async(email)=>{
    const r=await req('/api/auth/register','POST',{name:'Test Visitor',email,password:'private-secure-password-123'});
    assert.equal(r.status,201);return r.cookie;
  };
  let alice,bob;
  await t.test('Guests see counts but cannot access, like or unlike',async()=>{
    const rows=await req('/api/exhibitions');assert.equal(rows.status,200);
    assert.equal(rows.body.exhibitions[0].likeCount,0);
    assert.equal((await req('/api/events')).body.events[0].likeCount,0);
    assert.equal((await req('/api/account/likes')).status,401);
    assert.equal((await like('exhibitions',exhibition.id)).status,401);
    assert.equal((await like('events',event.id,'DELETE')).status,401);
  });
  await t.test('Registration automatically grants member session; likes are idempotent',async()=>{
    alice=await account('alice@northstar.test');bob=await account('bob@northstar.test');
    let r=await like('exhibitions',exhibition.id,'POST',alice);
    assert.equal(r.status,201);assert.equal(r.body.likeCount,1);
    r=await like('exhibitions',exhibition.id,'POST',alice);
    assert.equal(r.status,200);assert.equal(r.body.likeCount,1);
    assert.equal((await like('exhibitions',exhibition.id,'POST',bob)).body.likeCount,2);
    assert.equal((await like('events',event.id,'POST',alice)).status,201);
    assert.equal((await req('/api/exhibitions')).body.exhibitions.find(x=>x.id===exhibition.id).likeCount,2);
    assert.equal((await req('/api/events')).body.events.find(x=>x.id===event.id).likeCount,1);
    assert.equal((await req(`/api/exhibitions/${exhibition.slug}`)).body.exhibition.likeCount,2);
  });
  await t.test('Likes are private per account and separate from saved lists',async()=>{
    const a=await req('/api/account/likes','GET',null,alice);
    const b=await req('/api/account/likes','GET',null,bob);
    assert.equal(a.body.exhibitions.length,1);assert.equal(a.body.events.length,1);
    assert.equal(b.body.exhibitions.length,1);assert.equal(b.body.events.length,0);
    assert.equal((await req('/api/account/saved','GET',null,alice)).body.exhibitions.length,0);
    assert.equal((await req('/api/account/saved','GET',null,bob)).body.events.length,0);
    assert.equal((await req('/api/account/likes')).status,401);
  });
  await t.test('Unlike changes only the requesting account, totals update',async()=>{
    assert.equal((await like('exhibitions',exhibition.id,'DELETE',alice)).body.likeCount,1);
    const duplicate=await like('exhibitions',exhibition.id,'DELETE',alice);
    assert.equal(duplicate.status,200);assert.equal(duplicate.body.removed,false);
    assert.equal((await req('/api/account/likes','GET',null,bob)).body.exhibitions.length,1);
    assert.equal((await req('/api/account/likes','GET',null,alice)).body.exhibitions.length,0);
  });
  await t.test('Invalid, unpublished and missing content cannot be liked',async()=>{
    assert.equal((await like('events',0,'POST',alice)).status,400);
    assert.equal((await like('events',999999,'POST',alice)).status,404);
    assert.equal((await like('exhibitions',Number.MAX_SAFE_INTEGER+1,'POST',alice)).status,400);
    db.prepare('UPDATE events SET published=0 WHERE id=?').run(event.id);
    assert.equal((await like('events',event.id,'POST',bob)).status,404);
    assert.equal((await req('/api/account/likes','GET',null,alice)).body.events.length,0);
    db.prepare('UPDATE events SET published=1 WHERE id=?').run(event.id);
    assert.equal((await req('/api/account/likes','GET',null,alice)).body.events.length,1);
  });
  await t.test('Origin restrictions apply to like changes',async()=>{
    const r=await req(`/api/account/likes/events/${event.id}`,'POST',{},alice,{Origin:'https://other.example'});
    assert.equal(r.status,403);
  });
  await t.test('Deleting a record cascades its reactions',async()=>{
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM liked_exhibitions').get().n,1);
    db.prepare('DELETE FROM exhibitions WHERE id=?').run(exhibition.id);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM liked_exhibitions').get().n,0);
    assert.equal((await req('/api/account/likes','GET',null,bob)).body.exhibitions.length,0);
  });
});
