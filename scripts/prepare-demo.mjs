// Prepare an isolated, disposable classroom demo. Never overwrite existing data.
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { openDatabase } from '../server/db.mjs';
import { hashPassword } from '../server/auth.mjs';

const path='./data/northstar-class-demo.sqlite';
if(existsSync(path)){
 console.error('Demo database already exists; nothing was changed. Keep or back it up before preparing a new one.');
 process.exitCode=1;
}else{
 const db=openDatabase(path);
 try{
  const visitorPassword=`Ns-Demo-${randomBytes(10).toString('hex')}`;
  const adminPassword=`Ns-Admin-${randomBytes(10).toString('hex')}`;
  const add=db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)');
  const visitorId=Number(add.run('Demo Visitor','visitor@northstar.demo',hashPassword(visitorPassword),'visitor').lastInsertRowid);
  add.run('Demo Curator','admin@northstar.demo',hashPassword(adminPassword),'admin');
  const objects=db.prepare('SELECT id FROM artifacts WHERE published=1 ORDER BY id LIMIT 3').all().map(x=>x.id);
  const eid=Number(db.prepare('INSERT INTO mini_exhibitions(user_id,title,description) VALUES(?,?,?)').run(visitorId,'My First Discovery','Three curious objects from our fictional collection.').lastInsertRowid);
  const addItem=db.prepare('INSERT INTO mini_exhibition_items(exhibition_id,artifact_id,position) VALUES(?,?,?)');
  objects.forEach((id,pos)=>addItem.run(eid,id,pos));
  console.log('\nNorthstar classroom demo prepared at '+path);
  console.log('Visitor: visitor@northstar.demo | Password: '+visitorPassword);
  console.log('Admin:   admin@northstar.demo   | Password: '+adminPassword);
  console.log('Save these temporary credentials for your demo. They are NOT in the source code.');
  console.log('Start with: npm run demo');
  console.log('Your normal data/northstar.sqlite is unchanged.');
 }finally{db.close();}
}
