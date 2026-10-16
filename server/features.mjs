import { ownMiniExhibitions } from './student.mjs';
import { verifyPassword } from './auth.mjs';
import { museumToday } from './museum.mjs';

// All new features use the existing Node/SQLite server. No paid services are needed.
const questions = [
  { question:'Which object in the collection is an ocean map?', choices:['The Golden Key','The Tidal Atlas','Astral Lens'], answer:1 },
  { question:'Which artifact is a ceremonial mask?', choices:['Moonstone Archive','The Forgotten Egg','Forgotten Guardian'], answer:2 },
  { question:'Which object was found in a drawer marked 1894?', choices:['The Forgotten Egg','The Golden Key','The Tidal Atlas'], answer:0 }
];
const validSecrets = ['forgotten-egg','whispering-frame','clockwork-heart','lost-constellation','sealed-letter','guardian-eye','hidden-compass'];

export function featureSchema(db){
 db.exec(`
  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 3),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_quiz_attempt_user ON quiz_attempts(user_id,created_at);
  CREATE TABLE IF NOT EXISTS member_collections (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 60),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS member_collection_items (
    collection_id INTEGER NOT NULL REFERENCES member_collections(id) ON DELETE CASCADE,
    artifact_id INTEGER NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    PRIMARY KEY(collection_id,artifact_id)
  );
  CREATE TABLE IF NOT EXISTS admin_audit (
    id INTEGER PRIMARY KEY,
    actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
 `);
}

export function logAdmin(db, userId, action, targetType, targetId=null){
 db.prepare('INSERT INTO admin_audit(actor_user_id,action,target_type,target_id) VALUES (?,?,?,?)')
   .run(userId,action,targetType,targetId);
}

function ownCollections(db,userId){
 const rows=db.prepare('SELECT id,name,created_at AS createdAt FROM member_collections WHERE user_id=? ORDER BY id DESC').all(userId);
 const items=db.prepare(`SELECT i.collection_id AS collectionId, a.id, a.title, a.image_key AS imageKey
 FROM member_collection_items i JOIN artifacts a ON a.id=i.artifact_id
 WHERE i.collection_id=? AND a.published=1 ORDER BY a.title`);
 return rows.map(row=>({...row,artifacts:items.all(row.id)}));
}
function exportedData(db,user){
 const statements={
  savedExhibitions:'SELECT exhibition_id AS exhibitionId,saved_at AS savedAt FROM saved_exhibitions WHERE user_id=?',
  savedEvents:'SELECT event_id AS eventId,saved_at AS savedAt FROM saved_events WHERE user_id=?',
  likedExhibitions:'SELECT exhibition_id AS exhibitionId FROM liked_exhibitions WHERE user_id=?',
  likedEvents:'SELECT event_id AS eventId FROM liked_events WHERE user_id=?',
  savedArtifacts:'SELECT artifact_id AS artifactId FROM saved_artifacts WHERE user_id=?',
  likedArtifacts:'SELECT artifact_id AS artifactId FROM liked_artifacts WHERE user_id=?',
  discoveries:'SELECT secret_key AS secret,discovered_at AS discoveredAt FROM discoveries WHERE user_id=?',
  bookings:'SELECT code,visit_date AS date,slot AS time,visitors,ticket_breakdown AS tickets,total_cents AS totalCents,status,payment_status AS paymentStatus,created_at AS createdAt FROM bookings WHERE user_id=?',
  stamps:'SELECT stamp_date AS date,earned_at AS earnedAt FROM daily_stamps WHERE user_id=?',
  reviews:'SELECT artifact_id AS artifactId,stars,body,status,created_at AS createdAt FROM reviews WHERE user_id=?',
  quizAttempts:'SELECT score,created_at AS createdAt FROM quiz_attempts WHERE user_id=?'
 };
 const data={exportedAt:new Date().toISOString(),profile:{id:user.id,name:user.name,email:user.email,role:user.role},collections:ownCollections(db,user.id),miniExhibitions:ownMiniExhibitions(db,user.id)};
 for(const [key,sql] of Object.entries(statements))data[key]=db.prepare(sql).all(user.id);
 data.bookings=data.bookings.map(row=>({...row,tickets:JSON.parse(row.tickets??'{}'),currency:'CAD'}));
 return data;
}

export async function handleFeatureApi({db,req,res,url,method,parseJson,requireLogin,requireAdmin,sendJson,clearSessionCookie,isSecure,HttpError,limitAccountAction}){
 const p=url.pathname;
 const reply=(code,data,headers)=>{sendJson(res,code,data,headers);return true;};
 const fail=(status,message)=>{throw new HttpError(status,message)};
 const user=()=>requireLogin(db,req);
 const admin=()=>requireAdmin(db,req);

 if(p==='/api/artifact-of-day'&&method==='GET'){
  const rows=db.prepare('SELECT id,title,category,summary,image_key AS imageKey FROM artifacts WHERE published=1 ORDER BY id').all();
  const date=museumToday();
  const idx=Math.floor(Date.parse(date+'T12:00:00Z')/86400000)%rows.length;
  return reply(200,{date,artifact:rows.length?rows[idx]:null});
 }
 if(p==='/api/quiz'&&method==='GET'){
  return reply(200,{questions:questions.map(({question,choices},id)=>({id,question,choices}))});
 }
 if(p==='/api/account/quiz'&&method==='POST'){
  const who=user(),body=await parseJson(req);
  if(!Array.isArray(body.answers)||body.answers.length!==3||body.answers.some(x=>!Number.isInteger(x)||x<0||x>2))fail(400,'Answer all three quiz questions.');
  const attempts=db.prepare("SELECT COUNT(*) AS count FROM quiz_attempts WHERE user_id=? AND created_at>=datetime('now','-1 day')").get(who.id).count;
  if(attempts>=15)fail(429,'Quiz attempt limit reached. Try again tomorrow.');
  const score=questions.reduce((n,q,i)=>n+Number(q.answer===body.answers[i]),0);
  db.prepare('INSERT INTO quiz_attempts(user_id,score) VALUES(?,?)').run(who.id,score);
  return reply(200,{score,total:3,correctAnswers:questions.map(q=>q.answer),clue:score>=2?'Look for the seven marked objects. Each one keeps part of the curator’s story.':null});
 }
 if(p==='/api/account/mystery/finale'&&method==='GET'){
  const who=user();
  const found=db.prepare(`SELECT COUNT(*) AS n FROM discoveries WHERE user_id=? AND secret_key IN (${validSecrets.map(()=>'?').join(',')})`).get(who.id,...validSecrets).n;
  if(found!==7)fail(403,`Find all seven mysteries to enter the Secret Archive. Progress: ${found}/7.`);
  return reply(200,{title:'The Curator’s Last Letter',year:1894,reward:'Keeper of the Northstar Archive',letter:'To the next keeper of Northstar,\n\nI did not disappear. I followed seven objects through seven stories, and I discovered that no single object held the answer. The true archive is the curiosity of those who visit.\n\nIf you have found every clue, you are ready to become its next keeper. Keep asking questions, and the museum will never close its doors to wonder.\n\nThe First Curator, 1894'});
 }
 if(p==='/api/account/collections'&&method==='GET')return reply(200,{collections:ownCollections(db,user().id)});
 if(p==='/api/account/collections'&&method==='POST'){
  const who=user(),body=await parseJson(req);
  const name=typeof body.name==='string'?body.name.trim():'';
  if(name.length<2||name.length>60)fail(400,'Collection name must be 2 to 60 characters.');
  if(db.prepare('SELECT COUNT(*) AS n FROM member_collections WHERE user_id=?').get(who.id).n>=25)fail(409,'You can have up to 25 collections.');
  const out=db.prepare('INSERT INTO member_collections(user_id,name) VALUES(?,?)').run(who.id,name);
  return reply(201,{id:Number(out.lastInsertRowid),name});
 }
 const collection=p.match(/^\/api\/account\/collections\/(\d+)$/);
 if(collection&&['PUT','DELETE'].includes(method)){
  const who=user(),id=Number(collection[1]);
  if(!db.prepare('SELECT id FROM member_collections WHERE id=? AND user_id=?').get(id,who.id))fail(404,'Collection not found.');
  if(method==='DELETE'){db.prepare('DELETE FROM member_collections WHERE id=? AND user_id=?').run(id,who.id);return reply(200,{deleted:true});}
  const body=await parseJson(req),name=typeof body.name==='string'?body.name.trim():'';
  if(name.length<2||name.length>60)fail(400,'Collection name must be 2 to 60 characters.');
  db.prepare('UPDATE member_collections SET name=? WHERE id=? AND user_id=?').run(name,id,who.id);
  return reply(200,{updated:true});
 }
 const item=p.match(/^\/api\/account\/collections\/(\d+)\/artifacts\/(\d+)$/);
 if(item&&['POST','DELETE'].includes(method)){
  const who=user(),collectionId=Number(item[1]),artifactId=Number(item[2]);
  if(!db.prepare('SELECT id FROM member_collections WHERE id=? AND user_id=?').get(collectionId,who.id))fail(404,'Collection not found.');
  if(method==='POST'){
   if(!db.prepare('SELECT id FROM artifacts WHERE id=? AND published=1').get(artifactId))fail(404,'Artifact not found.');
   if(db.prepare('SELECT COUNT(*) AS n FROM member_collection_items WHERE collection_id=?').get(collectionId).n>=100)fail(409,'Collection is full.');
   db.prepare('INSERT OR IGNORE INTO member_collection_items(collection_id,artifact_id) VALUES(?,?)').run(collectionId,artifactId);
  }else db.prepare('DELETE FROM member_collection_items WHERE collection_id=? AND artifact_id=?').run(collectionId,artifactId);
  return reply(200,{saved:method==='POST'});
 }
 if(p==='/api/account/export'&&method==='GET')return reply(200,exportedData(db,user()));
 if(p==='/api/account'&&method==='DELETE'){
  limitAccountAction(req);
  const who=user(),body=await parseJson(req);
  if(body.confirmation!=='DELETE ACCOUNT')fail(400,'Type DELETE ACCOUNT exactly.');
  if(typeof body.password!=='string'||body.password.length>128)fail(401,'Incorrect password.');
  const row=db.prepare('SELECT password_hash,role FROM users WHERE id=?').get(who.id);
  if(!verifyPassword(body.password,row.password_hash))fail(401,'Incorrect password.');
  if(row.role==='admin')fail(403,'Administrator accounts cannot be deleted from this page.');
  db.prepare('DELETE FROM users WHERE id=?').run(who.id);
  return reply(200,{deleted:true},{'Set-Cookie':clearSessionCookie(isSecure(req))});
 }
 if(p==='/api/admin/users'&&method==='GET'){
  admin();
  const search=(url.searchParams.get('search')||'').trim().slice(0,80);
  const pageRaw=Number(url.searchParams.get('page')||1);
  if(!Number.isInteger(pageRaw)||pageRaw<1||pageRaw>10000)fail(400,'Invalid page.');
  const term=`%${search.replace(/[\\%_]/g,'\\$&')}%`;
  const where="WHERE (name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')";
  const total=db.prepare(`SELECT COUNT(*) AS n FROM users ${where}`).get(term,term).n;
  const rows=db.prepare(`SELECT id,name,email,role,created_at AS createdAt FROM users ${where} ORDER BY id DESC LIMIT 20 OFFSET ?`).all(term,term,(pageRaw-1)*20);
  return reply(200,{users:rows,page:pageRaw,total});
 }
 const removeUser=p.match(/^\/api\/admin\/users\/(\d+)$/);
 if(removeUser&&method==='DELETE'){
  limitAccountAction(req);
  const who=admin(),id=Number(removeUser[1]),body=await parseJson(req);
  if(body.confirmation!=='DELETE ACCOUNT')fail(400,'Type DELETE ACCOUNT exactly.');
  if(typeof body.password!=='string'||body.password.length>128)fail(401,'Incorrect administrator password.');
  const actor=db.prepare('SELECT password_hash FROM users WHERE id=?').get(who.id);
  if(!verifyPassword(body.password,actor.password_hash))fail(401,'Incorrect administrator password.');
  if(id===who.id)fail(403,'You cannot delete yourself from User Management.');
  const target=db.prepare('SELECT role FROM users WHERE id=?').get(id);
  if(!target)fail(404,'User not found.');
  if(target.role!=='visitor')fail(403,'Only visitor accounts can be deleted.');
  db.exec('BEGIN IMMEDIATE');
  try{
   db.prepare("DELETE FROM users WHERE id=? AND role='visitor'").run(id);
   logAdmin(db,who.id,'delete_user','user',id);
   db.exec('COMMIT');
  }catch(err){db.exec('ROLLBACK');throw err;}
  return reply(200,{deleted:true});
 }
 if(p==='/api/admin/activity'&&method==='GET'){
  admin();
  const entries=db.prepare(`SELECT a.id,a.action,a.target_type AS targetType,a.target_id AS targetId,a.created_at AS createdAt,
   COALESCE(u.name,'Former administrator') AS actor FROM admin_audit a LEFT JOIN users u ON u.id=a.actor_user_id
   ORDER BY a.id DESC LIMIT 100`).all();
  return reply(200,{entries});
 }
 return false;
}
