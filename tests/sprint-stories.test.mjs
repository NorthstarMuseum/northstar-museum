import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import { openDatabase } from '../server/db.mjs';
import { createServer } from '../server/app.mjs';
import { ticketQuote, TICKET_PRICES } from '../server/tickets.mjs';
import { museumToday } from '../server/museum.mjs';
import { hashPassword } from '../server/auth.mjs';

const password='Safe-Test-Password-12345';
async function harness(){
 const db=openDatabase(':memory:'),server=createServer({db});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const request=async(path,method='GET',body,token)=>{
  const response=await fetch(base+path,{method,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Cookie:token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,json:await response.json().catch(()=>null),cookie:response.headers.get('set-cookie')?.split(';')[0]};
 };
 const register=async(name,email)=>{const r=await request('/api/auth/register','POST',{name,email,password});assert.equal(r.status,201);return r.cookie;};
 return {db,request,register,close:async()=>{await new Promise(resolve=>server.close(resolve));db.close();}};
}
const nextOpenDate=()=>{
 const today=museumToday(),start=new Date(today+'T12:00:00Z');
 for(let n=1;n<=6;n++){const d=new Date(start);d.setUTCDate(d.getUTCDate()+n);if(d.getUTCDay()!==1)return d.toISOString().slice(0,10);}
 throw new Error('No open day');
};

test('Ticket quotes reject tampered, fractional, excessive or unknown types',()=>{
 assert.deepEqual(ticketQuote({adult:1,student:2,child:1}),{tickets:{adult:1,student:2,child:1},visitors:4,totalCents:3300,currency:'CAD'});
 for(const bad of [{adult:0},{adult:6},{adult:-1},{adult:1.5},{adult:1,student:5},{senior:1},{adult:'2'},null])assert.throws(()=>ticketQuote(bad),RangeError);
 assert.equal(TICKET_PRICES.adult,1200);
});

test('Booking tickets calculate on server, never trust a client price, and respect capacity',async t=>{
 const s=await harness();t.after(s.close);
 const date=nextOpenDate();
 const prices=await s.request('/api/visit/prices');assert.equal(prices.status,200);assert.equal(prices.json.prices.student,800);
 const available=await s.request(`/api/visit/availability?date=${date}`);assert.equal(available.status,200);assert.equal(available.json.ticketPrices.child,500);
 const member=await s.register('Museum Booker','museum-booker@test.org');
 assert.equal((await s.request('/api/account/bookings','POST',{date,time:'10:00',visitors:2,tickets:{student:2},totalCents:1})).status,401);
 for(const payload of [{adult:2,student:2,child:2},{adult:-1,child:2},{adult:1.5},{adult:0},{unknown:1}]){
  const r=await s.request('/api/account/bookings','POST',{date,time:'10:00',tickets:payload},member);
  assert.equal(r.status,400,JSON.stringify(payload));
 }
 const invalid=await s.request('/api/account/bookings','POST',{date,time:'10:00',tickets:{student:2},visitors:1},member);
 assert.equal(invalid.status,400);
 s.db.prepare('INSERT INTO visit_schedule(visit_date,closed,capacity) VALUES(?,0,2)').run(date);
 const confirmed=await s.request('/api/account/bookings','POST',{date,time:'10:00',tickets:{student:2},visitors:2,totalCents:1},member);
 assert.equal(confirmed.status,201);assert.equal(confirmed.json.booking.totalCents,1600);
 assert.deepEqual(confirmed.json.booking.tickets,{adult:0,student:2,child:0});
 const memberAccount=await s.request('/api/account/museum','GET',undefined,member);
 assert.equal(memberAccount.json.bookings[0].totalCents,1600);
 assert.equal(memberAccount.json.bookings[0].tickets.student,2);
 const blocked=await s.request('/api/account/bookings','POST',{date,time:'10:00',tickets:{adult:1}},member);
 assert.equal(blocked.status,409);
 const other=await s.register('Other Booker','other-booker@test.org');
 const otherAccount=await s.request('/api/account/museum','GET',undefined,other);
 assert.equal(otherAccount.json.bookings.length,0);
 const exportResponse=await s.request('/api/account/export','GET',undefined,member);
 assert.equal(exportResponse.json.bookings[0].tickets.student,2);
 assert.equal(exportResponse.json.bookings[0].totalCents,1600);
 const cancel=await s.request(`/api/account/bookings/${memberAccount.json.bookings[0].id}/cancel`,'POST',{},member);
 assert.equal(cancel.status,200);
 const newBooking=await s.request('/api/account/bookings','POST',{date,time:'10:00',visitors:1},other);
 assert.equal(newBooking.status,201);assert.equal(newBooking.json.booking.totalCents,1200);
 s.db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)').run('Admin','admin-sprint@test.org',hashPassword(password),'admin');
 const admin=await s.request('/api/auth/login','POST',{email:'admin-sprint@test.org',password});
 const list=await s.request('/api/admin/museum/bookings','GET',undefined,admin.cookie);
 assert.equal(list.status,200);assert.equal(list.json.bookings[0].totalCents,1200);
 assert.equal((await s.request('/api/admin/museum/bookings','GET',undefined,member)).status,403);
});

test('Existing SQLite reservations migrate without losing booking references',()=>{
 const dir=mkdtempSync(join(tmpdir(),'northstar-migration-'));const path=join(dir,'old.sqlite');
 try{
  const old=new DatabaseSync(path);
  old.exec(`CREATE TABLE bookings(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,code TEXT NOT NULL UNIQUE,visit_date TEXT NOT NULL,slot TEXT NOT NULL,visitors INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'confirmed',payment_status TEXT NOT NULL DEFAULT 'unpaid',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,checked_in_at TEXT);`);
  old.prepare('INSERT INTO bookings(id,user_id,code,visit_date,slot,visitors) VALUES(1,7,?,?,?,3)').run('NS-OLDREF','2030-01-01','10:00');old.close();
  const next=openDatabase(path);const b=next.prepare('SELECT * FROM bookings WHERE code=?').get('NS-OLDREF');
  assert.equal(b.visitors,3);assert.equal(JSON.parse(b.ticket_breakdown).adult,3);assert.equal(b.total_cents,3600);next.close();
  const reopened=openDatabase(path);assert.equal(reopened.prepare('SELECT COUNT(*) AS n FROM bookings').get().n,1);reopened.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Visitor stories include event search/detail, ticket quantity controls and keyboard focus',()=>{
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').split('// Link navigation and forms are handled')[0].replace(/^import [^\n]+\n/gm,'');
 const ctx=vm.createContext({createStudentUI:()=>({section:()=>'',loadedPage:()=>{},click:()=>{},submit:()=>{}}),createFeaturesUI:()=>({section:()=>'',loadedPage:()=>{}}),createMuseumUI:()=>({page:()=>null,account:()=>'',adminSection:()=>''}),Date,URL,location:{pathname:'/'},console,fetch(){throw Error('not called')}});
 vm.runInContext(source,ctx);
 const html=vm.runInContext(`(state.events=[{id:123,title:'Curator Workshop',date:'2030-05-05',time:'11:00',description:'Explore archival objects',likeCount:0}],state.eventExplore.query='curator',events())`,ctx);
 assert.match(html,/id="event-search"/);assert.match(html,/id="event-date-filter"/);assert.match(html,/href="\/events\/123"/);
 assert.match(vm.runInContext('eventDetail(123)',ctx),/Plan a visit/);
 assert.equal(vm.runInContext('(state.eventExplore.query="missing",filteredEvents().length)',ctx),0);
 const booking=readFileSync(new URL('../public/museum-ui.js',import.meta.url),'utf8');
 assert.match(booking,/ticket-count/);assert.match(booking,/booking-admin-search/);assert.match(booking,/data-print-booking/);assert.match(booking,/aria-pressed/);
 const css=readFileSync(new URL('../public/editorial.css',import.meta.url),'utf8');assert.match(css,/:focus-visible/);assert.match(css,/@media print/);
});
