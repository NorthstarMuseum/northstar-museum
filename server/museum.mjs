import { randomBytes, createHash } from 'node:crypto';

const slots=['10:00','11:30','13:00','14:30','16:00'];
const secretList=[
 ['forgotten-egg','The Forgotten Egg','Tap the mysterious egg five times.','The curator hid the first stellar coordinate inside an amber shell.'],
 ['whispering-frame','The Whispering Frame','Knock on the portrait frame four times.','The portrait is of the first archivist, who never appears in the official records.'],
 ['clockwork-heart','The Clockwork Heart','Wake the clockwork machine three times.','A clock stopped at 18:94. There was never a time like that.'],
 ['lost-constellation','The Lost Constellation','Find the five stars.','Seven stars once pointed to the archive below the northern gallery.'],
 ['sealed-letter','The Sealed Letter','Open the wax seal four times.','The final curator wrote: the collection is not what it seems.'],
 ['guardian-eye','The Guardian’s Eye','Look into the mask five times.','The guardian carries the second half of the archive key.'],
 ['hidden-compass','The Hidden Compass','Turn the compass three times.','True north was never north; it was a door.']
];
const catalog=[
 ['Celestial Compass','Astronomical Instruments','A gilded navigational instrument with seven tiny northern stars.','A fictional device built to navigate constellations that have never appeared on any map.','compass',1,'hidden-compass'],
 ['Forgotten Guardian','Civilizations','A ceremonial mask of stone and patinated copper.','According to the invented Northstar archives, the guardian watched over an empty throne.','guardian',1,'guardian-eye'],
 ['Aurora Reliquary','Curiosities','An iridescent object enclosed in a brass reliquary.','The cabinet inventory describes a strange light appearing only when no one was watching.','crystal',2,null],
 ['The Tidal Atlas','Cartography','An ocean map embossed into antique silver plates.','Its coastline changes between the first and the final pages.','atlas',2,null],
 ['Voyager’s Lantern','Exploration','An explorer’s lantern still holding a shard of blue glass.','An expedition vanished after recording a light above the northern sea.','lantern',2,null],
 ['The Whispering Frame','Portraits','A portrait with a secret hidden between its gilded borders.','Every visitor describes a different expression on the subject’s face.','frame',3,'whispering-frame'],
 ['Moonstone Archive','Natural Wonders','A luminous mineral resting on dark volcanic rock.','Scientists in the fictional museum disagree on where the specimen originated.','moonstone',3,null],
 ['Astral Lens','Optics','A prism that scatters constellations across nearby surfaces.','Looking through its facets reveals a star that is missing from the sky.','lens',3,null],
 ['The Sealed Letter','Manuscripts','A letter closed with violet wax and a cryptic mark.','The only surviving message addressed to the museum’s missing curator.','letter',4,'sealed-letter'],
 ['Archive of Ash','Manuscripts','A burnt page containing a single undamaged illustration.','The manuscript was recovered from a library that was never built.','ash',4,null],
 ['The Silent Codex','Manuscripts','A hand-bound volume with embossed metal corners.','Some pages are blank until viewed under a low angled light.','codex',4,null],
 ['Clockwork Universe','Inventions','A miniature brass mechanical model of impossible planets.','The internal gears continue to turn although the main spring is missing.','clock',5,'clockwork-heart'],
 ['The Forgotten Egg','Cabinet of Wonders','A pale ceramic egg that feels unexpectedly warm to the touch.','A mysterious specimen found in a drawer labelled 1894.','egg',5,'forgotten-egg'],
 ['The Lost Constellation','Astronomical Instruments','A seven-point brass star chart that changes its alignment.','The stars show a position visible only on the museum’s founding night.','stars',5,'lost-constellation'],
 ['The North Gate','Architecture','An engraved model of a door without hinges.','The architectural plans do not explain where the door once stood.','gate',6,null],
 ['Keeper’s Lantern','Personal Histories','A blackened lantern bearing the crest of the missing curator.','It is the last object documented before the curator disappeared in 1894.','keeper',6,null],
 ['Mirror of Memory','Cabinet of Wonders','An oval silver mirror with a fractured surface.','An inscription asks: Do you remember the place you have not visited?','mirror',6,null],
 ['The Golden Key','Civilizations','A bronze key whose teeth form an unfamiliar alphabet.','Perhaps the seven secret messages can explain what it unlocks.','key',6,null]
];
export const daysUntil = date => { const today=museumToday(); return Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000); };
export function museumToday(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const obj=Object.fromEntries(parts.map(p=>[p.type,p.value])); return `${obj.year}-${obj.month}-${obj.day}`;
}
export function dailyStamp(date){
 const bytes=createHash('sha256').update('northstar-archive:'+date).digest();
 const icons=['✦','✶','☽','✧','✳','❖','✷','✺','◈','✸','✥','✻'];
 const colors=['#B79A61','#819FA4','#C48E78','#AAB589','#9A86B5','#D2A46C'];
 return {date,emblem:icons[bytes[0]%icons.length],border:bytes[1]%4,accent:colors[bytes[2]%colors.length],serial:bytes.subarray(3,6).toString('hex').toUpperCase(),pattern:bytes.subarray(6,12).toString('hex')};
}
export function museumSchema(db){
 db.exec(`
 CREATE TABLE IF NOT EXISTS artifacts (
 id INTEGER PRIMARY KEY, exhibition_id INTEGER NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
 slug TEXT NOT NULL UNIQUE,title TEXT NOT NULL,category TEXT NOT NULL,summary TEXT NOT NULL,story TEXT NOT NULL,
 image_key TEXT NOT NULL, secret_key TEXT UNIQUE,published INTEGER NOT NULL DEFAULT 1 CHECK(published IN (0,1)) );
 CREATE TABLE IF NOT EXISTS liked_artifacts (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, artifact_id INTEGER NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,PRIMARY KEY(user_id,artifact_id));
 CREATE TABLE IF NOT EXISTS saved_artifacts (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, artifact_id INTEGER NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,PRIMARY KEY(user_id,artifact_id));
 CREATE TABLE IF NOT EXISTS discoveries (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,secret_key TEXT NOT NULL,discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,secret_key));
 CREATE TABLE IF NOT EXISTS visit_schedule (visit_date TEXT PRIMARY KEY,closed INTEGER NOT NULL DEFAULT 0 CHECK(closed IN (0,1)),capacity INTEGER NOT NULL DEFAULT 18 CHECK(capacity BETWEEN 1 AND 200));
 CREATE TABLE IF NOT EXISTS bookings (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 code TEXT NOT NULL UNIQUE,visit_date TEXT NOT NULL,slot TEXT NOT NULL,visitors INTEGER NOT NULL CHECK(visitors BETWEEN 1 AND 5),
 status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled','checked_in','no_show')),
 payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','paid')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, checked_in_at TEXT );
 CREATE INDEX IF NOT EXISTS idx_bookings_date_slot ON bookings(visit_date,slot,status);
 CREATE TABLE IF NOT EXISTS daily_stamps (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,stamp_date TEXT NOT NULL,booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,earned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,stamp_date));
 CREATE TABLE IF NOT EXISTS reviews (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 artifact_id INTEGER NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
 stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),body TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id,artifact_id));
 `);
 if(!db.prepare('SELECT id FROM artifacts LIMIT 1').get()){
  const rows=db.prepare('SELECT id FROM exhibitions ORDER BY id').all();
  const insert=db.prepare('INSERT INTO artifacts(exhibition_id,slug,title,category,summary,story,image_key,secret_key) VALUES(?,?,?,?,?,?,?,?)');
  for(const [title,category,summary,story,imageKey,ix,secret] of catalog){const id=rows[ix-1]?.id;if(id)insert.run(id,title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,''),title,category,summary,story,imageKey,secret)}
 }
}
const safeUser = (db,req,fn) => fn(db,req);
function available(db,date){
 const advance=daysUntil(date); if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||advance<0||advance>60)return null;
 const schedule=db.prepare('SELECT closed,capacity FROM visit_schedule WHERE visit_date=?').get(date);
 const day=new Date(date+'T12:00:00Z').getUTCDay();const closed=day===1 || Boolean(schedule?.closed);
 return {date,closed,capacity:schedule?.capacity ?? 18, slots:slots.map(time=>{
 const count=db.prepare(`SELECT COALESCE(SUM(visitors),0) AS n FROM bookings WHERE visit_date=? AND slot=? AND status IN ('confirmed','checked_in')`).get(date,time).n;
 return {time,remaining:closed?0:Math.max(0,(schedule?.capacity ?? 18)-count)};
 })};
}
function bookingRow(db,row){return {...row,stamp:dailyStamp(row.visit_date)};}
const reviewSelect=`SELECT r.id,r.stars,r.body,r.created_at AS createdAt,u.name AS reviewer FROM reviews r JOIN users u ON u.id=r.user_id`;
export async function handleMuseumApi({db,req,res,url,method,parseJson,requireLogin,requireAdmin,sendJson,HttpError,logAdmin}){
 const p=url.pathname;
 const reply=(status,obj)=>{sendJson(res,status,obj);return true};
 const fail=(code,message)=>{throw new HttpError(code,message)};
 const getUser=()=>safeUser(db,req,requireLogin);
 const getAdmin=()=>safeUser(db,req,requireAdmin);
 if(method==='GET' && p==='/api/artifacts'){
  const rows=db.prepare(`SELECT a.*, (SELECT COUNT(*) FROM liked_artifacts WHERE artifact_id=a.id) AS like_count,(SELECT ROUND(AVG(stars),1) FROM reviews WHERE artifact_id=a.id AND status='approved') AS rating FROM artifacts a WHERE published=1 ORDER BY id`).all();
  return reply(200,{artifacts:rows.map(r=>({...r,likeCount:r.like_count, rating:r.rating??null,secretKey:r.secret_key}))});
 }
 if(method==='GET' && /^\/api\/artifacts\/\d+$/.test(p)){
  const row=db.prepare('SELECT * FROM artifacts WHERE id=? AND published=1').get(Number(p.split('/')[3]));
  if(!row)fail(404,'Artifact not found.');
  const reviews=db.prepare(`${reviewSelect} WHERE r.artifact_id=? AND r.status='approved' ORDER BY r.id DESC LIMIT 40`).all(row.id);
  return reply(200,{artifact:{...row,secretKey:row.secret_key},reviews});
 }
 if(method==='GET' && p==='/api/mysteries')return reply(200,{mysteries:secretList.map(([key,title,hint])=>({key,title,hint}))});
 if(method==='GET' && p==='/api/visit/availability'){
  const date=url.searchParams.get('date')||'';const slots=available(db,date);if(!slots)fail(400,'Choose a valid date within 60 days.');return reply(200,{...slots,stamp:dailyStamp(date)});
 }
 if(method==='GET' && p==='/api/account/museum'){
  const user=getUser();
  const liked=db.prepare(`SELECT a.* FROM liked_artifacts l JOIN artifacts a ON a.id=l.artifact_id WHERE l.user_id=? AND a.published=1 ORDER BY a.id DESC`).all(user.id);
  const saved=db.prepare(`SELECT a.* FROM saved_artifacts l JOIN artifacts a ON a.id=l.artifact_id WHERE l.user_id=? AND a.published=1 ORDER BY a.id DESC`).all(user.id);
  const discoveries=db.prepare('SELECT secret_key AS key,discovered_at AS discoveredAt FROM discoveries WHERE user_id=? ORDER BY discovered_at DESC').all(user.id);
  const bookings=db.prepare(`SELECT id,code,visit_date AS date,slot AS time,visitors,status,payment_status AS paymentStatus,created_at AS createdAt,checked_in_at AS checkedInAt FROM bookings WHERE user_id=? ORDER BY visit_date DESC,slot DESC`).all(user.id).map(b=>bookingRow(db,b));
  const stamps=db.prepare('SELECT stamp_date AS date,earned_at AS earnedAt FROM daily_stamps WHERE user_id=? ORDER BY stamp_date DESC').all(user.id).map(s=>({...s,stamp:dailyStamp(s.date)}));
  const count=stamps.length;
  const badges=[1,5,10,25,50].filter(n=>count>=n).map(n=>({visits:n,name:({1:'First Explorer',5:'Museum Enthusiast',10:'Star Collector',25:'Northstar Legend',50:'Northstar Master'})[n]}));
  return reply(200,{liked,saved,discoveries,bookings,stamps,badges,visitCount:count});
 }
 const artifactLike=p.match(/^\/api\/account\/artifacts\/(\d+)\/(like|save)$/);
 if(artifactLike && ['POST','DELETE'].includes(method)){
  const user=getUser(),id=Number(artifactLike[1]),table=artifactLike[2]==='like'?'liked_artifacts':'saved_artifacts';
  if(!Number.isSafeInteger(id)||id<1)fail(400,'Invalid artifact.');
  if(method==='POST'){
   if(!db.prepare('SELECT id FROM artifacts WHERE id=? AND published=1').get(id))fail(404,'Artifact not found.');
   db.prepare(`INSERT OR IGNORE INTO ${table}(user_id,artifact_id) VALUES(?,?)`).run(user.id,id);
  }else db.prepare(`DELETE FROM ${table} WHERE user_id=? AND artifact_id=?`).run(user.id,id);
  return reply(200,{active:method==='POST',count:db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE artifact_id=?`).get(id).n});
 }
 const discover=p.match(/^\/api\/account\/discoveries\/([a-z-]+)$/);
 if(discover && method==='POST'){
  const user=getUser(),key=discover[1];if(!secretList.some(s=>s[0]===key))fail(404,'Mystery not found.');
  const added=db.prepare('INSERT OR IGNORE INTO discoveries(user_id,secret_key) VALUES(?,?)').run(user.id,key).changes;
  return reply(added?201:200,{discovered:true,added:Boolean(added),completed:db.prepare('SELECT COUNT(*) AS n FROM discoveries WHERE user_id=?').get(user.id).n});
 }
 if(p==='/api/account/bookings' && method==='POST'){
  const user=getUser(),data=await parseJson(req),date=data.date,time=data.time,visitors=data.visitors;
  if(typeof date!=='string'||!slots.includes(time)||!Number.isInteger(visitors)||visitors<1||visitors>5)fail(400,'Choose a valid date, time and 1–5 visitors.');
  const entry=available(db,date);if(!entry)fail(400,'Bookings must be within the next 60 days.');
  if(entry.closed)fail(409,'Museum closed on this date.');
  // SQLite write lock is held through the capacity check and insert.
  db.exec('BEGIN IMMEDIATE');
  try{
   const fresh=available(db,date);
   if(fresh.slots.find(s=>s.time===time).remaining<visitors)fail(409,'Not enough places remain for this time.');
   const code='NS-'+date.replaceAll('-','')+'-'+randomBytes(4).toString('hex').toUpperCase();
   const info=db.prepare('INSERT INTO bookings(user_id,code,visit_date,slot,visitors) VALUES(?,?,?,?,?)').run(user.id,code,date,time,visitors);
   db.exec('COMMIT');
   return reply(201,{booking:{id:Number(info.lastInsertRowid),code,date,time,visitors,status:'confirmed',paymentStatus:'unpaid',stamp:dailyStamp(date)}});
  }catch(err){db.exec('ROLLBACK');throw err;}
 }
 const cancel=p.match(/^\/api\/account\/bookings\/(\d+)\/cancel$/);
 if(cancel&&method==='POST'){
  const user=getUser(),id=Number(cancel[1]);
  const booking=db.prepare('SELECT * FROM bookings WHERE id=? AND user_id=?').get(id,user.id);
  if(!booking)fail(404,'Booking not found.');
  if(booking.status!=='confirmed'||daysUntil(booking.visit_date)<0)fail(409,'This booking can no longer be cancelled.');
  db.prepare("UPDATE bookings SET status='cancelled' WHERE id=?").run(id);
  return reply(200,{status:'cancelled'});
 }
 const review=p.match(/^\/api\/account\/artifacts\/(\d+)\/review$/);
 if(review&&method==='POST'){
  const user=getUser(),id=Number(review[1]),data=await parseJson(req);
  if(!db.prepare('SELECT id FROM artifacts WHERE id=? AND published=1').get(id))fail(404,'Artifact not found.');
  if(!Number.isInteger(data.stars)||data.stars<1||data.stars>5||typeof data.body!=='string'||data.body.length>600)fail(400,'Choose 1–5 stars and a review of at most 600 characters.');
  db.prepare(`INSERT INTO reviews(user_id,artifact_id,stars,body,status) VALUES(?,?,?,?,'pending') ON CONFLICT(user_id,artifact_id) DO UPDATE SET stars=excluded.stars,body=excluded.body,status='pending'`).run(user.id,id,data.stars,data.body.trim());
  return reply(201,{message:'Your review is awaiting moderation.'});
 }
 if(p==='/api/admin/museum/bookings'&&method==='GET'){
  getAdmin();const rows=db.prepare(`SELECT b.id,b.code,b.visit_date AS date,b.slot AS time,b.visitors,b.status,b.payment_status AS paymentStatus,u.name,u.email FROM bookings b JOIN users u ON u.id=b.user_id ORDER BY b.visit_date DESC,b.slot DESC LIMIT 300`).all();return reply(200,{bookings:rows});
 }
 const checkin=p.match(/^\/api\/admin\/museum\/bookings\/(\d+)\/check-in$/);
 if(checkin&&method==='POST'){
  getAdmin();const data=await parseJson(req),id=Number(checkin[1]);
  if(data.paid!==true)fail(400,'Confirm that payment was received at the entrance.');
  db.exec('BEGIN IMMEDIATE');
  try{
   const row=db.prepare('SELECT * FROM bookings WHERE id=?').get(id);
   if(!row)fail(404,'Booking not found.');
   if(row.status!=='confirmed')fail(409,'Booking is not awaiting check-in.');
   if(row.visit_date!==museumToday())fail(409,'Check-in is only permitted on the booked visit date.');
   db.prepare("UPDATE bookings SET status='checked_in',payment_status='paid',checked_in_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
   db.prepare('INSERT OR IGNORE INTO daily_stamps(user_id,stamp_date,booking_id) VALUES(?,?,?)').run(row.user_id,row.visit_date,id);
   logAdmin(db,getAdmin().id,'check_in','booking',id);
   db.exec('COMMIT');
   return reply(200,{status:'checked_in',paymentStatus:'paid',stamp:dailyStamp(row.visit_date)});
  }catch(err){db.exec('ROLLBACK');throw err;}
 }
 if(p==='/api/admin/museum/schedule'&&method==='PUT'){
  getAdmin();const data=await parseJson(req);
  if(typeof data.date!=='string'||!available(db,data.date)||typeof data.closed!=='boolean'||!Number.isInteger(data.capacity)||data.capacity<1||data.capacity>200)fail(400,'Invalid schedule settings.');
  const booked=db.prepare("SELECT MAX(n) AS n FROM (SELECT SUM(visitors) AS n FROM bookings WHERE visit_date=? AND status IN ('confirmed','checked_in') GROUP BY slot)").get(data.date).n||0;
  if(!data.closed&&data.capacity<booked)fail(409,'Capacity cannot be set below existing reservations.');
  db.prepare('INSERT INTO visit_schedule(visit_date,closed,capacity) VALUES(?,?,?) ON CONFLICT(visit_date) DO UPDATE SET closed=excluded.closed,capacity=excluded.capacity').run(data.date,Number(data.closed),data.capacity);
  logAdmin(db,getAdmin().id,'update_schedule','schedule',null);
  return reply(200,available(db,data.date));
 }
 if(p==='/api/admin/museum/reviews'&&method==='GET'){
  getAdmin();return reply(200,{reviews:db.prepare(`${reviewSelect} JOIN artifacts a ON a.id=r.artifact_id WHERE r.status='pending' ORDER BY r.id DESC`).all()});
 }
 const approval=p.match(/^\/api\/admin\/museum\/reviews\/(\d+)\/(approve|delete)$/);
 if(approval&&method==='POST'){
  getAdmin();const id=Number(approval[1]);const row=db.prepare('SELECT id FROM reviews WHERE id=?').get(id);if(!row)fail(404,'Review not found.');
  if(approval[2]==='approve')db.prepare("UPDATE reviews SET status='approved' WHERE id=?").run(id);
  else db.prepare('DELETE FROM reviews WHERE id=?').run(id);
  logAdmin(db,getAdmin().id,approval[2]==='approve'?'approve_review':'delete_review','review',id);
  return reply(200,{done:true});
 }
 if(p==='/api/admin/museum/stats'&&method==='GET'){
  getAdmin();const sql=q=>db.prepare(q).get().n;
  return reply(200,{members:sql("SELECT COUNT(*) AS n FROM users WHERE role='visitor'"),artifacts:sql('SELECT COUNT(*) AS n FROM artifacts'),bookings:sql('SELECT COUNT(*) AS n FROM bookings'),checkins:sql("SELECT COUNT(*) AS n FROM bookings WHERE status='checked_in'"),likes:sql('SELECT COUNT(*) AS n FROM liked_artifacts'),discoveries:sql('SELECT COUNT(*) AS n FROM discoveries'),pendingReviews:sql("SELECT COUNT(*) AS n FROM reviews WHERE status='pending'")});
 }
 if(p==='/api/admin/museum/artifacts'&&method==='GET'){
  getAdmin();return reply(200,{artifacts:db.prepare('SELECT * FROM artifacts ORDER BY id DESC').all()});
 }
 if(p==='/api/admin/museum/artifacts'&&method==='POST'){
  getAdmin();const d=await parseJson(req);
  if(!Number.isSafeInteger(d.exhibitionId)||!db.prepare('SELECT id FROM exhibitions WHERE id=?').get(d.exhibitionId)||typeof d.title!=='string'||d.title.trim().length<3||d.title.length>100||typeof d.summary!=='string'||d.summary.trim().length<10||d.summary.length>280||typeof d.story!=='string'||d.story.length<20||d.story.length>2400||typeof d.imageKey!=='string'||!/^[a-z-]{1,35}$/.test(d.imageKey))fail(400,'Invalid artifact details.');
  const info=db.prepare('INSERT INTO artifacts(exhibition_id,slug,title,category,summary,story,image_key,published) VALUES(?,?,?,?,?,?,?,1)').run(d.exhibitionId,'artifact-'+randomBytes(5).toString('hex'),d.title.trim(),'Curated Object',d.summary.trim(),d.story.trim(),d.imageKey);
  logAdmin(db,getAdmin().id,'create_artifact','artifact',Number(info.lastInsertRowid));
  return reply(201,{id:Number(info.lastInsertRowid)});
 }
 const aRoute=p.match(/^\/api\/admin\/museum\/artifacts\/(\d+)$/);
 if(aRoute && ['PUT','DELETE'].includes(method)){
  getAdmin();const id=Number(aRoute[1]);if(!db.prepare('SELECT id FROM artifacts WHERE id=?').get(id))fail(404,'Artifact not found.');
  if(method==='DELETE'){db.prepare('DELETE FROM artifacts WHERE id=?').run(id);logAdmin(db,getAdmin().id,'delete_artifact','artifact',id);return reply(200,{deleted:true});}
  const d=await parseJson(req);if(typeof d.published!=='boolean'||typeof d.summary!=='string'||d.summary.length<10||d.summary.length>280||typeof d.story!=='string'||d.story.length<20||d.story.length>2400)fail(400,'Invalid artifact data.');
  db.prepare('UPDATE artifacts SET summary=?,story=?,published=? WHERE id=?').run(d.summary.trim(),d.story.trim(),Number(d.published),id);
  logAdmin(db,getAdmin().id,'update_artifact','artifact',id);
  return reply(200,{updated:true});
 }
 return false;
}
