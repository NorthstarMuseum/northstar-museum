// Small educational features for Northstar's fictional class museum.
const timeline = [
  {year:'1894',title:'The first archive',story:'Our fictional curator begins collecting objects with unusual stories.',imageKey:'egg'},
  {year:'1896',title:'A journey north',story:'A compass and lantern help the imaginary expedition find its way.',imageKey:'compass'},
  {year:'1902',title:'Stories from the sea',story:'The Tidal Atlas arrives with maps that do not match the coast.',imageKey:'atlas'},
  {year:'1911',title:'The portrait gallery',story:'An unexplained painting becomes part of the invented collection.',imageKey:'frame'},
  {year:'1924',title:'The invention room',story:'The clockwork model joins Northstar and brings a new mystery.',imageKey:'clock'},
  {year:'1938',title:'The key is found',story:'A curious key is added to the archive. Its story remains unfinished.',imageKey:'key'}
];

export function studentSchema(db) {
 db.exec(`
  CREATE TABLE IF NOT EXISTS mini_exhibitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_mini_user ON mini_exhibitions(user_id,id);
  CREATE TABLE IF NOT EXISTS mini_exhibition_items (
    exhibition_id INTEGER NOT NULL REFERENCES mini_exhibitions(id) ON DELETE CASCADE,
    artifact_id INTEGER NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    PRIMARY KEY (exhibition_id,artifact_id),
    UNIQUE (exhibition_id,position)
  );
 `);
}

export function ownMiniExhibitions(db,userId) {
 const rows=db.prepare('SELECT id,title,description,created_at AS createdAt,updated_at AS updatedAt FROM mini_exhibitions WHERE user_id=? ORDER BY id DESC').all(userId);
 const items=db.prepare(`SELECT a.id,a.title,a.category,a.summary,a.image_key AS imageKey
    FROM mini_exhibition_items i JOIN artifacts a ON a.id=i.artifact_id
    WHERE i.exhibition_id=? AND a.published=1 ORDER BY i.position`);
 return rows.map(row=>({...row,artifacts:items.all(row.id)}));
}

function validateExhibition(db,data,fail) {
 if (!data||typeof data!=='object'||Array.isArray(data))fail(400,'Invalid exhibition details.');
 const title=typeof data.title==='string'?data.title.trim():'';
 const description=typeof data.description==='string'?data.description.trim():'';
 if(title.length<3||title.length>70||description.length<10||description.length>250)fail(400,'Use a title (3 to 70 characters) and a description (10 to 250 characters).');
 const ids=data.artifactIds;
 if(!Array.isArray(ids)||ids.length<3||ids.length>6||ids.some(id=>!Number.isSafeInteger(id)||id<=0)||new Set(ids).size!==ids.length)fail(400,'Select 3 to 6 different objects.');
 const matches=db.prepare(`SELECT COUNT(*) AS n FROM artifacts WHERE published=1 AND id IN (${ids.map(()=>'?').join(',')})`).get(...ids).n;
 if(matches!==ids.length)fail(400,'Only published objects can be selected.');
 return {title,description,ids};
}

export async function handleStudentApi({db,req,res,url,method,parseJson,requireLogin,sendJson,HttpError}) {
 const path=url.pathname;
 const reply=(code,data)=>{sendJson(res,code,data);return true;};
 const fail=(code,msg)=>{throw new HttpError(code,msg);};
 if(path==='/api/timeline'&&method==='GET'){
  const rows=db.prepare('SELECT id,title,image_key AS imageKey FROM artifacts WHERE published=1').all();
  const keyed=new Map(rows.map(a=>[a.imageKey,a]));
  return reply(200,{fictional:true,entries:timeline.map(({imageKey,...t})=>({...t,artifact:keyed.get(imageKey)||null}))});
 }
 if(path==='/api/account/mini-exhibitions'){
  const who=requireLogin(db,req);
  if(method==='GET')return reply(200,{exhibitions:ownMiniExhibitions(db,who.id)});
  if(method==='POST'){
   const data=validateExhibition(db,await parseJson(req),fail);
   db.exec('BEGIN IMMEDIATE');
   try{
    if(db.prepare('SELECT COUNT(*) AS n FROM mini_exhibitions WHERE user_id=?').get(who.id).n>=10)fail(409,'You can create up to 10 mini-exhibitions.');
    const id=Number(db.prepare('INSERT INTO mini_exhibitions(user_id,title,description) VALUES(?,?,?)').run(who.id,data.title,data.description).lastInsertRowid);
    const add=db.prepare('INSERT INTO mini_exhibition_items(exhibition_id,artifact_id,position) VALUES(?,?,?)');
    data.ids.forEach((artifactId,i)=>add.run(id,artifactId,i));
    db.exec('COMMIT');
    return reply(201,{id});
   }catch(error){db.exec('ROLLBACK');throw error;}
  }
 }
 const route=path.match(/^\/api\/account\/mini-exhibitions\/(\d+)$/);
 if(route&&['PUT','DELETE'].includes(method)){
  const who=requireLogin(db,req),id=Number(route[1]);
  if(!Number.isSafeInteger(id)||!db.prepare('SELECT id FROM mini_exhibitions WHERE id=? AND user_id=?').get(id,who.id))fail(404,'Mini-exhibition not found.');
  if(method==='DELETE'){
   db.prepare('DELETE FROM mini_exhibitions WHERE id=? AND user_id=?').run(id,who.id);
   return reply(200,{deleted:true});
  }
  const data=validateExhibition(db,await parseJson(req),fail);
  db.exec('BEGIN IMMEDIATE');
  try{
   db.prepare("UPDATE mini_exhibitions SET title=?,description=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").run(data.title,data.description,id,who.id);
   db.prepare('DELETE FROM mini_exhibition_items WHERE exhibition_id=?').run(id);
   const add=db.prepare('INSERT INTO mini_exhibition_items(exhibition_id,artifact_id,position) VALUES(?,?,?)');
   data.ids.forEach((artifactId,i)=>add.run(id,artifactId,i));
   db.exec('COMMIT');return reply(200,{updated:true});
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 return false;
}
